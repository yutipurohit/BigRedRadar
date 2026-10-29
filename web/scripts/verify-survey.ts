import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { createSurveyStore } from '../lib/server/survey-store'
import { EMPTY_SURVEY_PROFILE, validateSurveyAnswers } from '../lib/survey'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 })
  const rollback = new Error('Rollback verification data')
  const prefix = 'survey-check-' + randomUUID()
  try {
    try {
      await sql.begin(async tx => {
        const users = await tx`
          insert into users (google_sub, email, name, is_cornell)
          values (${prefix + '-a'}, 'survey-check-a@example.invalid', 'Survey verification', false),
                 (${prefix + '-b'}, 'survey-check-b@example.invalid', 'Survey verification', false)
          returning id
        `
        const a = Number(users[0].id), b = Number(users[1].id)
        const store = createSurveyStore(tx as unknown as ReturnType<typeof postgres>)
        assert.deepEqual(await store.getSurveyProfile(a), EMPTY_SURVEY_PROFILE)
        const skipped = await store.skipSurveyProfile(a)
        assert.equal(skipped.status, 'skipped')
        const answers = validateSurveyAnswers({
          survey_version: 2, topic_ids: ['technology', 'arts', 'policy', 'service'], subtopic_ids: ['technology:software', 'technology:ai-data', 'technology:robotics', 'technology:mechanical', 'arts:visual-design', 'arts:music', 'arts:dance', 'arts:theater', 'arts:fashion', 'policy:law', 'service:mentoring'],
          major_text: 'Verification only', club_category_ids: ['academic'], goal_ids: ['learn'], weekly_commitment: '1-3',
        })
        const first = await store.saveSurveyProfile(a, answers)
        assert.equal(first.status, 'completed')
        assert.deepEqual((await store.getSurveyProfile(a)).answers, answers)
        assert.deepEqual(await store.getSurveyProfile(b), EMPTY_SURVEY_PROFILE)
        const skippedAgain = await store.skipSurveyProfile(a)
        assert.equal(skippedAgain.status, 'completed')
        assert.deepEqual(skippedAgain.answers, answers)
        const prioritized = validateSurveyAnswers({ ...answers, subtopic_priorities: { ...answers.subtopic_priorities, 'technology:ai-data': 1, 'arts:music': 1, 'technology:software': 3 } })
        await store.saveSurveyProfile(a, prioritized)
        assert.deepEqual((await store.getSurveyProfile(a)).answers?.subtopic_priorities, prioritized.subtopic_priorities)
        assert.deepEqual((await store.skipSurveyProfile(a)).answers?.subtopic_priorities, prioritized.subtopic_priorities)
        // Simulate a stored legacy JSON object without the new optional field.
        const { subtopic_priorities: ignored, ...legacy } = answers
        await tx`update user_survey_profiles set answers = ${tx.json(legacy)} where user_id = ${a}`
        const legacyRead = await store.getSurveyProfile(a)
        assert.equal(Object.values(legacyRead.answers?.subtopic_priorities ?? {}).every(priority => priority === 2), true)
        assert.equal(Object.keys(legacyRead.answers?.subtopic_priorities ?? {}).length, answers.subtopic_ids.length)
        const edited = await store.saveSurveyProfile(a, { ...answers, club_category_ids: [], major_text: 'Updated verification' })
        assert.equal(edited.answers?.major_text, 'Updated verification')
        assert.deepEqual(edited.answers?.club_category_ids, ['academic'])
        const stale = await store.saveSurveyProfile(a, { ...answers, club_category_ids: ['sports'] })
        assert.deepEqual(stale.answers?.club_category_ids, ['academic'])
        assert.equal(edited.completed_at, first.completed_at)
        assert.equal((await tx`select count(*)::int as count from user_survey_profiles where user_id = ${a}`)[0].count, 1)
        await store.saveSurveyProfile(b, { ...answers, topic_ids: [], subtopic_ids: [], major_text: null, club_category_ids: [], goal_ids: [], weekly_commitment: null })
        assert.equal((await store.getSurveyProfile(b)).status, 'completed')
        assert.deepEqual((await store.getSurveyProfile(b)).answers?.club_category_ids, [])
        await tx`delete from users where id = ${a}`
        assert.deepEqual(await store.getSurveyProfile(a), EMPTY_SURVEY_PROFILE)
        throw rollback
      })
    } catch (error) { if (error !== rollback) throw error }
    const remaining = await sql`select count(*)::int as count from users where google_sub in (${prefix + '-a'}, ${prefix + '-b'})`
    assert.equal(remaining[0].count, 0)
    console.log('PASS: real database save/read/update, account isolation, skip preservation, empty answers, law/education choices, legacy club-type preservation, priority save/read/defaults and skip preservation, cascading deletion. Verification transaction rolled back; no test records retained.')
  } finally { await sql.end({ timeout: 5 }) }
}
void main().catch(error => {
  const code = (error as { code?: string }).code
  console.error('Survey database verification failed' + (code ? ' (' + code + ')' : '') + '. No verification transaction was committed.')
  process.exitCode = 1
})
