import { NextResponse } from 'next/server'
import { listOrgs } from '@/lib/server/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ orgs: await listOrgs() })
}
