'use client'

import { useEffect, useState } from 'react'
import DayBrowser from './DayBrowser'
import { apiGet, eventsPath } from '@/lib/api'
import { categoryLabel } from '@/lib/categories'
import { useFollows } from '@/lib/follows'
import type { EventItem } from '@/lib/types'

export default function ClubView({ slug, name }: { slug: string; name: string }) {
  const { ready, orgs, isFollowing, toggle } = useFollows()
  const [events, setEvents] = useState<EventItem[] | null>(null)

  useEffect(() => {
    let alive = true

    apiGet<{ events: EventItem[] }>(eventsPath([slug]))
      .then((data) => { if (alive) setEvents(data.events ?? []) })
      .catch((err) => { console.error(err); if (alive) setEvents([]) })

    return () => { alive = false }
  }, [slug])

  const org = orgs.find((o) => o.slug === slug)
  const label = categoryLabel(org?.category ?? null)
  const following = isFollowing(slug)

  return (
    <>
      <div className="clubhead">
        <div>
          <h2>{org?.name ?? name}</h2>
          <p className="sub">
            {label ? `${label} · ` : ''}
            {events ? `${events.length} upcoming` : 'Loading…'}
          </p>
        </div>

        {ready && (
          <button className={`follow ${following ? 'on' : ''}`} onClick={() => toggle(slug)}>
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {!events
        ? <p className="status">Loading…</p>
        : events.length
          ? <DayBrowser events={events} showOrg={false} />
          : <p className="status">No upcoming events posted.</p>}
    </>
  )
}
