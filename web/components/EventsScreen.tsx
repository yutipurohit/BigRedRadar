'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DayBrowser from './DayBrowser'
import GroupedList from './GroupedList'
import CategoryPills from './CategoryPills'
import { apiGet, eventsPath } from '@/lib/api'
import { matches } from '@/lib/dates'
import { useFollows } from '@/lib/follows'
import type { EventItem } from '@/lib/types'

type Props = {
  title: string
  subtitle: (events: EventItem[]) => string
  slugs?: string[]
  categories?: boolean
  emptyAction?: boolean
  showEdit?: boolean
  clubs?: boolean
}

export default function EventsScreen({ title, subtitle, slugs, categories = false, emptyAction = false, showEdit = false, clubs = false }: Props) {
  const router = useRouter()
  const { isFollowing, setMany } = useFollows()
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [q, setQ] = useState('')
  const [picks, setPicks] = useState<Set<string>>(new Set())
  const [viewing, setViewing] = useState<Set<string>>(new Set())
  const [openClubs, setOpenClubs] = useState(false)

  const key = slugs ? slugs.join(',') : ''

  useEffect(() => {
    let alive = true
    setEvents(null)

    apiGet<{ events: EventItem[] }>(eventsPath(slugs))
      .then((data) => { if (alive) setEvents(data.events ?? []) })
      .catch((err) => { console.error(err); if (alive) setEvents([]) })

    return () => { alive = false }
  }, [key])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of events ?? []) {
      if (!e.org_category) continue
      m.set(e.org_category, (m.get(e.org_category) ?? 0) + 1)
    }
    return m
  }, [events])

  if (!events) return <p className="status">Loading…</p>

  const inPicks = picks.size ? events.filter((e) => picks.has(e.org_category ?? '')) : events
  const inClubs = viewing.size ? inPicks.filter((e) => viewing.has(e.org_slug)) : inPicks
  const query = q.trim().toLowerCase()
  const shown = query ? inClubs.filter((e) => matches(e, query)) : inClubs

  const roster = new Map<string, { name: string; n: number }>()
  for (const e of inPicks) {
    const row = roster.get(e.org_slug)
    if (row) row.n += 1
    else roster.set(e.org_slug, { name: e.org_name, n: 1 })
  }

  const clubList = [...roster.entries()].sort((a, b) => (b[1].n - a[1].n) || a[1].name.localeCompare(b[1].name))
  const toAdd = [...viewing].filter((s) => !isFollowing(s))

  function togglePick(k: string) {
    setPicks((prev) => {
      const next = new Set(prev)
      if (k === 'all') next.clear()
      else if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setViewing(new Set())
  }

  function toggleClub(slug: string) {
    setViewing((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <>
      <div className="head">
        <div>
          <h2>{title}</h2>
          <p className="sub">{subtitle(events)}</p>
        </div>
        {showEdit && <button className="ghost" onClick={() => router.push('/clubs')}>Edit Clubs</button>}
      </div>

      <input
        className="field"
        type="search"
        placeholder="Search for any events or clubs"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
      />

      {categories && (
        <CategoryPills counts={counts} picks={picks} onToggle={togglePick} />
      )}

      {clubs && (
        <div className="bulk">
          <button className="bulkbtn" onClick={() => setOpenClubs((v) => !v)}>
            {viewing.size ? `${viewing.size} Club${viewing.size === 1 ? '' : 's'}` : 'Filter By Club'}
          </button>

          {viewing.size > 0 && (
            <>
              <button className="bulkbtn" disabled={!toAdd.length} onClick={() => setMany(toAdd, true)}>
                {toAdd.length ? `Add ${toAdd.length} To My Feed` : 'Already In My Feed'}
              </button>
              <button className="bulkbtn" onClick={() => setViewing(new Set())}>Clear</button>
            </>
          )}
        </div>
      )}

      {clubs && openClubs && (
        <div className="clubbox">
          <div className="chips">
            {clubList.length
              ? clubList.map(([slug, row]) => (
                  <button
                    key={slug}
                    className={`chip ${viewing.has(slug) ? 'on' : ''}`}
                    onClick={() => toggleClub(slug)}
                  >
                    {row.name}<span className="n">{row.n}</span>
                  </button>
                ))
              : <p className="sub">Nothing here.</p>}
          </div>
        </div>
      )}

      {query
        ? (shown.length ? <GroupedList events={shown} /> : <p className="status">Nothing found.</p>)
        : inClubs.length
          ? <DayBrowser events={inClubs} />
          : (
            <div className="status">
              Nothing coming up.
              {emptyAction && (
                <>
                  <br />
                  <button className="primary" onClick={() => router.push('/explore')}>Explore Everything</button>
                </>
              )}
            </div>
          )}
    </>
  )
}
