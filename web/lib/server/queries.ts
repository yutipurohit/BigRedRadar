import { sql } from './db'

export function parseSlugs(raw: string | null): string[] | null {
  if (!raw) return null

  const slugs = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return slugs.length ? slugs : null
}

export async function listOrgs() {
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

  return rows
}

export async function listEvents(slugs: string[] | null) {
  const rows = await sql`
    select
      e.id, e.title, e.starts_at, e.ends_at, e.all_day, e.time_tba,
      e.location, e.url, e.image_url,
      left(e.description, 400) as description,
      o.name as org_name, o.slug as org_slug, o.category as org_category
    from events e
    join organizations o on o.id = e.org_id
    where e.starts_at > now()
      and e.starts_at < now() + interval '60 days'
      and e.status = 'scheduled'
      and o.is_active
      ${slugs ? sql`and o.slug = any(${slugs})` : sql``}
    order by e.starts_at
    limit 4000
  `

  return rows
}

export async function listForCalendar(slugs: string[] | null) {
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

  return rows
}

export async function findOrg(slug: string) {
  const rows = await sql`
    select slug, name, category, is_student_org
    from organizations
    where slug = ${slug} and is_active
  `

  return rows[0] ?? null
}
