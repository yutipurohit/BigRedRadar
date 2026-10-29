import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SURVEY_VERSION, withSubtopicPriorities, TOPICS, SUBTOPICS, SurveyValidationError, validateSurveyAnswers, EMPTY_SURVEY_PROFILE, type SurveyAnswers, type SurveyProfile } from './survey'
import { createSurveyHandlers } from './server/survey-handlers'

const empty: SurveyAnswers = {
  survey_version: SURVEY_VERSION, topic_ids: [], subtopic_ids: [], major_text: null,
  club_category_ids: [], goal_ids: [], weekly_commitment: null,
}
const full: SurveyAnswers = {
  survey_version: 2, topic_ids: ['technology', 'arts'],
  subtopic_ids: ['technology:ai-data', 'arts:music'], major_text: '  Biology  ',
  club_category_ids: ['academic'], goal_ids: ['learn', 'friends'], weekly_commitment: '1-3',
}
test('optional answers and current v2 choices are accepted and normalized', () => {
  assert.deepEqual(validateSurveyAnswers(empty), { ...empty, subtopic_priorities: {} })
  assert.equal(validateSurveyAnswers(full).major_text, 'Biology')
  assert.equal(validateSurveyAnswers({ ...empty, major_text: '  ' }).major_text, null)
})
for (const [name, value] of Object.entries({
  null: null, array: [], version: { ...empty, survey_version: 1 },
  ownerInjection: { ...empty, user_id: 8 }, missingFields: { survey_version: 2 },
  unknownTopic: { ...empty, topic_ids: ['not-real'] },
  tooManyTopics: { ...empty, topic_ids: ['technology', 'science', 'business', 'arts', 'media', 'games'] },
  duplicate: { ...empty, goal_ids: ['learn', 'learn'] },
  nonString: { ...empty, topic_ids: [42] },
  wrongArray: { ...empty, goal_ids: 'learn' },
  orphanDetail: { ...empty, subtopic_ids: ['technology:ai-data'] },
  unknownDetail: { ...empty, topic_ids: ['technology'], subtopic_ids: ['technology:invalid'] },
  duplicateDetails: { ...empty, topic_ids: ['technology'], subtopic_ids: ['technology:ai-data', 'technology:ai-data'] },
  excludedClubType: { ...empty, club_category_ids: ['campus'] },
  tooManyClubTypes: { ...empty, club_category_ids: ['academic', 'sports', 'service', 'gaming'] },
  tooManyGoals: { ...empty, goal_ids: ['friends', 'learn', 'fun'] },
  unknownGoal: { ...empty, goal_ids: ['bad'] },
  longMajor: { ...empty, major_text: 'x'.repeat(101) },
  numericMajor: { ...empty, major_text: 123 },
  invalidTime: { ...empty, weekly_commitment: '0' },
})) {
  test(`reject invalid answers: ${name}`, () => assert.throws(() => validateSurveyAnswers(value), SurveyValidationError))
}
function request(method: string, value: unknown, extra: Record<string, string> = {}) {
  return new Request('https://radar.example/api/profile/survey', {
    method, headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(value),
  })
}
function setup() {
  let user: { id: number } | null = { id: 1 }
  const calls: { action: string; id: number; answers?: SurveyAnswers }[] = []
  const handlers = createSurveyHandlers({
    currentUser: async () => user,
    get: async id => { calls.push({ action: 'get', id }); return { ...EMPTY_SURVEY_PROFILE } },
    save: async (id, answers) => {
      calls.push({ action: 'save', id, answers })
      return { ...EMPTY_SURVEY_PROFILE, status: 'completed', answers, completed_at: '2026-10-28T00:00:00.000Z', updated_at: '2026-10-28T00:00:00.000Z' }
    },
    skip: async id => { calls.push({ action: 'skip', id }); return { ...EMPTY_SURVEY_PROFILE, status: 'skipped' } },
  })
  return { handlers, calls, setUser: (next: typeof user) => { user = next } }
}
test('all endpoints require a valid session before accessing the store', async () => {
  const { handlers, calls, setUser } = setup()
  setUser(null)
  for (const response of [await handlers.GET(), await handlers.PUT(request('PUT', empty)), await handlers.POST(request('POST', { action: 'skip' }))]) {
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
  }
  assert.equal(calls.length, 0)
})
test('GET returns not_started; PUT returns normalized answers and takes ownership from session', async () => {
  const { handlers, calls, setUser } = setup()
  assert.deepEqual(await (await handlers.GET()).json(), { profile: EMPTY_SURVEY_PROFILE })
  setUser({ id: 22 })
  const response = await handlers.PUT(request('PUT', full))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).profile.answers.major_text, 'Biology')
  assert.equal(calls[1].id, 22)
  assert.equal(calls[1].answers?.survey_version, 2)
})
test('invalid writes never reach storage', async () => {
  const { handlers, calls } = setup()
  assert.equal((await handlers.PUT(request('PUT', { ...empty, user_id: 2 }))).status, 400)
  assert.equal((await handlers.POST(request('POST', { action: 'skip', user_id: 2 }))).status, 400)
  assert.equal((await handlers.POST(request('POST', { action: 'save' }))).status, 400)
  assert.equal(calls.length, 0)
})
test('skip is a separate operation scoped to the current account', async () => {
  const { handlers, calls } = setup()
  assert.equal((await handlers.POST(request('POST', { action: 'skip' }))).status, 200)
  assert.deepEqual(calls, [{ action: 'skip', id: 1 }])
})
test('cross-site and non-JSON writes are rejected', async () => {
  const { handlers, calls } = setup()
  assert.equal((await handlers.PUT(request('PUT', empty, { Origin: 'https://attacker.example' }))).status, 403)
  assert.equal((await handlers.POST(request('POST', { action: 'skip' }, { 'Sec-Fetch-Site': 'cross-site' }))).status, 403)
  assert.equal((await handlers.PUT(request('PUT', empty, { 'Content-Type': 'text/plain' }))).status, 415)
  assert.equal(calls.length, 0)
})
test('malformed and oversized JSON cannot replace stored answers', async () => {
  const { handlers, calls } = setup()
  for (const text of ['{', ' '.repeat(8193)]) {
    const response = await handlers.PUT(new Request('https://radar.example/api/profile/survey', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: text,
    }))
    assert.equal(response.status, 400)
  }
  assert.equal(calls.length, 0)
})
test('database errors return a retryable private response without leaking details', async () => {
  const unavailable = async (): Promise<SurveyProfile> => { throw new Error('private database credentials') }
  const handlers = createSurveyHandlers({ currentUser: async () => ({ id: 1 }), get: unavailable, save: unavailable, skip: unavailable })
  const response = await handlers.GET()
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.equal((await response.text()).includes('credentials'), false)
})

