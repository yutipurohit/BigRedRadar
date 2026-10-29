import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required. Configure web/.env.local first.')
    process.exitCode = 1
    return
  }
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15 })
  try {
    const migration = await readFile(resolve(__dirname, '../../db/migrations/009_survey_profiles.sql'), 'utf8')
    await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(922603009)`
      await tx.unsafe(migration)
      await tx`select user_id, status, answers, completed_at, skipped_at, updated_at from user_survey_profiles limit 0`
    })
    console.log('Survey migration 009 applied successfully.')
  } catch (error) {
    const code = (error as { code?: string }).code
    console.error('Survey migration failed' + (code ? ' (' + code + ')' : '') + '. Verify database access and apply earlier migrations first. No changes from this transaction were committed.')
    process.exitCode = 1
  } finally {
    await sql.end({ timeout: 5 })
  }
}
void main().catch(() => { console.error('Survey migration could not finish.'); process.exitCode = 1 })
