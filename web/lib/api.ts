const SERVER_BASE = process.env.API_BASE ?? 'https://bigredradar.onrender.com'

export function apiUrl(path: string) {
  return typeof window === 'undefined' ? `${SERVER_BASE}${path}` : `/api${path}`
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), { credentials: 'include' })
  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) throw new Error(`${path} returned ${res.status}`)
  return res.json() as Promise<T>
}

export function eventsPath(slugs?: string[]) {
  if (!slugs || !slugs.length) return '/events'
  return '/events?orgs=' + encodeURIComponent(slugs.join(','))
}