const fiveTopics = TOPICS.slice(0, 5).map(([id]) => id)
const allDetails: SurveyAnswers = {
  ...empty, topic_ids: fiveTopics,
  subtopic_ids: fiveTopics.flatMap(topic => SUBTOPICS[topic].map(([id]) => `${topic}:${id}`)),
}
test('all available details across five topics are accepted without a count limit', () => {
  assert.ok(allDetails.subtopic_ids.length > 15)
  assert.deepEqual(validateSurveyAnswers(allDetails), { ...allDetails, subtopic_priorities: Object.fromEntries(allDetails.subtopic_ids.map(id => [id, 2])) })
})
test('all four technology options are accepted', () => {
  const answers = { ...empty, topic_ids: ['technology'], subtopic_ids: SUBTOPICS.technology.map(([id]) => `technology:${id}`) }
  assert.equal(validateSurveyAnswers(answers).subtopic_ids.length, 4)
})
test('details from an unselected parent are still rejected', () => {
  assert.throws(() => validateSurveyAnswers({ ...empty, topic_ids: ['arts'], subtopic_ids: ['technology:ai-data'] }), SurveyValidationError)
})
test('PUT accepts every available detail and passes the complete list to storage', async () => {
  const { handlers, calls } = setup()
  const response = await handlers.PUT(request('PUT', allDetails))
  assert.equal(response.status, 200)
  assert.deepEqual(calls[0].answers?.subtopic_ids, allDetails.subtopic_ids)
  assert.deepEqual((await response.json()).profile.answers.subtopic_ids, allDetails.subtopic_ids)
})

