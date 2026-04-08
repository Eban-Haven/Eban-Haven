import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getMe, type SessionUser } from '../api/auth'

/**
 * Resolves the current JWT session for public chrome (nav, etc.).
 * Re-fetches when the route changes so the header updates right after login/register redirects.
 */
export function useAuthSession(): SessionUser | null | undefined {
  const location = useLocation()
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const me = await getMe()
      if (!cancelled) setSession(me)
    })()
    return () => {
      cancelled = true
    }
  }, [location.pathname])

  return session
}
