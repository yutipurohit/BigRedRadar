import type { NextRequest } from 'next/server'
import { buildIcs } from '@/lib/server/ics'
import type { IcsEvent } from '@/lib/server/ics'
import { listForCalendar, parseSlugs } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const slugs = parseSlugs(request.nextUrl.searchParams.get('orgs'))
  const rows = await listForCalendar(slugs)
  const name = slugs ? `Big Red Radar (${slugs.length} clubs)` : 'Big Red Radar'

  return new Response(buildIcs(rows as unknown as IcsEvent[], name), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="bigredradar.ics"',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
