import { sql } from './db'

const rows = await sql`select now()`
console.log(rows)

await sql.end()