import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE_NAME, signOut } from '@/lib/server/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const jar = await cookies()
  await signOut(jar.get(COOKIE_NAME)?.value)

  const res = NextResponse.json({ ok: true })
  res.cookies.set({ name: COOKIE_NAME, value: '', path: '/', maxAge: 0 })
  return res
}
