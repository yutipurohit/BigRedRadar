import { sql } from './db'
import { fetchAllLocalist, LOCALIST_FEED } from './sources/localist'
import type { ParsedEvent } from './sources/localist'
import { fetchCampusGroups, CAMPUSGROUPS_FEED } from './sources/campusgroups'

function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return s || 'unknown'
}

const orgCache = new Map<string, number>()

async function getOrgId(name: string): Promise<number> {
  const hit = orgCache.get(name)
  if (hit !== undefined) return hit

  const rows = await sql`
    insert into organizations (slug, name)
    values (${slugify(name)}, ${name})
    on conflict (slug) do update set name = excluded.name
    returning id
  `

  const id = Number(rows[0].id)
  orgCache.set(name, id)
  return id
}

async function getSourceId(orgId: number, kind: string, url: string): Promise<number> {
  const rows = await sql`
    insert into sources (org_id, kind, url)
    values (${orgId}, ${kind}, ${url})
    on conflict (org_id, url) do update set is_enabled = true
    returning id
  `

  return Number(rows[0].id)
}

async function saveEvents(rows: Record<string, unknown>[]) {
  const CHUNK = 500

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)

    await sql`
      insert into events ${sql(
        chunk,
        'org_id', 'source_id', 'external_id', 'title', 'description',
        'starts_at', 'ends_at', 'all_day', 'location', 'url', 'image_url'
      )}
      on conflict (source_id, external_id) do update set
        org_id       = excluded.org_id,
        title        = excluded.title,
        description  = excluded.description,
        starts_at    = excluded.starts_at,
        ends_at      = excluded.ends_at,
        all_day      = excluded.all_day,
        location     = excluded.location,
        url          = excluded.url,
        image_url    = excluded.image_url,
        last_seen_at = now(),
        updated_at   = now()
    `
  }
}

async function retireVanished(sourceId: number): Promise<number> {
  const rows = await sql`
    update events
    set status = 'cancelled', updated_at = now()
    where source_id = ${sourceId}
      and status = 'scheduled'
      and starts_at > now()
      and last_seen_at < now() - interval '2 days'
    returning id
  `

  return rows.length
}

type SourceDef = {
  kind: 'localist' | 'ics' | 'website'
  url: string
  load: () => Promise<ParsedEvent[]>
}

const SOURCES: SourceDef[] = [
  { kind: 'localist', url: LOCALIST_FEED, load: () => fetchAllLocalist(60) },
  { kind: 'ics', url: CAMPUSGROUPS_FEED, load: fetchCampusGroups },
]

export type SourceResult = {
  kind: string
  parsed: number
  saved: number
  clubs: number
  retired: number
  error?: string
}

export type IngestResult = {
  ok: boolean
  seconds: number
  sources: SourceResult[]
}

export async function runIngest(log = console.log): Promise<IngestResult> {
  const started = Date.now()
  const results: SourceResult[] = []

  const catchAllOrgId = await getOrgId('Cornell Events')

  for (const src of SOURCES) {
    const sourceId = await getSourceId(catchAllOrgId, src.kind, src.url)
    const result: SourceResult = { kind: src.kind, parsed: 0, saved: 0, clubs: 0, retired: 0 }

    let events: ParsedEvent[]

    try {
      events = await src.load()
    } catch (err) {
      const msg = (err as Error).message
      result.error = msg
      results.push(result)
      log(`${src.kind}: FAILED - ${msg}`)

      await sql`
        update sources
        set last_status = ${msg.slice(0, 200)}, last_fetched_at = now()
        where id = ${sourceId}
      `
      continue
    }

    result.parsed = events.length

    const seen = new Set<string>()
    const unique = events.filter((e) => {
      if (seen.has(e.externalId)) return false
      seen.add(e.externalId)
      return true
    })

    const names = [...new Set(unique.map((e) => e.groupName).filter(Boolean))] as string[]
    for (const name of names) await getOrgId(name)
    result.clubs = names.length

    const rows = unique.map((e) => ({
      org_id: e.groupName ? orgCache.get(e.groupName)! : catchAllOrgId,
      source_id: sourceId,
      external_id: e.externalId,
      title: e.title,
      description: e.description,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      all_day: e.allDay,
      location: e.location,
      url: e.url,
      image_url: e.imageUrl,
    }))

    await saveEvents(rows)
    result.saved = rows.length

    if (rows.length > 10) {
      result.retired = await retireVanished(sourceId)
    }

    await sql`
      update sources
      set last_status = 'ok', last_fetched_at = now()
      where id = ${sourceId}
    `

    log(`${src.kind}: ${result.saved} saved, ${result.clubs} clubs, ${result.retired} retired`)
    results.push(result)
  }

  return {
    ok: results.every((r) => !r.error),
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    sources: results,
  }
}
