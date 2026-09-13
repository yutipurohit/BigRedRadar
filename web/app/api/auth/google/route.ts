import { NextResponse } from 'next/server'
import { signInWithGoogle, getFollows } from '@/lib/server/auth'
import { sessionCookie } from '@/lib/server/cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const credential = (body as { credential?: string } | null)?.credential

  if (!credential) {
    return NextResponse.json({ error: 'missing credential' }, { status: 400 })
  }

  try {
    const { user, token } = await signInWithGoogle(credential)

    const res = NextResponse.json({ user, follows: await getFollows(user.id) })
    res.cookies.set(sessionCookie(token))
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'sign in failed' }, { status: 401 })
  }
}
