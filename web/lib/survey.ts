import { CATEGORIES } from './categories'

export const TOPICS = [
  ['technology', 'Technology & engineering'], ['science', 'Science & research'],
  ['business', 'Business & entrepreneurship'], ['arts', 'Art, music & design'],
  ['media', 'Writing, film & media'], ['wellbeing', 'Sports, outdoors & wellbeing'],
  ['community', 'Culture & community'], ['service', 'Service & social impact'],
  ['policy', 'Politics & public policy'], ['games', 'Games, food & hobbies'],
] as const
type TopicId = typeof TOPICS[number][0]
export const SUBTOPICS: Record<TopicId, readonly (readonly [string, string])[]> = {
  technology: [['software', 'Software & app development'], ['ai-data', 'AI & data'], ['robotics', 'Robotics & electronics'], ['mechanical', 'Mechanical & aerospace engineering']],
  science: [['biology', 'Biology & life sciences'], ['health', 'Health & medicine'], ['chemistry', 'Chemistry & materials'], ['physics', 'Physics & astronomy'], ['environment', 'Environment & earth sciences']],
  business: [['startups', 'Startups'], ['finance', 'Finance & investing'], ['consulting', 'Consulting & strategy'], ['marketing', 'Marketing'], ['hospitality', 'Hospitality']],
  arts: [['visual-design', 'Visual arts & design'], ['music', 'Music'], ['dance', 'Dance'], ['theater', 'Theater & comedy'], ['fashion', 'Fashion']],
  media: [['writing', 'Creative writing'], ['journalism', 'Journalism'], ['film-photo', 'Film & photography'], ['publications', 'Publications'], ['broadcast', 'Podcasting & broadcasting']],
  wellbeing: [['team-sports', 'Team sports'], ['individual-sports', 'Individual sports'], ['outdoors', 'Hiking & outdoor adventure'], ['fitness', 'Fitness & movement'], ['mindfulness', 'Mindfulness & wellbeing']],
  community: [['exchange', 'Cultural exchange'], ['languages', 'Languages'], ['international', 'International community'], ['heritage', 'Identity & heritage'], ['faith', 'Faith & spirituality']],
  service: [['mentoring', 'Education & mentoring'], ['volunteering', 'Community service'], ['sustainability', 'Sustainability'], ['health-outreach', 'Health outreach'], ['accessibility', 'Advocacy & accessibility']],
  policy: [['law', 'Law & legal studies'], ['discussion', 'Policy discussion'], ['civic', 'Civic engagement'], ['international-affairs', 'International affairs'], ['organizing', 'Political organizing']],
  games: [['video-games', 'Video games & esports'], ['tabletop', 'Board games & tabletop RPGs'], ['food', 'Cooking & food'], ['fandom', 'Anime & fandom'], ['crafts', 'Crafts & making']],
}
const ALL_SUBTOPICS = TOPICS.flatMap(([topic, label]) => SUBTOPICS[topic].map(([id, detail]) => [`${topic}:${id}`, `${label} / ${detail}`] as const))
export const CLUB_TYPES = CATEGORIES.filter(([key]) => !['campus', 'residential', 'graduate'].includes(key))
export const GOALS = [
  ['friends', 'Meet people & find community'], ['learn', 'Learn or practice a skill'],
  ['career', 'Explore careers & build experience'], ['impact', 'Help others & support the community'],
  ['fun', 'Have fun & try something new'],
] as const
export const TIME = [
  ['under-1', 'Less than 1 hour'], ['1-3', '1–3 hours'],
  ['4-6', '4–6 hours'], ['7-plus', '7+ hours'],
] as const


