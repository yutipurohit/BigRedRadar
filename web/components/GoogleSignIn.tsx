'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { useFollows } from '@/lib/follows'

declare global {
  interface Window { google?: any }
}
export default function GoogleSignIn() {
  const { clientId, signIn } = useFollows()
  const btnRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!clientId) return
    let stop = false
    let timer: ReturnType<typeof setTimeout>
    function render(tries = 0) {
      if (stop || !btnRef.current) return
      if (!window.google?.accounts?.id) {
        if (tries < 40) timer = setTimeout(() => render(tries + 1), 150)
        else setError('Google sign-in could not load. Please reload and try again.')
        return
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: { credential: string }) => {
          if (stop) return
          setError('')
          signIn(res.credential).catch(() => { if (!stop) setError('Sign-in failed. Please try again.') })
        },
      })
      window.google.accounts.id.renderButton(btnRef.current, { theme: 'outline', size: 'medium', text: 'signin_with', width: 190 })
    }
    render()
    return () => { stop = true; clearTimeout(timer) }
  }, [clientId, signIn])
  return <>
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
    <div ref={btnRef} />
    {!clientId && <p role="status">Sign-in is currently unavailable. You can still explore without an account.</p>}
    {error && <p role="alert">{error}</p>}
  </>
}
