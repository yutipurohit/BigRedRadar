import EventRow from './EventRow'
import { fmtKey, fmtMonth, fmtWkLong } from '@/lib/dates'
import type { EventItem } from '@/lib/types'

export default function GroupedList({ events, showOrg = true }: { events: EventItem[]; showOrg?: boolean }) {
  const out: React.ReactNode[] = []
  let day: string | null = null

  for (const e of events) {
    const when = new Date(e.starts_at)
    const key = fmtKey.format(when)

    if (key !== day) {
      day = key
      out.push(
        <div className="minidate" key={`d-${key}`}>
          {fmtWkLong.format(when)} · {fmtMonth.format(when)} {when.getUTCDate()}
        </div>
      )
    }

    out.push(<EventRow e={e} showOrg={showOrg} key={e.id} />)
  }

  return <>{out}</>
}
