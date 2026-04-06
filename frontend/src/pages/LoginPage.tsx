import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Lock } from 'lucide-react'
import { login } from '../api/auth'
import { SITE_DISPLAY_NAME } from '../site'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ user?: string; pass?: string }>({})

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const fe: { user?: string; pass?: string } = {}
    if (!username.trim()) fe.user = 'Username is required.'
    if (!password) fe.pass = 'Password is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length > 0) return

    setSubmitting(true)
    try {
      await login(username.trim(), password, remember)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-8 shadow-sm"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Lock className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Staff sign in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Secure access to the {SITE_DISPLAY_NAME} management portal.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}
            <div>
              <label htmlFor="staff-user" className="text-sm font-medium text-foreground">
                Username
              </label>
              <input
                id="staff-user"
                name="username"
                autoComplete="username"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-invalid={!!fieldErrors.user}
                aria-describedby={fieldErrors.user ? 'staff-user-err' : undefined}
              />
              {fieldErrors.user && (
                <p id="staff-user-err" className="mt-1 text-xs text-destructive">
                  {fieldErrors.user}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="staff-pass" className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                id="staff-pass"
                name="password"
                type="password"
                autoComplete="current-password"
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!fieldErrors.pass}
                aria-describedby={fieldErrors.pass ? 'staff-pass-err' : undefined}
              />
              {fieldErrors.pass && (
                <p id="staff-pass-err" className="mt-1 text-xs text-destructive">
                  {fieldErrors.pass}
                </p>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-input"
              />
              Remember this device
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Heart className="h-3.5 w-3.5" /> Back to public site
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
