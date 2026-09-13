import crypto from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { sql } from './db'

export const COOKIE_NAME = 'brr_session'
export const SESSION_DAYS = 60

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? ''
const google = new OAuth2Client(CLIENT_ID)

export function googleClientId(): string {
  return CLIENT_ID
}

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export type SessionUser = {
  id: number
  email: string
  name: string | null
  picture_url: string | null
  is_cornell: boolean
}

export async function signInWithGoogle(credential: string) {
  if (!CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is not set on this server')

  const ticket = await google.verifyIdToken({ idToken: credential, audience: CLIENT_ID })
  const p = ticket.getPayload()

  if (!p?.sub || !p.email) throw new Error('Google did not return an email')
  if (p.email_verified === false) throw new Error('That Google account has an unverified email')

  const isCornell = p.email.toLowerCase().endsWith('@cornell.edu')

  const rows = await sql`
    insert into users (google_sub, email, name, picture_url, is_cornell)
    values (${p.sub}, ${p.email}, ${p.name ?? null}, ${p.picture ?? null}, ${isCornell})
    on conflict (google_sub) do update set
      email        = excluded.email,
      name         = excluded.name,
      picture_url  = excluded.picture_url,
      is_cornell   = excluded.is_cornell,
      last_seen_at = now()
    returning id, email, name, picture_url, is_cornell
  `

  const user = rows[0] as unknown as SessionUser
  const token = crypto.randomBytes(32).toString('base64url')

  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (${hash(token)}, ${user.id}, now() + interval '60 days')
  `

  return { user, token }
}

export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null

  const rows = await sql`
    select u.id, u.email, u.name, u.picture_url, u.is_cornell
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${hash(token)}
      and s.expires_at > now()
  `

  return (rows[0] as unknown as SessionUser) ?? null
}

export async function signOut(token: string | undefined) {
  if (!token) return
  await sql`delete from sessions where token_hash = ${hash(token)}`
}

export async function getFollows(userId: number): Promise<string[]> {
  const rows = await sql`
    select o.slug
    from subscriptions sub
    join organizations o on o.id = sub.org_id
    where sub.user_id = ${userId}
    order by o.slug
  `

  return rows.map((r) => String(r.slug))
}

export async function setFollows(userId: number, slugs: string[]): Promise<string[]> {
  const clean = [...new Set(slugs.map((s) => String(s).trim()).filter(Boolean))].slice(0, 500)

  await sql.begin(async (tx) => {
    await tx`delete from subscriptions where user_id = ${userId}`

    if (clean.length) {
      await tx`
        insert into subscriptions (user_id, org_id)
        select ${userId}, o.id from organizations o where o.slug = any(${clean})
        on conflict do nothing
      `
    }
  })

  return getFollows(userId)
}

export async function purgeExpiredSessions() {
  await sql`delete from sessions where expires_at < now()`
}
