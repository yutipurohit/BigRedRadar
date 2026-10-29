import { SurveyValidationError, validateSurveyAnswers, type SurveyAnswers, type SurveyProfile } from '../survey'

type Dependencies = {
  currentUser: () => Promise<{ id: number } | null>
  get: (userId: number) => Promise<SurveyProfile>
  save: (userId: number, answers: SurveyAnswers) => Promise<SurveyProfile>
  skip: (userId: number) => Promise<SurveyProfile>
}
const headers = { 'Cache-Control': 'private, no-store' }
function json(body: unknown, status = 200) { return Response.json(body, { status, headers }) }

export function createSurveyHandlers(deps: Dependencies) {
  async function run(action: (userId: number) => Promise<Response>) {
    try {
      const user = await deps.currentUser()
      if (!user) return json({ error: 'not signed in' }, 401)
      return await action(user.id)
    } catch (error) {
      if (error instanceof SurveyValidationError) return json({ error: error.message }, 400)
      // Do not log answer content or return database details to clients.
      console.error('Survey request failed')
      return json({ error: 'Survey temporarily unavailable; please retry' }, 503)
    }
  }
  function checkWrite(request: Request): Response | null {
    const origin = request.headers.get('origin')
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json({ error: 'Cross-site requests are not allowed' }, 403)
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ error: 'Content-Type must be application/json' }, 415)
    }
    return null
  }
  async function body(request: Request): Promise<unknown> {
    // Bound the body even when Content-Length is absent or incorrect.
    const reader = request.body?.getReader()
    if (!reader) throw new SurveyValidationError('JSON body is required')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        throw new SurveyValidationError('JSON body exceeds 8192 bytes')
      }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    try { return JSON.parse(new TextDecoder().decode(bytes)) }
    catch { throw new SurveyValidationError('Invalid JSON body') }
  }
  return {
    GET: () => run(async id => json({ profile: await deps.get(id) })),
    PUT: (request: Request) => run(async id => {
      const invalid = checkWrite(request)
      if (invalid) return invalid
      const answers = validateSurveyAnswers(await body(request))
      return json({ profile: await deps.save(id, answers) })
    }),
    POST: (request: Request) => run(async id => {
      const invalid = checkWrite(request)
      if (invalid) return invalid
      const value = await body(request)
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== 1 || (value as { action?: unknown }).action !== 'skip') {
        throw new SurveyValidationError('Expected {"action":"skip"}')
      }
      return json({ profile: await deps.skip(id) })
    }),
  }
}
