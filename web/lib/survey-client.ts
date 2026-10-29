import type { SurveyAnswers, SurveyProfile } from './survey'

export class SurveyRequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message) }
}
export async function requestSurvey(method: 'GET' | 'PUT' | 'POST', body?: SurveyAnswers | { action: 'skip' }): Promise<SurveyProfile> {
  const response = await fetch('/api/profile/survey', {
    method, credentials: 'include', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new SurveyRequestError(response.status, data?.error || 'Survey request failed')
  if (!data?.profile || !['not_started', 'skipped', 'completed'].includes(data.profile.status)) {
    throw new Error('Unexpected survey response')
  }
  return data.profile
}
