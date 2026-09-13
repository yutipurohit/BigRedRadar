import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, userFromToken, setFollows } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  const jar = await cookies()
  const user = await userFromToken(jar.get(COOKIE_NAME)?.value)

  if (!user) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const slugs = (body as { slugs?: unknown } | null)?.slugs

  if (!Array.isArray(slugs)) {
    return NextResponse.json({ error: 'slugs must be a list' }, { status: 400 })
  }

  return NextResponse.json({ follows: await setFollows(user.id, slugs as string[]) })
}
