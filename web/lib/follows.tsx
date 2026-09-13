'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { apiGet, apiSend } from './api'
import type { Me, Org, Session } from './types'

type Ctx = {
  ready: boolean
  orgs: Org[]
  follows: Set<string>
  me: Me | null
  clientId: string
  followedCount: () => number
  isFollowing: (slug: string) => boolean
  toggle: (slug: string) => void
  setMany: (slugs: string[], on: boolean) => void
  clearAll: () => void
  signIn: (credential: string) => Promise<void>
  signOut: () => Promise<void>
}

const FollowsContext = createContext<Ctx | null>(null)

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem('brr.follows') || '[]')
  } catch {
    return []
  }
}

function writeLocal(slugs: string[]) {
  try {
    localStorage.setItem('brr.follows', JSON.stringify(slugs))
  } catch {}
}

export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [orgs, setOrgs] = useState<Org[]>([])
  const [follows, setFollows] = useState<Set<string>>(new Set())
  const [me, setMe] = useState<Me | null>(null)
  const [clientId, setClientId] = useState('')

  useEffect(() => {
    let alive = true

    setFollows(new Set(readLocal()))

    const clubs = apiGet<{ orgs: Org[] }>('/orgs')
      .then((data) => { if (alive) setOrgs(data.orgs ?? []) })
      .catch((err) => console.error(err))

    const session = apiGet<Session>('/session')
      .then((data) => {
        if (!alive) return

        setClientId(data.googleClientId || '')
        setMe(data.user || null)

        if (data.user) {
          const server = new Set(data.follows || [])
          writeLocal([...server])
          setFollows(server)
        }
      })
      .catch((err) => console.error(err))

    Promise.all([clubs, session]).finally(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [])

  const persist = useCallback((next: Set<string>, signedIn: boolean) => {
    writeLocal([...next])

    if (signedIn) {
      apiSend('/subscriptions', 'PUT', { slugs: [...next] }).catch((err) => console.error(err))
    }
  }, [])

  const apply = useCallback((fn: (prev: Set<string>) => Set<string>) => {
    setFollows((prev) => {
      const next = fn(new Set(prev))
      persist(next, Boolean(me))
      return next
    })
  }, [me, persist])

  const value: Ctx = {
    ready,
    orgs,
    follows,
    me,
    clientId,

    followedCount: () => orgs.filter((o) => follows.has(o.slug)).length,
    isFollowing: (slug) => follows.has(slug),

    toggle: (slug) => apply((next) => {
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    }),

    setMany: (slugs, on) => apply((next) => {
      for (const s of slugs) {
        if (on) next.add(s)
        else next.delete(s)
      }
      return next
    }),

    clearAll: () => apply(() => new Set()),

    signIn: async (credential) => {
      const data = await apiSend<{ user: Me; follows: string[] }>('/auth/google', 'POST', { credential })

      setMe(data.user)

      setFollows((prev) => {
        const next = new Set(prev)
        for (const slug of data.follows) next.add(slug)
        writeLocal([...next])
        apiSend('/subscriptions', 'PUT', { slugs: [...next] }).catch((err) => console.error(err))
        return next
      })
    },

    signOut: async () => {
      try {
        await apiSend('/auth/logout', 'POST')
      } catch (err) {
        console.error(err)
      }
      setMe(null)
    },
  }

  return <FollowsContext.Provider value={value}>{children}</FollowsContext.Provider>
}

export function useFollows() {
  const ctx = useContext(FollowsContext)
  if (!ctx) throw new Error('useFollows must be used inside FollowsProvider')
  return ctx
}
