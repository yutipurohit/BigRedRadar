import { sql } from './db'
import { fetchLocalist, parseLocalist, LOCALIST_FEED } from './sources/localist'
import type { ParsedEvent } from './sources/localist'
import { fetchCampusGroups, CAMPUSGROUPS_FEED } from './sources/campusgroups'

// "Cornell Data Science" -> "cornell-data-science"
function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return s || 'unknown'
}

// Remember club ids we've already looked up, so we ask the database once per
// club instead of once per event.
const orgCache = new Map<string, number>()

async function getOrgId(name: string): Promise<number> {
  const hit = orgCache.get(name)
  if (hit !== undefined) return hit

  const slug = slugify(name)

  const rows = await sql`
    insert into organizations (slug, name)
    values (${slug}, ${name})
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

// Write many events in one trip instead of one at a time.
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

type SourceDef = {
  kind: 'localist' | 'ics' | 'website'
  url: string
  load: () => Promise<ParsedEvent[]>
}

const SOURCES: SourceDef[] = [
  {
    kind: 'localist',
    url: LOCALIST_FEED,
    load: async () => parseLocalist(await fetchLocalist(60, 100, 1)),
  },
  {
    kind: 'ics',
    url: CAMPUSGROUPS_FEED,
    load: fetchCampusGroups,
  },
]

async function main() {
  const started = Date.now()

  // Both feeds cover the whole university, so they hang off a catch-all org.
  // Each event still gets its REAL club from the group / organizer name.
  const catchAllOrgId = await getOrgId('Cornell Events')

  for (const src of SOURCES) {
    const sourceId = await getSourceId(catchAllOrgId, src.kind, src.url)
    console.log(`\n--- ${src.kind}`)

    let events: ParsedEvent[]

    try {
      events = await src.load()
    } catch (err) {
      // One broken source must not kill the whole run.
      const msg = (err as Error).message
      console.error(`    FAILED: ${msg}`)
      await sql`
        update sources
        set last_status = ${msg.slice(0, 200)}, last_fetched_at = now()
        where id = ${sourceId}
      `
      continue
    }

    console.log(`    parsed ${events.length}`)

    // A feed can list the same id twice. Postgres refuses to update the same
    // row twice in one statement, so drop repeats before we batch them up.
    const seen = new Set<string>()
    const unique = events.filter((e) => {
      if (seen.has(e.externalId)) return false
      seen.add(e.externalId)
      return true
    })

    if (unique.length !== events.length) {
      console.log(`    ${events.length - unique.length} duplicate ids dropped`)
    }

    // Look up every club ONCE, not once per event.
    const names = [...new Set(unique.map((e) => e.groupName).filter(Boolean))] as string[]
    for (const name of names) await getOrgId(name)
    console.log(`    ${names.length} clubs`)

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

    await sql`
      update sources
      set last_status = 'ok', last_fetched_at = now()
      where id = ${sourceId}
    `

    console.log(`    saved ${rows.length}`)
  }

  // Who actually posts events?
  const summary = await sql`
    select o.name, count(*)::int as n
    from events e
    join organizations o on o.id = e.org_id
    where e.starts_at > now()
    group by o.name
    order by n desc
    limit 20
  `

  console.log('\ntop orgs by upcoming events:')
  for (const r of summary) {
    console.log(`   ${String(r.n).padStart(4)}  ${r.name}`)
  }

  console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  await sql.end()
}

main().catch(async (err) => {
  console.error(err)
  await sql.end()
  process.exit(1)
})
