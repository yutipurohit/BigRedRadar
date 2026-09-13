import Link from 'next/link'
import { fmtTime, gcalUrl } from '@/lib/dates'
import type { EventItem } from '@/lib/types'

export default function EventRow({ e, showOrg = true }: { e: EventItem; showOrg?: boolean }) {
  const when = new Date(e.starts_at)

  const time = e.time_tba
    ? <div className="time allday">Time TBA</div>
    : e.all_day
      ? <div className="time allday">All Day</div>
      : <div className="time">{fmtTime.format(when)}</div>

  return (
    <div className="event">
      {time}

      <div>
        <a className="title" href={e.url || '#'} target="_blank" rel="noopener">{e.title}</a>

        <div className="meta">
          {showOrg && <Link href={`/clubs/${e.org_slug}`}>{e.org_name}</Link>}
          {e.location && <span className="where">{showOrg ? ' · ' : ''}{e.location}</span>}
        </div>
      </div>

      <a className="cal" href={gcalUrl(e)} target="_blank" rel="noopener">+ Cal</a>
    </div>
  )
}
