'use client'

import { useMemo, useRef, useState } from 'react'
import EventRow from './EventRow'
import GroupedList from './GroupedList'
import { STRIP_DAYS, dayKeys, fmtKey, fmtMonth, fmtWkLong, fmtWkShort, keyToDate } from '@/lib/dates'
import type { EventItem } from '@/lib/types'

export default function DayBrowser({ events, showOrg = true }: { events: EventItem[]; showOrg?: boolean }) {
  const stripRef = useRef<HTMLDivElement>(null)

  const { byDay, keys, later } = useMemo(() => {
    const byDay = new Map<string, EventItem[]>()

    for (const e of events) {
      const k = fmtKey.format(new Date(e.starts_at))
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push(e)
    }

    const keys = dayKeys(STRIP_DAYS)
    const horizon = keys[keys.length - 1]
    const later = events.filter((e) => fmtKey.format(new Date(e.starts_at)) > horizon)

    return { byDay, keys, later }
  }, [events])

  const firstWithEvents = keys.find((k) => byDay.has(k)) ?? (later.length ? 'later' : keys[0])
  const [selected, setSelected] = useState<string | null>(null)

  const active = selected ?? firstWithEvents

  function pick(key: string, el: HTMLButtonElement) {
    setSelected(key)
    el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }

  return (
    <>
      <div className="daystrip" ref={stripRef}>
        {keys.map((k, i) => {
          const d = keyToDate(k)
          const n = byDay.get(k)?.length ?? 0

          return (
            <button
              key={k}
              className={`day ${k === active ? 'on' : ''} ${n ? '' : 'empty'}`}
              onClick={(ev) => pick(k, ev.currentTarget)}
            >
              <span className="dw">{i === 0 ? 'Today' : fmtWkShort.format(d)}</span>
              <span className="dd">{d.getUTCDate()}</span>
              <span className={`dot ${n ? '' : 'off'}`} />
            </button>
          )
        })}

        {later.length > 0 && (
          <button
            className={`day wide ${active === 'later' ? 'on' : ''}`}
            onClick={(ev) => pick('later', ev.currentTarget)}
          >
            <span className="dw">After</span>
            <span className="dd">Later</span>
            <span className="dot" />
          </button>
        )}
      </div>

      {active === 'later' ? (
        <div>
          <div className="dayhead">
            <span className="n">…</span>
            <span className="w"><b>Later</b>beyond {STRIP_DAYS} days</span>
          </div>
          <GroupedList events={later} showOrg={showOrg} />
        </div>
      ) : (
        <div>
          <div className="dayhead">
            <span className="n">{keyToDate(active).getUTCDate()}</span>
            <span className="w">
              <b>{fmtWkLong.format(keyToDate(active))}</b>
              {fmtMonth.format(keyToDate(active))}
            </span>
          </div>

          {(byDay.get(active) ?? []).length
            ? (byDay.get(active) ?? []).map((e) => <EventRow e={e} showOrg={showOrg} key={e.id} />)
            : <p className="status">Nothing on this day.</p>}
        </div>
      )}
    </>
  )
}
