import { useEffect, useState, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'

/** Any signed-in user (cookie session). */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')
  const location = useLocation()

  const refresh = useCallback(async () => {
    const u = await getMe()
    if (u) {
      setState('in')
      return
    }
    setState('out')
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (state === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-muted-foreground">
        Verifying session…
      </div>
    )
  }
  if (state === 'out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}
