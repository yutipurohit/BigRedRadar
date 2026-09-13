import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from './db'
import { buildIcs } from './ics'
import { runIngest } from './ingest'
import type { IngestResult } from './ingest'

const here = path.dirname(fileURLToPath(import.meta.url))

const app = Fastify({ logger: true })

app.register(fastifyStatic, {
  root: path.join(here, '..', 'public'),
})

app.get('/health', async () => {
  return { ok: true, refreshing, lastRefresh }
})

app.get('/orgs', async () => {
  const rows = await sql`
    select
      o.slug,
      o.name,
      o.category,
      o.is_student_org,
      count(e.id)::int as upcoming
    from organizations o
    join events e
      on e.org_id = o.id
     and e.starts_at > now()
     and e.status = 'scheduled'
    where o.is_active
    group by o.slug, o.name, o.category, o.is_student_org
    order by upcoming desc, o.name
  `

  return { orgs: rows }
})

function parseSlugs(query: unknown): string[] | null {
  const raw = (query as { orgs?: string })?.orgs
  if (!raw) return null

  const slugs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return slugs.length ? slugs : null
}

app.get('/events', async (req) => {
  const slugs = parseSlugs(req.query)

  const rows = await sql`
    select
      e.id, e.title, e.starts_at, e.ends_at, e.all_day,
      e.location, e.url, e.image_url,
      -- trimmed: the page only needs enough to prefill a calendar entry
      left(e.description, 400) as description,
      o.name as org_name, o.slug as org_slug, o.category as org_category
    from events e
    join organizations o on o.id = e.org_id
    where e.starts_at > now()
      and e.status = 'scheduled'
      and o.is_active
      ${slugs ? sql`and o.slug = any(${slugs})` : sql``}
    order by e.starts_at
    limit 500
  `

  return { events: rows }
})

app.get('/calendar.ics', async (req, reply) => {
  const slugs = parseSlugs(req.query)

  const rows = await sql`
    select
      e.id, e.title, e.description, e.starts_at, e.ends_at, e.all_day,
      e.location, e.url,
      o.name as org_name
    from events e
    join organizations o on o.id = e.org_id
    where e.starts_at > now() - interval '1 day'
      and e.status = 'scheduled'
      and o.is_active
      ${slugs ? sql`and o.slug = any(${slugs})` : sql``}
    order by e.starts_at
    limit 2000
  `

  const name = slugs ? `Big Red Radar (${slugs.length} clubs)` : 'Big Red Radar'

  reply.header('Content-Type', 'text/calendar; charset=utf-8')
  reply.header('Content-Disposition', 'inline; filename="bigredradar.ics"')
  reply.header('Cache-Control', 'public, max-age=1800')

  return buildIcs(rows as any, name)
})

type RefreshRecord = {
  startedAt: string
  finishedAt?: string
  result?: IngestResult
  error?: string
}

let refreshing = false
let lastRefresh: RefreshRecord | null = null

async function handleRefresh(req: any, reply: any) {
  const secret = process.env.REFRESH_TOKEN

  if (!secret) {
    return reply.code(503).send({ error: 'REFRESH_TOKEN is not set on this server' })
  }

  const given = req.headers['x-refresh-token'] ?? req.query?.token

  if (given !== secret) {
    return reply.code(401).send({ error: 'unauthorized' })
  }

  if (refreshing) {
    return reply.code(202).send({ started: false, reason: 'already running', lastRefresh })
  }

  refreshing = true
  const record: RefreshRecord = { startedAt: new Date().toISOString() }
  lastRefresh = record

  runIngest((msg) => app.log.info(msg))
    .then((result) => {
      record.result = result
    })
    .catch((err) => {
      app.log.error(err)
      record.error = (err as Error).message
    })
    .finally(() => {
      record.finishedAt = new Date().toISOString()
      refreshing = false
    })

  return reply.code(202).send({ started: true, checkAt: '/health' })
}

app.post('/tasks/refresh', handleRefresh)
app.get('/tasks/refresh', handleRefresh)   

const port = Number(process.env.PORT ?? 3000)

app.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
  console.log(`listening on ${address}`)
})
