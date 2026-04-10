import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { UserRound } from 'lucide-react'
import { getDonorAccount, patchDonorAccount } from '../../api/donor'
import { SITE_DISPLAY_NAME } from '../../site'

const inputClass =
  'mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function DonorAccountPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')

  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [hasSupporter, setHasSupporter] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getDonorAccount()
        if (cancelled) return
        setEmail(data.email)
        setFullName(data.fullName ?? '')
        const s = data.supporter
        setHasSupporter(!!s)
        setDisplayName(s?.displayName ?? '')
        setFirstName(s?.firstName ?? '')
        setLastName(s?.lastName ?? '')
        setPhone(s?.phone ?? '')
        setRegion(s?.region ?? '')
        setCountry(s?.country ?? '')
        setOrganizationName(s?.organizationName ?? '')
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load account')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const base = { fullName: fullName.trim() }
      await patchDonorAccount(
        hasSupporter
          ? {
              ...base,
              displayName: displayName.trim(),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              phone: phone.trim(),
              region: region.trim(),
              country: country.trim(),
              organizationName: organizationName.trim(),
            }
          : base,
      )
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-8 shadow-sm"
    >
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
          <UserRound className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Account</h1>
          <p className="text-sm text-muted-foreground">
            Sign-in and display details for your {SITE_DISPLAY_NAME} donor portal.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
          Your changes were saved.
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground">Email</label>
            <input type="email" className={`${inputClass} bg-muted/50`} value={email} disabled readOnly />
            <p className="mt-1 text-xs text-muted-foreground">Email is your sign-in ID. Contact staff if you need to change it.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Full name</label>
            <input
              type="text"
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            <p className="mt-1 text-xs text-muted-foreground">Shown when you sign in and in staff-facing account records.</p>
          </div>

          {!hasSupporter && (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No supporter profile is linked to this email yet. You can still update your account name above; staff can link your
              giving record so the fields below apply to receipts and communications.
            </p>
          )}

          <div className="border-t border-border pt-6">
            <h2 className="font-heading text-lg font-semibold text-foreground">Supporter profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for donation records and how we address you in communications.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Display name</label>
            <input
              type="text"
              className={inputClass}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={!hasSupporter}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">First name</label>
              <input
                type="text"
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!hasSupporter}
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Last name</label>
              <input
                type="text"
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!hasSupporter}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Phone</label>
            <input
              type="tel"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!hasSupporter}
              autoComplete="tel"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-foreground">Region / state</label>
              <input
                type="text"
                className={inputClass}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={!hasSupporter}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">Country</label>
              <input
                type="text"
                className={inputClass}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={!hasSupporter}
                autoComplete="country-name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground">Organization (optional)</label>
            <input
              type="text"
              className={inputClass}
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              disabled={!hasSupporter}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </motion.div>
  )
}
