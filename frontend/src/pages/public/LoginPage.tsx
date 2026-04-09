import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CircleHelp, Eye, EyeOff, Lock } from 'lucide-react'
import { login, loginWithGoogle, type GoogleAuthMode } from '../../api/auth'
import { registerDonorAccount } from '../../api/registration'
import { SITE_DISPLAY_NAME } from '../../site'

const supporterTypeOptions = [
  { value: 'MonetaryDonor', label: 'Monetary donor' },
  { value: 'Volunteer', label: 'Volunteer' },
  { value: 'InKindDonor', label: 'In-kind donor' },
  { value: 'SkillsContributor', label: 'Skills contributor' },
  { value: 'SocialMediaAdvocate', label: 'Social media advocate' },
  { value: 'PartnerOrganization', label: 'Partner organization' },
] as const

const relationshipOptions = [
  { value: 'Local', label: 'Local supporter' },
  { value: 'International', label: 'International supporter' },
  { value: 'Diaspora', label: 'Diaspora' },
  { value: 'Corporate', label: 'Corporate / workplace' },
] as const

const acquisitionChannels = [
  'Website',
  'Social media',
  'Community event',
  'Referral or word of mouth',
  'Partner organization',
  'Email campaign',
  'Other',
] as const

const cardClass = 'rounded-2xl border border-border bg-background/80 p-5'
const inputClass =
  'mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? ''

type RelationshipValue = (typeof relationshipOptions)[number]['value']

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void
          prompt: (momentListener?: (notification: unknown) => void) => void
        }
      }
    }
  }
}

let googleScriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
  if (googleScriptPromise) return googleScriptPromise
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-gsi="true"]')
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google Sign-In failed to load.')), { once: true })
      if (window.google) resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.googleGsi = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google Sign-In failed to load.'))
    document.head.appendChild(script)
  })
  return googleScriptPromise
}

function PasswordField(props: {
  id: string
  label: string
  autoComplete?: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div>
      <label htmlFor={props.id} className="text-sm font-medium text-foreground">
        {props.label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={props.id}
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete}
          className={`${inputClass} mt-0 pr-12`}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          aria-invalid={!!props.error}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {props.hint && <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p>}
      {props.error && <p className="mt-1 text-xs text-destructive">{props.error}</p>}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.24 10.285V14.4h5.88c-.255 1.35-1.53 3.96-5.88 3.96-3.54 0-6.42-2.925-6.42-6.535s2.88-6.535 6.42-6.535c2.01 0 3.36.855 4.14 1.59l2.82-2.73C17.4 2.475 15.045 1.5 12.24 1.5 6.945 1.5 2.64 5.805 2.64 11.1s4.305 9.6 9.6 9.6c5.535 0 9.21-3.885 9.21-9.36 0-.63-.075-1.11-.165-1.575H12.24Z"
      />
      <path
        fill="#34A853"
        d="M2.64 6.615 6.03 9.105c.915-1.815 2.79-3.075 5.115-3.075 2.01 0 3.36.855 4.14 1.59l2.82-2.73C17.4 2.475 15.045 1.5 12.24 1.5 8.55 1.5 5.355 3.615 3.765 6.69l-1.125-.075Z"
      />
      <path
        fill="#FBBC05"
        d="M2.64 17.385c1.545 3.09 4.755 5.205 9.6 5.205 2.67 0 4.92-.87 6.57-2.355l-3.03-2.475c-.99.705-2.235 1.14-3.54 1.14-4.275 0-5.535-2.595-5.88-3.885l-3.72 2.37Z"
      />
      <path
        fill="#4285F4"
        d="M21.45 11.34c0-.63-.075-1.11-.165-1.575H12.24V13.88h5.88c-.285 1.515-1.215 2.79-2.34 3.645l3.03 2.475c1.77-1.635 2.64-4.05 2.64-7.665Z"
      />
    </svg>
  )
}

