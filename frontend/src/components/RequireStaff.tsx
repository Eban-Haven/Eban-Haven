import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'in' | 'out'>('loading')
  const location = useLocation()

  useEffect(() => {
    let cancelled = false
    void getMe().then((u) => {
      if (!cancelled) setState(u ? 'in' : 'out')
    })
    return () => {
      cancelled = true
    }
  }, [])

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
