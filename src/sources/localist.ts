export type ParsedEvent = {
  externalId: string
  title: string
  description: string
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  location: string | null
  url: string | null
  imageUrl: string | null
  groupName: string | null
}

export const LOCALIST_FEED = 'https://events.cornell.edu/api/2/events'

function decodeEntities(s: string): string {
  if (!s) return s
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export async function fetchLocalist(days = 30, perPage = 100, page = 1) {
  const url = `${LOCALIST_FEED}?days=${days}&pp=${perPage}&page=${page}`

  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Cornell said ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function fetchAllLocalist(
  days = 60,
  perPage = 100,
  maxPages = 25,
): Promise<ParsedEvent[]> {
  const all: ParsedEvent[] = []

  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchLocalist(days, perPage, page)
    const count = data?.events?.length ?? 0

    all.push(...parseLocalist(data))

    if (count < perPage) break

    // Don't hammer Cornell's server. A quarter second between pages.
    await new Promise((r) => setTimeout(r, 250))
  }

  return all
}

export function parseLocalist(data: any): ParsedEvent[] {
  const results: ParsedEvent[] = []

  for (const item of data.events ?? []) {
    const ev = item.event
    if (!ev) continue

    if (ev.status !== 'live') continue

    for (const box of ev.event_instances ?? []) {
      const inst = box.event_instance
      if (!inst || !inst.start) continue

      results.push({
        externalId: String(inst.id),
        title: decodeEntities(ev.title),
        description: decodeEntities(ev.description_text ?? ''),
        startsAt: new Date(inst.start),
        endsAt: inst.end ? new Date(inst.end) : null,
        allDay: Boolean(inst.all_day),
        location: ev.location_name || ev.address || null,
        url: ev.localist_url ?? null,
        imageUrl: ev.photo_url ?? null,
        groupName: ev.groups?.[0]?.name ?? null,
      })
    }
  }

  return results
}
