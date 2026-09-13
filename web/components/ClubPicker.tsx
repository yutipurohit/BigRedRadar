'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CategoryPills from './CategoryPills'
import { useFollows } from '@/lib/follows'

export default function ClubPicker() {
  const router = useRouter()
  const { ready, orgs, follows, followedCount, toggle, setMany, clearAll } = useFollows()
  const [q, setQ] = useState('')
  const [picks, setPicks] = useState<Set<string>>(new Set())

  if (!ready) return <p className="status">Loading…</p>

  if (orgs.length === 0) {
    return <div className="status">No clubs in the database yet.<br /><code>npm run ingest</code></div>
  }

  const n = followedCount()
  const first = n === 0
  const query = q.trim().toLowerCase()
  const everything = !picks.size && !query

  function inPicks(category: string | null, slug: string) {
    if (!picks.size) return true
    if (picks.has('following') && follows.has(slug)) return true
    return picks.has(category ?? '')
  }

  const list = (query
    ? orgs.filter((o) => o.name.toLowerCase().includes(query))
    : orgs.filter((o) => inPicks(o.category, o.slug))
  ).slice().sort((a, b) => {
    const fa = follows.has(a.slug) ? 1 : 0
    const fb = follows.has(b.slug) ? 1 : 0
    return (fb - fa) || (b.upcoming - a.upcoming) || a.name.localeCompare(b.name)
  })

  const counts = new Map<string, number>()
  for (const o of orgs) {
    if (!o.category) continue
    counts.set(o.category, (counts.get(o.category) ?? 0) + 1)
  }

  function togglePick(k: string) {
    setPicks((prev) => {
      const next = new Set(prev)
      if (k === 'all') next.clear()
      else if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setQ('')
  }

  const word = everything ? 'All' : 'These'

  return (
    <>
      <div className="head">
        <div>
          <h2>{first ? 'Pick Your Clubs' : 'My Clubs'}</h2>
          <p className="sub">{first
            ? 'Your feed shows only these. Change it whenever.'
            : 'Tap to follow or unfollow.'}</p>
        </div>
      </div>

      <input
        className="field"
        type="search"
        placeholder={`Search ${orgs.length} clubs`}
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
      />

      <CategoryPills
        counts={counts}
        picks={picks}
        onToggle={togglePick}
        allCount={orgs.length}
        extra={n ? [{ key: 'following', label: 'Following', count: n }] : []}
      />

      <div className="bulk">
        <button className="bulkbtn" onClick={() => setMany(list.map((o) => o.slug), true)}>Select {word}</button>
        <button
          className="bulkbtn"
          onClick={() => everything ? clearAll() : setMany(list.map((o) => o.slug), false)}
        >
          Clear {word}
        </button>
      </div>

      <div className="chips">
        {list.length
          ? list.map((o) => (
              <button
                key={o.slug}
                className={`chip ${follows.has(o.slug) ? 'on' : ''}`}
                onClick={() => toggle(o.slug)}
              >
                {o.name}<span className="n">{o.upcoming}</span>
              </button>
            ))
          : <p className="sub">Nothing here.</p>}
      </div>

      <div className="bar">
        <button className="primary" disabled={n === 0} onClick={() => router.push('/')}>
          {n ? `See My Feed (${n})` : 'Pick At Least One'}
        </button>
      </div>
    </>
  )
}
