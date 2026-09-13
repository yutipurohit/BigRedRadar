import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, googleClientId, userFromToken, getFollows } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const jar = await cookies()
  const user = await userFromToken(jar.get(COOKIE_NAME)?.value)

  return NextResponse.json({
    googleClientId: googleClientId(),
    user,
    follows: user ? await getFollows(user.id) : [],
  })
}
