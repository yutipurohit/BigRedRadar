'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import EventsScreen from '@/components/EventsScreen'
import { useFollows } from '@/lib/follows'

export default function FeedPage() {
  const router = useRouter()
  const { ready, follows, followedCount } = useFollows()

  const n = followedCount()

  useEffect(() => {
    if (ready && n === 0) router.replace('/clubs')
  }, [ready, n, router])

  if (!ready) return <p className="status">Loading…</p>
  if (n === 0) return <p className="status">Loading…</p>

  return (
    <EventsScreen
      title="My Feed"
      subtitle={(events) => `${events.length} upcoming | ${n} club${n === 1 ? '' : 's selected'}`}
      slugs={[...follows]}
      emptyAction
      showEdit
    />
  )
}
