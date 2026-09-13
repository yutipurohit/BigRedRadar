import ClubView from '@/components/ClubView'
import { apiGet } from '@/lib/api'
import type { Org } from '@/lib/types'

async function findOrg(slug: string) {
  try {
    const data = await apiGet<{ orgs: Org[] }>('/orgs')
    return data.orgs.find((o) => o.slug === slug) ?? null
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await findOrg(slug)
  const name = org?.name ?? 'Club'

  return {
    title: `${name} · Big Red Radar`,
    description: `Upcoming events from ${name} at Cornell.`,
    openGraph: {
      title: `${name} · Big Red Radar`,
      description: `Upcoming events from ${name} at Cornell.`,
      images: ['/og.png'],
    },
  }
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await findOrg(slug)

  return <ClubView slug={slug} name={org?.name ?? slug} />
}
