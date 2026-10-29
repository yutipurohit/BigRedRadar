import type postgres from 'postgres'
import { EMPTY_SURVEY_PROFILE, withSubtopicPriorities, type SurveyAnswers, type SurveyProfile } from '../survey'

type ProfileRow = {
  status: 'skipped' | 'completed'
  answers: SurveyAnswers | null
  completed_at: Date | null
  skipped_at: Date | null
  updated_at: Date
}
function profile(row: ProfileRow): SurveyProfile {
  return {
    status: row.status, answers: row.answers ? withSubtopicPriorities(row.answers) : null,
    completed_at: row.completed_at?.toISOString() ?? null,
    skipped_at: row.skipped_at?.toISOString() ?? null,
    updated_at: row.updated_at.toISOString(),
  }
}
export function createSurveyStore(sql: ReturnType<typeof postgres>) {
async function getSurveyProfile(userId: number): Promise<SurveyProfile> {
  const rows = await sql<ProfileRow[]>`
    select status, answers, completed_at, skipped_at, updated_at
    from user_survey_profiles where user_id = ${userId}
  `
  return rows[0] ? profile(rows[0]) : { ...EMPTY_SURVEY_PROFILE }
}
async function saveSurveyProfile(userId: number, answers: SurveyAnswers): Promise<SurveyProfile> {
  const rows = await sql<ProfileRow[]>`
    insert into user_survey_profiles (user_id, status, answers, completed_at)
    values (${userId}, 'completed', ${sql.json(withSubtopicPriorities(answers))}, now())
    on conflict (user_id) do update set
      status = 'completed',
      -- Club types are no longer editable in the survey. Preserve legacy values
      -- atomically, even if a guest draft or stale client submits an empty list.
      answers = jsonb_set(excluded.answers, '{club_category_ids}',
        coalesce(user_survey_profiles.answers -> 'club_category_ids',
                 excluded.answers -> 'club_category_ids', '[]'::jsonb)),
      completed_at = coalesce(user_survey_profiles.completed_at, excluded.completed_at),
      updated_at = now()
    returning status, answers, completed_at, skipped_at, updated_at
  `
  return profile(rows[0])
}
async function skipSurveyProfile(userId: number): Promise<SurveyProfile> {
  const rows = await sql<ProfileRow[]>`
    insert into user_survey_profiles (user_id, status, skipped_at)
    values (${userId}, 'skipped', now())
    on conflict (user_id) do update set skipped_at = now(), updated_at = now()
    returning status, answers, completed_at, skipped_at, updated_at
  `
  return profile(rows[0])
}

return { getSurveyProfile, saveSurveyProfile, skipSurveyProfile }
}
