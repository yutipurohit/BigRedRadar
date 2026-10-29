'use client'

import { useFollows } from '@/lib/follows'
import GoogleSignIn from './GoogleSignIn'

export default function Account() {
  const { me, clientId, signOut } = useFollows()
  return <div className="account">
    {me ? <>
      <div className="who">
        {me.picture_url && <img src={me.picture_url} alt="" />}
        <span className="nm">{me.name || me.email}</span>
      </div>
      <button className="signout" onClick={() => signOut()}>Sign out</button>
    </> : clientId ? <GoogleSignIn /> : null}
  </div>
}
