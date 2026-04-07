import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll window to top on client-side route changes. */
export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
