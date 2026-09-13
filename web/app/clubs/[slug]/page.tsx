import ClubView from '@/components/ClubView'
import { findOrg } from '@/lib/server/queries'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await findOrg(slug)
  const name = org ? String(org.name) : 'Club'

  return {
    title: `${name} · Big Red Radar`,
    description: `Upcoming events from ${name} at Cornell.`,
    openGraph: {
      title: `${name} · Big Red Radar`,
      description: `Upcoming events from ${name} at Cornell.`,
      images: ['/og-v2.png'],
    },
  }
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await findOrg(slug)

  return <ClubView slug={slug} name={org ? String(org.name) : slug} />
}
