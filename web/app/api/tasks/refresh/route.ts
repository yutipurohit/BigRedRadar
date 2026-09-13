import { NextResponse, after } from 'next/server'
import type { NextRequest } from 'next/server'
import { runIngest } from '@/lib/server/ingest'
import { readRefresh, writeRefresh, isRunning } from '@/lib/server/state'
import type { RefreshRecord } from '@/lib/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function handle(request: NextRequest) {
  const secret = process.env.REFRESH_TOKEN

  if (!secret) {
    return NextResponse.json({ error: 'REFRESH_TOKEN is not set on this server' }, { status: 503 })
  }

  const given =
    request.headers.get('x-refresh-token') ?? request.nextUrl.searchParams.get('token')

  if (given !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const previous = await readRefresh()

  if (isRunning(previous)) {
    return NextResponse.json(
      { started: false, reason: 'already running', lastRefresh: previous },
      { status: 202 },
    )
  }

  const record: RefreshRecord = { startedAt: new Date().toISOString() }
  await writeRefresh(record)

  after(async () => {
    try {
      record.result = await runIngest()
    } catch (err) {
      console.error(err)
      record.error = (err as Error).message
    }

    record.finishedAt = new Date().toISOString()
    await writeRefresh(record)
  })

  return NextResponse.json({ started: true, checkAt: '/api/health' }, { status: 202 })
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
