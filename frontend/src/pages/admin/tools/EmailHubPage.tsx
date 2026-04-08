import { useCallback, useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Mail, RefreshCw, Sparkles } from 'lucide-react'
import {
  generateDonorEmail,
  getDonorEmailProfile,
  getSupporters,
  type DonorEmailProfile,
  type GeneratedDonorEmail,
  type Supporter,
} from '../../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle, sectionFormTitle } from '../shared/adminStyles'

const toneOptions = ['Warm', 'Direct', 'Celebratory', 'Re-engagement'] as const

const goalPresets = [
  'Thank the donor and encourage their next step.',
  'Re-engage a donor who has not given recently.',
  'Invite the donor to become a monthly giver.',
  'Share a tailored impact update and open a conversation.',
] as const

function formatMoney(amount: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode || 'PHP' }).format(amount)
  } catch {
    return `${amount} ${currencyCode || 'PHP'}`
  }
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString()
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

export function EmailHubPage() {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState<DonorEmailProfile | null>(null)
  const [generated, setGenerated] = useState<GeneratedDonorEmail | null>(null)
  const [search, setSearch] = useState('')
  const [goal, setGoal] = useState<string>(goalPresets[0])
  const [tone, setTone] = useState<(typeof toneOptions)[number]>('Warm')
  const [preferAi, setPreferAi] = useState(true)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'subject' | 'body' | null>(null)

  const loadSupporters = useCallback(async () => {
    setLoadingList(true)
    try {
      const rows = await getSupporters()
      setSupporters(rows)
      setSelectedId((current) => current ?? rows[0]?.id ?? null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donors.')
    } finally {
      setLoadingList(false)
    }
  }, [])

  const loadProfile = useCallback(async (supporterId: number) => {
    setLoadingProfile(true)
    try {
      const nextProfile = await getDonorEmailProfile(supporterId)
      setProfile(nextProfile)
      setGenerated(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load donor history.')
    } finally {
      setLoadingProfile(false)
    }
  }, [])

  useEffect(() => {
    void loadSupporters()
  }, [loadSupporters])

  useEffect(() => {
    if (selectedId != null) void loadProfile(selectedId)
  }, [selectedId, loadProfile])

  const filteredSupporters = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return supporters
    return supporters.filter((supporter) =>
      `${supporter.displayName} ${supporter.email ?? ''} ${supporter.organizationName ?? ''} ${supporter.region ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [supporters, search])

  async function onGenerateEmail() {
    if (selectedId == null) return
    setGenerating(true)
    try {
      const result = await generateDonorEmail(selectedId, { goal, tone, preferAi })
      setGenerated(result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(kind: 'subject' | 'body', value: string) {
    try {
      await copyText(value)
      setCopyState(kind)
      window.setTimeout(() => setCopyState((current) => (current === kind ? null : current)), 1600)
    } catch {
      setError('Clipboard access failed on this browser.')
    }
  }

  const mailtoHref = useMemo(() => {
    if (!profile?.supporter.email || !generated) return null
    const params = new URLSearchParams({
      subject: generated.subject,
      body: generated.body,
    })
    return `mailto:${profile.supporter.email}?${params.toString()}`
  }, [generated, profile])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className={`${pageTitle} flex items-center gap-2`}>
            <Mail className="h-7 w-7 text-primary" />
            Email hub
          </h2>
          <p className={pageDesc}>
            Review donor history, generate a tailored outreach email, and open a ready-to-send draft from the admin tools area.
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground lg:max-w-sm">
          Uses supporter, donation, and allocation history already in the system. If AI is unavailable, the page falls back to a grounded template.
        </div>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className={`${card} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={sectionFormTitle}>Donors</p>
              <p className="mt-1 text-sm text-muted-foreground">Pick a donor to build a custom email.</p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border bg-background p-2 text-muted-foreground hover:bg-muted/50"
              onClick={() => void loadSupporters()}
              aria-label="Refresh donors"
            >
              <RefreshCw className={`h-4 w-4 ${loadingList ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <label className={label}>
            Search donors
            <input
              className={input}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, organization..."
            />
          </label>

          <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
            {loadingList ? (
              <p className="text-sm text-muted-foreground">Loading donors…</p>
            ) : filteredSupporters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No donors match this search.</p>
            ) : (
              filteredSupporters.map((supporter) => {
                const selected = supporter.id === selectedId
                return (
                  <button
                    key={supporter.id}
                    type="button"
                    onClick={() => setSelectedId(supporter.id)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border bg-background hover:border-primary/30 hover:bg-muted/40'
                    }`}
                  >
                    <p className="font-medium text-foreground">{supporter.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{supporter.email ?? 'No email on file'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {supporter.supporterType}
                      {supporter.region ? ` · ${supporter.region}` : ''}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <section className="space-y-6">
          {loadingProfile ? (
            <div className={`${card} flex items-center gap-3 text-sm text-muted-foreground`}>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Loading donor history…
            </div>
          ) : !profile ? (
            <div className={`${card} text-sm text-muted-foreground`}>Select a donor to open their email workspace.</div>
          ) : (
            <>
              <div className={`${card} space-y-5`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-foreground">{profile.supporter.displayName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {profile.supporter.email ?? 'No email on file'}
                      {profile.supporter.organizationName ? ` · ${profile.supporter.organizationName}` : ''}
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">{profile.relationshipSummary}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Most recent gift</p>
                    <p className="mt-1">{formatDate(profile.mostRecentDonationDate)}</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Lifetime total</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatMoney(profile.lifetimeMonetaryTotal, profile.preferredCurrencyCode)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded gifts</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{profile.donationCount}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Largest gift</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {profile.largestGiftAmount != null
                        ? formatMoney(profile.largestGiftAmount, profile.preferredCurrencyCode)
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurring</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{profile.hasRecurringGift ? 'Yes' : 'No'}</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Recent campaigns</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.recentCampaigns.length > 0 ? profile.recentCampaigns.join(', ') : 'No campaign names recorded yet.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Program areas</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {profile.programAreas.length > 0 ? profile.programAreas.join(', ') : 'No allocation program areas recorded yet.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
                <div className={`${card} space-y-4`}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className={sectionFormTitle}>Email composer</p>
                  </div>

                  <label className={label}>
                    Email goal
                    <textarea
                      className={`${input} min-h-24`}
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      placeholder="What should this email try to accomplish?"
                    />
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {goalPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => setGoal(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={label}>
                      Tone
                      <select
                        className={input}
                        value={tone}
                        onChange={(event) => setTone(event.target.value as (typeof toneOptions)[number])}
                      >
                        {toneOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className={`${label} flex items-center gap-3 pt-6 text-sm text-foreground`}>
                      <input
                        type="checkbox"
                        checked={preferAi}
                        onChange={(event) => setPreferAi(event.target.checked)}
                        className="h-4 w-4 rounded border-border"
                      />
                      Try AI first, then fall back to template
                    </label>
                  </div>

                  <button type="button" className={btnPrimary} onClick={() => void onGenerateEmail()} disabled={generating}>
                    {generating ? 'Generating email…' : 'Generate email'}
                  </button>

                  {generated ? (
                    <div className="space-y-4 rounded-xl border border-border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</p>
                          <p className="mt-1 text-base font-semibold text-foreground">{generated.subject}</p>
                          {generated.preview ? <p className="mt-1 text-sm text-muted-foreground">{generated.preview}</p> : null}
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                          onClick={() => void handleCopy('subject', generated.subject)}
                        >
                          {copyState === 'subject' ? 'Copied' : 'Copy subject'}
                        </button>
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Body</p>
                          <button
                            type="button"
                            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50"
                            onClick={() => void handleCopy('body', generated.body)}
                          >
                            {copyState === 'body' ? 'Copied' : 'Copy body'}
                          </button>
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-card p-4 font-sans text-sm leading-relaxed text-foreground">
                          {generated.body}
                        </pre>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {mailtoHref ? (
                          <a href={mailtoHref} className={btnPrimary}>
                            Open email draft
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">Add an email address to this donor to open a draft.</span>
                        )}
                        <p className="text-xs text-muted-foreground">{generated.strategy}</p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className={`${card} space-y-5`}>
                  <div>
                    <p className={sectionFormTitle}>Recent donor activity</p>
                    <p className="mt-1 text-sm text-muted-foreground">This is the history the composer can use.</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Recent donations</p>
                    <div className="mt-3 space-y-3">
                      {profile.recentDonations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
                      ) : (
                        profile.recentDonations.map((donation) => (
                          <div key={donation.id} className="rounded-xl border border-border bg-background p-3">
                            <p className="text-sm font-medium text-foreground">
                              {donation.amount != null
                                ? formatMoney(donation.amount, donation.currencyCode ?? profile.preferredCurrencyCode)
                                : donation.donationType}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(donation.donationDate)} · {donation.donationType}
                              {donation.campaignName ? ` · ${donation.campaignName}` : ''}
                            </p>
                            {donation.notes ? <p className="mt-2 text-xs text-muted-foreground">{donation.notes}</p> : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground">Recent allocations</p>
                    <div className="mt-3 space-y-3">
                      {profile.recentAllocations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No linked allocations recorded yet.</p>
                      ) : (
                        profile.recentAllocations.map((allocation) => (
                          <div key={allocation.id} className="rounded-xl border border-border bg-background p-3">
                            <p className="text-sm font-medium text-foreground">{allocation.programArea}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {allocation.safehouseName ?? 'Unassigned safehouse'} ·{' '}
                              {formatMoney(allocation.amountAllocated, profile.preferredCurrencyCode)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
