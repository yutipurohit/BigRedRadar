import { runIngest } from '../lib/server/ingest'
import { sql } from '../lib/server/db'

async function main() {
  const result = await runIngest()

  const summary = await sql`
    select o.name, count(*)::int as n
    from events e
    join organizations o on o.id = e.org_id
    where e.starts_at > now() and e.status = 'scheduled'
    group by o.name
    order by n desc
    limit 20
  `

  console.log('\ntop orgs by upcoming events:')
  for (const r of summary) {
    console.log(`   ${String(r.n).padStart(4)}  ${r.name}`)
  }

  console.log(`\ndone in ${result.seconds}s`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => sql.end())