function FieldLabel({
  htmlFor,
  label,
  required = false,
  hint,
}: {
  htmlFor?: string
  label: string
  required?: boolean
  hint?: string
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-sm font-medium text-foreground">
      <span>
        {label}
        {required ? <span className="ml-1 font-semibold text-primary">*</span> : null}
      </span>
      {hint ? (
        <span title={hint} className="inline-flex text-muted-foreground">
          <CircleHelp className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </label>
  )
}

function GoogleAuthBlock(props: {
  mode: GoogleAuthMode
  disabled: boolean
  onError: (message: string) => void
  onCredential: (credential: string, mode: GoogleAuthMode) => Promise<void>
}) {
  const { mode, disabled, onError, onCredential } = props
  const [googleReady, setGoogleReady] = useState(false)

  useEffect(() => {
    if (!googleClientId) return

    let cancelled = false
    void loadGoogleScript()
      .then(() => {
        if (cancelled || !window.google) return
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            if (!credential) {
              onError('Google Sign-In did not return a credential.')
              return
            }
            void onCredential(credential, mode)
          },
        })
        setGoogleReady(true)
      })
      .catch((error: unknown) => {
        onError(error instanceof Error ? error.message : 'Google Sign-In failed to load.')
        setGoogleReady(false)
      })

    return () => {
      cancelled = true
    }
  }, [mode, onCredential, onError])

  function handleGoogleClick() {
    if (!window.google || !googleReady || disabled) return
    window.google.accounts.id.prompt()
  }

  if (!googleClientId) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Google sign-{mode === 'login' ? 'in' : 'up'} can be enabled by setting `VITE_GOOGLE_CLIENT_ID` in the
        frontend and `GoogleAuth:ClientId` in the API.
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleGoogleClick}
      disabled={disabled || !googleReady}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:bg-muted/35 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <GoogleMark />
      <span>{mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}</span>
    </button>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  const [tab, setTab] = useState<'login' | 'register'>('login')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ user?: string; pass?: string }>({})
  const [registerErrors, setRegisterErrors] = useState<{
    displayName?: string
    email?: string
    password?: string
    supporterType?: string
    country?: string
  }>({})

  const [rEmail, setREmail] = useState('')
  const [rPassword, setRPassword] = useState('')
  const [rSupporterType, setRSupporterType] = useState<string>('MonetaryDonor')
  const [rDisplayName, setRDisplayName] = useState('')
  const [rOrg, setROrg] = useState('')
  const [rFirst, setRFirst] = useState('')
  const [rLast, setRLast] = useState('')
  const [rRel, setRRel] = useState<RelationshipValue>('Local')
  const [rRegion, setRRegion] = useState('')
  const [rCountry, setRCountry] = useState('Ghana')
  const [rPhone, setRPhone] = useState('')
  const [rChannel, setRChannel] = useState('Website')

  async function postLoginRedirect() {
    navigate(from.startsWith('/login') ? '/admin' : from, { replace: true })
  }

  const completeGoogleAuth = useCallback(
    async (credential: string, mode: GoogleAuthMode) => {
      setSubmitting(true)
      setError(null)
      try {
        await loginWithGoogle(credential, mode)
        navigate(mode === 'register' ? '/donor-dashboard' : from.startsWith('/login') ? '/admin' : from, { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google authentication failed.')
      } finally {
        setSubmitting(false)
      }
    },
    [from, navigate],
  )

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
      await postLoginRedirect()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!rEmail.trim() || !rPassword || !rDisplayName.trim()) {
      setError('Email, password, and display name are required.')
      return
    }
    setSubmitting(true)
    try {
      await registerDonorAccount({
        email: rEmail.trim(),
        password: rPassword,
        supporterType: rSupporterType,
        displayName: rDisplayName.trim(),
        organizationName: rOrg,
        firstName: rFirst,
        lastName: rLast,
        relationshipType: rRel,
        region: rRegion,
        country: rCountry,
        phone: rPhone,
        acquisitionChannel: rChannel,
      })
      navigate('/donor-dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-background py-16 lg:py-24">
      <div className={`mx-auto px-6 ${tab === 'register' ? 'max-w-5xl' : 'max-w-md'}`}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_24px_60px_-42px_rgba(26,55,49,0.28)] sm:p-8"
        >
          <div className="mb-6 flex gap-2 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                tab === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('login')
                setError(null)
                setRegisterErrors({})
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                tab === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
              onClick={() => {
                setTab('register')
                setError(null)
                setFieldErrors({})
              }}
            >
              Register
            </button>
          </div>

          <div className="mb-8">
            <div className={tab === 'register' ? '' : 'flex flex-col items-center text-center'}>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Lock className="h-6 w-6 text-primary-foreground" />
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                {tab === 'login' ? 'Sign in' : 'Create donor account'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {tab === 'login'
                  ? `Access your ${SITE_DISPLAY_NAME} portal.`
                  : ''}
              </p>
            </div>
          </div>

          {error && (
            <div
              className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="staff-user" className="text-sm font-medium text-foreground">
                  Username
                </label>
                <input
                  id="staff-user"
                  name="username"
                  autoComplete="username"
                  type="text"
                  className={inputClass}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  aria-invalid={!!fieldErrors.user}
                />
                {fieldErrors.user && <p className="mt-1 text-xs text-destructive">{fieldErrors.user}</p>}
              </div>
              <PasswordField
                id="staff-pass"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                error={fieldErrors.pass}
              />
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
              <GoogleAuthBlock
                mode="login"
                disabled={submitting}
                onError={setError}
                onCredential={completeGoogleAuth}
              />
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <section className={cardClass}>
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Account access</p>
                    <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">Sign-in essentials</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm sm:col-span-2">
                      <span className="text-muted-foreground">Display name *</span>
                      <input
                        required
                        className={inputClass}
                        value={rDisplayName}
                        onChange={(e) => setRDisplayName(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Email *</span>
                      <input
                        type="email"
                        required
                        className={inputClass}
                        value={rEmail}
                        onChange={(e) => setREmail(e.target.value)}
                      />
                    </label>
                    <div className="text-sm">
                      <PasswordField
                        id="register-pass"
                        label="Password *"
                        autoComplete="new-password"
                        value={rPassword}
                        onChange={setRPassword}
                        hint="Passwords must be at least 14 characters long."
                      />
                    </div>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Supporter type *</span>
                      <select
                        className={inputClass}
                        value={rSupporterType}
                        onChange={(e) => setRSupporterType(e.target.value)}
                      >
                        {supporterTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">How did you hear about us?</span>
                      <select
                        className={inputClass}
                        value={rChannel}
                        onChange={(e) => setRChannel(e.target.value)}
                      >
                        {acquisitionChannels.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className={cardClass}>
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Supporter profile</p>
                    <h2 className="mt-2 font-heading text-xl font-semibold text-foreground">Personal details</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-sm">
                      <span className="text-muted-foreground">First name</span>
                      <input className={inputClass} value={rFirst} onChange={(e) => setRFirst(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Last name</span>
                      <input className={inputClass} value={rLast} onChange={(e) => setRLast(e.target.value)} />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      <span className="text-muted-foreground">Organization name</span>
                      <input className={inputClass} value={rOrg} onChange={(e) => setROrg(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Relationship to our work</span>
                      <select
                        className={inputClass}
                        value={rRel}
                        onChange={(e) => setRRel(e.target.value as RelationshipValue)}
                      >
                        {relationshipOptions.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Phone</span>
                      <input className={inputClass} value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Region</span>
                      <input className={inputClass} value={rRegion} onChange={(e) => setRRegion(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      <span className="text-muted-foreground">Country</span>
                      <input className={inputClass} value={rCountry} onChange={(e) => setRCountry(e.target.value)} />
                    </label>
                  </div>
                </section>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
              <GoogleAuthBlock
                mode="register"
                disabled={submitting}
                onError={setError}
                onCredential={completeGoogleAuth}
              />
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
