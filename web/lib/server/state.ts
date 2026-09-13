import { sql } from './db'
import type { IngestResult } from './ingest'

export type RefreshRecord = {
  startedAt: string
  finishedAt?: string
  result?: IngestResult
  error?: string
}

const STALE_MINUTES = 10

export async function readRefresh(): Promise<RefreshRecord | null> {
  const rows = await sql`select value from app_state where key = 'last_refresh'`
  return (rows[0]?.value as RefreshRecord) ?? null
}

export async function writeRefresh(record: RefreshRecord) {
  await sql`
    insert into app_state (key, value, updated_at)
    values ('last_refresh', ${sql.json(record as never)}, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `
}

export function isRunning(record: RefreshRecord | null): boolean {
  if (!record || record.finishedAt) return false

  const age = Date.now() - new Date(record.startedAt).getTime()
  return age < STALE_MINUTES * 60 * 1000
}
