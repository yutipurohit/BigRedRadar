// Builds a .ics calendar file - the format Google/Apple/Outlook subscribe to.

export type IcsEvent = {
  id: number | string
  title: string
  description?: string | null
  starts_at: Date
  ends_at?: Date | null
  all_day: boolean
  location?: string | null
  url?: string | null
  org_name?: string | null
}

const ITHACA = 'America/New_York'

// In .ics, these characters have meaning, so they must be escaped in any text.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// 2026-09-16T23:00:00.000Z  ->  20260916T230000Z
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// An all-day event is a DATE, not a moment - and it's the date in Ithaca.
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ITHACA, year: 'numeric', month: '2-digit', day: '2-digit',
})

function dateStamp(d: Date): string {
  return dayFormatter.format(d).replace(/-/g, '')
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000)
}

// The spec says lines wrap at 75 characters, continued by a leading space.
// Some calendar apps genuinely choke on long unwrapped lines.
function fold(line: string): string {
  if (line.length <= 74) return line

  const parts: string[] = [line.slice(0, 74)]
  let rest = line.slice(74)

  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73))
    rest = rest.slice(73)
  }

  if (rest.length) parts.push(' ' + rest)
  return parts.join('\r\n')
}

export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Big Red Radar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calendarName)}`,
    `X-WR-TIMEZONE:${ITHACA}`,
    // Hint to subscribers: re-check every 3 hours.
    'REFRESH-INTERVAL;VALUE=DURATION:PT3H',
    'X-PUBLISHED-TTL:PT3H',
  ]

  const now = utcStamp(new Date())

  for (const e of events) {
    const start = new Date(e.starts_at)

    lines.push('BEGIN:VEVENT')
    // Must be stable: the same event must keep the same UID forever, or
    // subscribers will see it vanish and reappear as a new event.
    lines.push(`UID:brr-${e.id}@bigredradar`)
    lines.push(`DTSTAMP:${now}`)

    if (e.all_day) {
      // DTEND on an all-day event is exclusive - the day AFTER it ends.
      const end = e.ends_at ? new Date(e.ends_at) : addDays(start, 1)
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`)
      lines.push(`DTEND;VALUE=DATE:${dateStamp(end)}`)
    } else {
      lines.push(`DTSTART:${utcStamp(start)}`)
      // No end time? Assume an hour, for display only. We never wrote this
      // guess into the database - it lives here, at the edge.
      const end = e.ends_at ? new Date(e.ends_at) : new Date(start.getTime() + 60 * 60 * 1000)
      lines.push(`DTEND:${utcStamp(end)}`)
    }

    const title = e.org_name ? `${e.title} (${e.org_name})` : e.title
    lines.push(fold(`SUMMARY:${esc(title)}`))

    if (e.location) lines.push(fold(`LOCATION:${esc(e.location)}`))
    if (e.url) lines.push(fold(`URL:${esc(e.url)}`))

    if (e.description) {
      const short = e.description.length > 800
        ? e.description.slice(0, 800) + '...'
        : e.description
      lines.push(fold(`DESCRIPTION:${esc(short)}`))
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // The spec requires CRLF line endings, not plain newlines.
  return lines.join('\r\n') + '\r\n'
}