export const INTEREST_PRIORITIES = [
  [1, 'Prioritize'], [2, 'Interested'], [3, 'Try sometime'],
] as const
export type InterestPriority = typeof INTEREST_PRIORITIES[number][0]
export const SURVEY_VERSION = 2 as const
export type SurveyAnswers = {
  survey_version: typeof SURVEY_VERSION
  topic_ids: string[]
  subtopic_ids: string[]
  // Optional on legacy v2 payloads. Missing entries mean priority 2.
  subtopic_priorities?: Record<string, InterestPriority>
  major_text: string | null
  // Legacy club-type preferences: retained for compatibility, no longer asked in the survey.
  club_category_ids: string[]
  goal_ids: string[]
  weekly_commitment: string | null
}
export type SurveyProfile = {
  status: 'not_started' | 'skipped' | 'completed'
  answers: SurveyAnswers | null
  completed_at: string | null
  skipped_at: string | null
  updated_at: string | null
}
export const EMPTY_SURVEY_PROFILE: SurveyProfile = {
  status: 'not_started', answers: null, completed_at: null, skipped_at: null, updated_at: null,
}
export class SurveyValidationError extends Error {}

export function withSubtopicPriorities(answers: SurveyAnswers): SurveyAnswers {
  return {
    ...answers,
    subtopic_priorities: Object.fromEntries(answers.subtopic_ids.map(id => [id, answers.subtopic_priorities?.[id] ?? 2])),
  }
}


// Reject malformed or unknown fields rather than silently replacing saved answers.
export function validateSurveyAnswers(input: unknown): SurveyAnswers {
  function invalid(message: string): never { throw new SurveyValidationError(message) }
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Expected an answers object')
  const value = input as Record<string, unknown>
  const fields = ['survey_version', 'topic_ids', 'subtopic_ids', 'major_text', 'club_category_ids', 'goal_ids', 'weekly_commitment']
  if (Object.keys(value).some(key => !fields.includes(key) && key !== 'subtopic_priorities')) invalid('Unknown answer field')
  if (fields.some(key => !Object.hasOwn(value, key))) invalid('All answer fields are required; use [] or null for no preference')
  if (value.survey_version !== SURVEY_VERSION) invalid('Unsupported survey_version; expected 2')
  function ids(key: string, allowed: readonly string[], limit?: number): string[] {
    const items = value[key]
    if (!Array.isArray(items) || (limit !== undefined && items.length > limit) || items.some(id => typeof id !== 'string' || !allowed.includes(id))) {
      invalid(limit === undefined ? `${key} must contain valid option IDs` : `${key} must contain at most ${limit} valid option IDs`)
    }
    if (new Set(items).size !== items.length) invalid(`${key} must not contain duplicates`)
    return [...items] as string[]
  }
  const topics = ids('topic_ids', TOPICS.map(([id]) => id), 5)
  const subtopics = ids('subtopic_ids', ALL_SUBTOPICS.map(([id]) => id))
  if (subtopics.some(id => !topics.includes(id.split(':')[0]))) invalid('Detailed interests must belong to selected topics')
  const priorities: Record<string, InterestPriority> = Object.fromEntries(subtopics.map(id => [id, 2]))
  if (Object.hasOwn(value, 'subtopic_priorities')) {
    const supplied = value.subtopic_priorities
    if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) invalid('subtopic_priorities must be an object')
    for (const [id, priority] of Object.entries(supplied)) {
      if (!subtopics.includes(id)) invalid('Priorities must refer to selected detailed interests')
      if (priority !== 1 && priority !== 2 && priority !== 3) invalid('Priority must be the number 1, 2 or 3')
      priorities[id] = priority
    }
  }

  if (value.major_text !== null && (typeof value.major_text !== 'string' || value.major_text.length > 100)) {
    invalid('major_text must be null or a string of at most 100 characters')
  }
  if (value.weekly_commitment !== null && !TIME.some(([id]) => id === value.weekly_commitment)) {
    invalid('Invalid weekly_commitment')
  }
  return {
    survey_version: SURVEY_VERSION,
    topic_ids: topics,
    subtopic_ids: subtopics,
    subtopic_priorities: priorities,
    major_text: typeof value.major_text === 'string' ? value.major_text.trim() || null : null,
    club_category_ids: ids('club_category_ids', CLUB_TYPES.map(([id]) => id), 3),
    goal_ids: ids('goal_ids', GOALS.map(([id]) => id), 2),
    weekly_commitment: value.weekly_commitment as string | null,
  }
}
