'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Account from './Account'
import { useFollows } from '@/lib/follows'

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { followedCount } = useFollows()
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('brr.collapsed')) setCollapsed(true)
    } catch {}
  }, [])

  useEffect(() => { setDrawer(false) }, [pathname])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('brr.collapsed', next ? '1' : '') } catch {}
      return next
    })
  }

  const n = followedCount()
  const onFeed = pathname === '/' || pathname.startsWith('/clubs')
  const onExplore = pathname.startsWith('/explore')

  return (
    <div className={`app ${collapsed ? 'collapsed' : ''}`}>
      <aside className={`sidebar ${drawer ? 'open' : ''}`}>
        <div className="brand">
          <svg className="logo" width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <radialGradient id="sweep1" cx="32" cy="32" r="28" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="currentColor" stopOpacity=".95" />
                <stop offset="1" stopColor="currentColor" stopOpacity=".12" />
              </radialGradient>
            </defs>
            <path d="M32 32 51.1 12.9A27 27 0 0 1 57.4 22.8Z" fill="url(#sweep1)" />
            <g fill="none" stroke="currentColor" strokeWidth="4.6">
              <circle cx="32" cy="32" r="27" />
              <circle cx="32" cy="32" r="17.5" />
              <circle cx="32" cy="32" r="8.5" />
            </g>
            <circle cx="32" cy="32" r="4.6" fill="currentColor" />
          </svg>

          <div className="wordmark">Big Red<em>Radar</em></div>

          <button className="burger" onClick={toggleCollapsed} aria-label="Collapse menu">
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none"
                 stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
            </svg>
          </button>
        </div>

        <p className="tagline">Every Cornell club event, in one place.</p>

        <Link className={`navbtn ${onFeed ? 'on' : ''}`} href="/">
          <svg className="ic" width="16" height="16" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 2.5h8v11l-4-3-4 3z" />
          </svg>
          <span className="lbl">My Feed</span>
          <span className="count">{n || ''}</span>
        </Link>

        <Link className={`navbtn ${onExplore ? 'on' : ''}`} href="/explore">
          <svg className="ic" width="16" height="16" viewBox="0 0 16 16" fill="none"
               stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="8" cy="8" r="6" />
            <path d="M10.8 5.2 9.2 9.2 5.2 10.8 6.8 6.8Z" fill="currentColor" stroke="none" />
          </svg>
          <span className="lbl">Explore</span>
        </Link>
      </aside>

      <div className={`backdrop ${drawer ? 'show' : ''}`} onClick={() => setDrawer(false)} />

      <Account />

      <main className="main">
        <div className="inner">
          <div className="topbar">
            <button className="hamburger" onClick={() => setDrawer(true)} aria-label="Menu">&#9776;</button>
            <div className="wordmark">Big Red <em>Radar</em></div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
