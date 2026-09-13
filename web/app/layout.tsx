import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { FollowsProvider } from '@/lib/follows'
import Shell from '@/components/Shell'

const display = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' })
const text = Inter({ subsets: ['latin'], variable: '--font-text' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: 'Big Red Radar',
  description: "Every Cornell club event, in one place. Follow the clubs you care about and see what's on.",
  openGraph: {
    type: 'website',
    title: 'Big Red Radar',
    description: 'Every Cornell club event, in one place.',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cg fill='none' stroke='%23e82820' stroke-width='5'%3E%3Ccircle cx='32' cy='32' r='27'/%3E%3Ccircle cx='32' cy='32' r='17.5'/%3E%3Ccircle cx='32' cy='32' r='8.5'/%3E%3C/g%3E%3Cpath d='M32 32 51.1 12.9A27 27 0 0 1 57.4 22.8Z' fill='%23e82820' opacity='.55'/%3E%3Ccircle cx='32' cy='32' r='4.5' fill='%23e82820'/%3E%3C/svg%3E",
  },
}

export const viewport: Viewport = {
  themeColor: '#b31b1b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${text.variable} ${mono.variable}`}>
      <body>
        <FollowsProvider>
          <Shell>{children}</Shell>
        </FollowsProvider>
      </body>
    </html>
  )
}
