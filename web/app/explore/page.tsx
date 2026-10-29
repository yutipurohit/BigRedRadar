'use client'

import Link from 'next/link'
import EventsScreen from '@/components/EventsScreen'

export default function ExplorePage() {
  return (
    <>
    <p style={{ paddingTop: 36, marginBottom: 0, fontSize: 13 }}>
      Make club discovery yours: <Link href="/onboarding">Set or update your preferences →</Link>
    </p>
    <EventsScreen
      title="Explore"
      subtitle={() => 'Everything happening at Cornell'}
      categories
      clubs
    />
    </>
  )
}
