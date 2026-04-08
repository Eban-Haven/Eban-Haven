import { useEffect, useState, useCallback } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out' | 'denied'>('loading')
  const location = useLocation()

  const refresh = useCallback(async () => {
    const user = await getMe()
    if (!user) {
      setState('out')
      return
    }

    const role = user.role?.trim().toLowerCase() ?? ''
    setState(role === 'admin' ? 'in' : 'denied')
  }, [])

  useEffect(() => {
    void refresh()
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

  if (state === 'denied') {
    return <Navigate to="/donor-dashboard" replace />
  }

  return <>{children}</>
}
