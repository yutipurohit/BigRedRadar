import postgres from 'postgres'

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is missing')
}

const globals = globalThis as unknown as { brrSql?: ReturnType<typeof postgres> }

export const sql =
  globals.brrSql ??
  postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  })

globals.brrSql = sql
