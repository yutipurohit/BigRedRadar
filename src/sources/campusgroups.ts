
import ical from 'node-ical'
import type { ParsedEvent } from './localist'

export const CAMPUSGROUPS_FEED =
  'https://cornell.campusgroups.com/ical/cornell/ical_cornell.ics'

// Identify ourselves. If we ever cause a problem, someone can email instead
// of just blocking us.
const USER_AGENT = 'BigRedRadar/0.1 (yutipurohit@gmail.com)'

export async function fetchIcs(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/calendar' },
  })

  if (!res.ok) {
    throw new Error(`${url} said ${res.status} ${res.statusText}`)
  }

  return res.text()
}

function decodeQuotedPrintable(s: string): string {
  const joined = s.replace(/=\r?\n/g, '') // soft line breaks
  const bytes: number[] = []

  for (let i = 0; i < joined.length; i++) {
    const pair = joined.slice(i + 1, i + 3)

    if (joined[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(pair)) {
      bytes.push(parseInt(pair, 16))
      i += 2
    } else {
      for (const b of Buffer.from(joined[i], 'utf8')) bytes.push(b)
    }
  }

  return Buffer.from(bytes).toString('utf8')
}

function text(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v

  if (typeof v === 'object' && 'val' in v) {
    const raw = String(v.val ?? '')
    const enc = String(v.params?.ENCODING ?? v.params?.encoding ?? '').toUpperCase()
    return enc === 'QUOTED-PRINTABLE' ? decodeQuotedPrintable(raw) : raw
  }

  return String(v)
}

function organizerName(raw: any): string | null {
  if (!raw) return null

  if (typeof raw === 'string') {
    const m = raw.match(/CN=("?)([^";:]+)\1/)
    return m ? m[2].trim() : null
  }

  const cn = raw.params?.CN ?? raw.params?.cn
  return cn ? String(cn).replace(/^"|"$/g, '').trim() : null
}

function cleanLocation(loc: any): string | null {
  const s = text(loc).trim()
  if (!s) return null
  if (/sign in to/i.test(s)) return null
  return s
}

export function parseIcs(raw: string): ParsedEvent[] {
  const data: any = ical.sync.parseICS(raw)
  const out: ParsedEvent[] = []

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  for (const key of Object.keys(data)) {
    const ev = data[key]

    if (!ev || ev.type !== 'VEVENT' || !ev.start) continue

    const start = new Date(ev.start)
    if (Number.isNaN(start.getTime()) || start < cutoff) continue

    const title = text(ev.summary).trim()
    const uid = text(ev.uid).trim()

    out.push({
      externalId: uid || `${start.toISOString()}|${title}`,
      title: title || 'Untitled event',
      description: text(ev.description).trim(),
      startsAt: start,
      endsAt: ev.end ? new Date(ev.end) : null,
      // node-ical marks date-only entries (no time of day) as 'date'
      allDay: ev.datetype === 'date',
      location: cleanLocation(ev.location),
      url: text(ev.url).trim() || null,
      imageUrl: null,
      groupName: organizerName(ev.organizer),
    })
  }

  return out
}

export async function fetchCampusGroups(): Promise<ParsedEvent[]> {
  return parseIcs(await fetchIcs(CAMPUSGROUPS_FEED))
}
