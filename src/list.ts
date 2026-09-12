import { sql } from './db'

const rows = await sql`
  select e.starts_at, e.all_day, e.title, e.location, o.name as org_name
  from events e
  join organizations o on o.id = e.org_id
  where e.starts_at > now()
  order by e.starts_at
  limit 25
`

const dateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
})

const dateOnly = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short', day: 'numeric',
})

console.log(`${rows.length} upcoming events\n`)

for (const r of rows) {
  const when = r.all_day
    ? dateOnly.format(r.starts_at) + ' (all day)'
    : dateTime.format(r.starts_at)

  console.log(`${when}  ${r.org_name}`)
  console.log(`    ${r.title}`)
  if (r.location) console.log(`    @ ${r.location}`)
  console.log()
}

await sql.end()