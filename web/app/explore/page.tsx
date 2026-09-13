'use client'

import EventsScreen from '@/components/EventsScreen'

export default function ExplorePage() {
  return (
    <EventsScreen
      title="Explore"
      subtitle={() => 'Everything happening at Cornell'}
      categories
      clubs
    />
  )
}
