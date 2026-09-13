import { NextResponse } from 'next/server'
import { readRefresh, isRunning } from '@/lib/server/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const lastRefresh = await readRefresh()

  return NextResponse.json({
    ok: true,
    refreshing: isRunning(lastRefresh),
    lastRefresh,
  })
}
