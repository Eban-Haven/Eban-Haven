import { useEffect, useState, useCallback } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getMe } from '../api/auth'

type Gate = 'loading' | 'in' | 'out' | 'donor' | 'resident'

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Gate>('loading')
  const location = useLocation()

  const refresh = useCallback(() => {
    void (async () => {
      const u = await getMe()
      if (!u) {
        setState('out')
        return
      }
      setState('in')
    })()
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
  if (state === 'donor') {
    return <Navigate to="/donor-dashboard" replace />
  }
  if (state === 'resident') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

/** Nested admin routes: staff session required; use for `/admin/*` children (not the dashboard index). */
export function RequireStaffOutlet() {
  return (
    <RequireStaff>
      <Outlet />
    </RequireStaff>
  )
}