test('Law & legal studies is accepted under policy without duplicating education', () => {
  const answers = { ...empty, topic_ids: ['policy', 'service'], subtopic_ids: ['policy:law', 'service:mentoring'] }
  assert.deepEqual(validateSurveyAnswers(answers).subtopic_ids, answers.subtopic_ids)
  const education = SUBTOPICS.service.filter(([, label]) => /education/i.test(label))
  assert.equal(education.length, 1)
  assert.equal(education[0][0], 'mentoring')
})
test('law requires its policy parent and cannot be submitted under another interest', () => {
  assert.throws(() => validateSurveyAnswers({ ...empty, topic_ids: ['service'], subtopic_ids: ['policy:law'] }), SurveyValidationError)
})

test('legacy selections default to Interested without changing order or inventing ranks', () => {
  const normalized = validateSurveyAnswers(full)
  assert.deepEqual(normalized.subtopic_priorities, { 'technology:ai-data': 2, 'arts:music': 2 })
  assert.deepEqual(normalized.subtopic_ids, full.subtopic_ids)
})
test('equal priorities across categories and mixed tiers are accepted', () => {
  const answers = { ...full, topic_ids: ['technology', 'arts'], subtopic_ids: ['technology:ai-data', 'arts:music', 'technology:robotics'], subtopic_priorities: { 'technology:ai-data': 1, 'arts:music': 1, 'technology:robotics': 3 } }
  assert.deepEqual(validateSurveyAnswers(answers).subtopic_priorities, answers.subtopic_priorities)
  assert.deepEqual(validateSurveyAnswers({ ...full, subtopic_priorities: { 'technology:ai-data': 1 } }).subtopic_priorities, { 'technology:ai-data': 1, 'arts:music': 2 })
})
for (const value of [null, [], '1', 1, { 'technology:ai-data': 0 }, { 'technology:ai-data': 4 }, { 'technology:ai-data': '1' }, { 'technology:ai-data': true }, { 'technology:robotics': 1 }]) {
  test(`reject malformed or unselected priorities: ${JSON.stringify(value)}`, () => {
    assert.throws(() => validateSurveyAnswers({ ...full, subtopic_priorities: value }), SurveyValidationError)
  })
}
test('removing a child, parent or all details clears only the relevant priorities', () => {
  const base = { ...full, subtopic_priorities: { 'technology:ai-data': 1 as const, 'arts:music': 3 as const } }
  assert.deepEqual(withSubtopicPriorities({ ...base, topic_ids: ['arts'], subtopic_ids: ['arts:music'] }).subtopic_priorities, { 'arts:music': 3 })
  assert.deepEqual(withSubtopicPriorities({ ...base, subtopic_ids: [] }).subtopic_priorities, {})
  assert.deepEqual(withSubtopicPriorities({ ...base, subtopic_ids: ['arts:music', 'technology:robotics'] }).subtopic_priorities, { 'arts:music': 3, 'technology:robotics': 2 })
})
test('PUT passes priorities through to storage and returns them without applying scores', async () => {
  const { handlers, calls } = setup()
  const response = await handlers.PUT(request('PUT', { ...full, subtopic_priorities: { 'technology:ai-data': 1, 'arts:music': 3 } }))
  assert.equal(response.status, 200)
  assert.deepEqual(calls[0].answers?.subtopic_priorities, { 'technology:ai-data': 1, 'arts:music': 3 })
  assert.deepEqual((await response.json()).profile.answers.subtopic_priorities, calls[0].answers?.subtopic_priorities)
})
