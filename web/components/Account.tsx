'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { useFollows } from '@/lib/follows'

declare global {
  interface Window {
    google?: any
  }
}

export default function Account() {
  const { me, clientId, signIn, signOut } = useFollows()
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (me || !clientId) return

    let stop = false

    function render(tries = 0) {
      if (stop || !btnRef.current) return

      if (!window.google?.accounts?.id) {
        if (tries < 40) setTimeout(() => render(tries + 1), 150)
        return
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: { credential: string }) => {
          signIn(res.credential).catch((err) => console.error(err))
        },
      })

      window.google.accounts.id.renderButton(btnRef.current, {
        theme: 'outline',
        size: 'medium',
        text: 'signin_with',
        width: 190,
      })
    }

    render()
    return () => { stop = true }
  }, [me, clientId, signIn])

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />

      <div className="account">
        {me ? (
          <>
            <div className="who">
              {me.picture_url && <img src={me.picture_url} alt="" />}
              <span className="nm">{me.name || me.email}</span>
            </div>
            <button className="signout" onClick={() => signOut()}>Sign out</button>
          </>
        ) : (
          <div ref={btnRef} />
        )}
      </div>
    </>
  )
}
