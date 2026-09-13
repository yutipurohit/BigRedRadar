import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { listEvents, parseSlugs } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const slugs = parseSlugs(request.nextUrl.searchParams.get('orgs'))
  return NextResponse.json({ events: await listEvents(slugs) })
}
