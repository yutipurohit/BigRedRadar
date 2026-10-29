import { cookies } from 'next/headers'
import { COOKIE_NAME, userFromToken } from '@/lib/server/auth'
import { getSurveyProfile, saveSurveyProfile, skipSurveyProfile } from '@/lib/server/survey'
import { createSurveyHandlers } from '@/lib/server/survey-handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handlers = createSurveyHandlers({
  currentUser: async () => {
    const jar = await cookies()
    return userFromToken(jar.get(COOKIE_NAME)?.value)
  },
  get: getSurveyProfile,
  save: saveSurveyProfile,
  skip: skipSurveyProfile,
})
export const GET = handlers.GET
export const PUT = handlers.PUT
export const POST = handlers.POST
