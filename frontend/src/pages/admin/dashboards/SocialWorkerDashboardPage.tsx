import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  HeartHandshake,
  Home,
  Sparkles,
  TriangleAlert,
  Video,
  Waypoints,
} from 'lucide-react'
import {
  getDashboard,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getResidents,
  type DashboardSummary,
  type HomeVisitation,
  type InterventionPlan,
  type ProcessRecording,
  type ResidentSummary,
} from '../../../api/admin'
import { alertError, card, statCardInner, statCardSub, statCardValue } from '../shared/adminStyles'

const shortcuts = [
  {
    to: '/admin/residents',
    label: 'Residents',
    hint: 'Case files, status, and resident records',
    icon: ClipboardList,
  },
  {
    to: '/admin/process-recordings',
    label: 'Process recordings',
    hint: 'Worker-resident sessions, observations, interventions, and follow-up',
    icon: FileText,
  },
  {
    to: '/admin/home-visitations',
    label: 'Home visitations',
    hint: 'Family contact, field checks, and reintegration visits',
    icon: Video,
  },
  {
    to: '/admin/case-conferences',
    label: 'Case conferences',
    hint: 'Plans, conference dates, and service coordination',
    icon: CalendarDays,
  },
] as const

function toDateValue(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function daysUntil(value: string | null | undefined) {
  const time = toDateValue(value)
  if (time == null) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((time - startOfToday) / (1000 * 60 * 60 * 24))
}

function residentLabel(resident: ResidentSummary) {
  return resident.internalCode || resident.caseControlNo
}

export function SocialWorkerDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [recordings, setRecordings] = useState<ProcessRecording[]>([])
  const [visitations, setVisitations] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [dashboardData, residentRows, recordingRows, visitationRows, planRows] = await Promise.all([
          getDashboard(),
          getResidents({}),
          getProcessRecordings(),
          getHomeVisitations(),
          getInterventionPlans(),
        ])

        if (!cancelled) {
          setDashboard(dashboardData)
          setResidents(residentRows)
          setRecordings(recordingRows)
          setVisitations(visitationRows)
          setPlans(planRows)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load social worker dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const residentLookup = useMemo(() => new Map(residents.map((resident) => [resident.id, resident])), [residents])

  const openCases = residents.filter((resident) => resident.caseStatus.toLowerCase() !== 'closed')
  const reintegrationInProgress = residents.filter((resident) =>
    (resident.reintegrationStatus ?? '').toLowerCase().includes('in progress'),
  )
  const highRiskResidents = residents.filter((resident) => {
    const risk = (resident.currentRiskLevel ?? '').toLowerCase()
    return risk.includes('high') || risk.includes('critical')
  })

  const recentRecordings = [...recordings]
    .sort((a, b) => (toDateValue(b.sessionDate) ?? 0) - (toDateValue(a.sessionDate) ?? 0))
    .slice(0, 5)

  const recentVisits = [...visitations]
    .sort((a, b) => (toDateValue(b.visitDate) ?? 0) - (toDateValue(a.visitDate) ?? 0))
    .slice(0, 5)

  const upcomingPlans = [...plans]
    .filter((plan) => {
      const days = daysUntil(plan.caseConferenceDate)
      return days != null && days >= 0
    })
    .sort((a, b) => (toDateValue(a.caseConferenceDate) ?? 0) - (toDateValue(b.caseConferenceDate) ?? 0))
    .slice(0, 5)

  const overdueFollowUps = [
    ...plans
      .filter((plan) => {
        const days = daysUntil(plan.targetDate)
        return days != null && days < 0 && plan.status.toLowerCase() !== 'completed'
      })
      .map((plan) => ({
        id: `plan-${plan.id}`,
        residentId: plan.residentId,
        title: `${plan.planCategory} target overdue`,
        detail: plan.planDescription,
        date: plan.targetDate,
        kind: 'Plan target',
      })),
    ...visitations
      .filter((visit) => visit.followUpNeeded)
      .sort((a, b) => (toDateValue(b.visitDate) ?? 0) - (toDateValue(a.visitDate) ?? 0))
      .slice(0, 5)
      .map((visit) => ({
        id: `visit-${visit.id}`,
        residentId: visit.residentId,
        title: 'Visit follow-up needed',
        detail: visit.followUpNotes || visit.visitOutcome || visit.purpose || 'Review next field action.',
        date: visit.visitDate,
        kind: 'Home visit',
      })),
  ]
    .sort((a, b) => (toDateValue(a.date) ?? 0) - (toDateValue(b.date) ?? 0))
    .slice(0, 6)

  if (loading) return <p className="text-muted-foreground">Loading social worker dashboard…</p>

  if (error || !dashboard) {
    return <div className={alertError}>{error ?? 'No dashboard data available.'}</div>
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-[radial-gradient(circle_at_top_right,_rgba(21,128,61,0.12),_transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(12,74,110,0.93))] px-6 py-7 text-white lg:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                <HeartHandshake className="h-3.5 w-3.5" />
                Social Worker Dashboard
              </div>
              <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Caseload priorities, follow-up work, and documentation cues for daily practice
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">
                Use this space to track active cases, reintegration work, recent visits, upcoming conferences, and follow-up items that need attention.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Open cases</p>
                <p className="mt-2 text-3xl font-bold">{openCases.length}</p>
                <p className="mt-1 text-xs text-white/65">Residents currently active in program records</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Reintegration</p>
                <p className="mt-2 text-3xl font-bold">{reintegrationInProgress.length}</p>
                <p className="mt-1 text-xs text-white/65">
                  Success rate {dashboard.reintegration.successRatePercent.toFixed(0)}%
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Documentation volume</p>
                <p className="mt-2 text-3xl font-bold">{dashboard.processRecordingsCount}</p>
                <p className="mt-1 text-xs text-white/65">{dashboard.homeVisitationsLast90Days} home visits in the last 90 days</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 bg-card px-6 py-6 md:grid-cols-2 xl:grid-cols-4 xl:px-8">
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>High-risk residents</p>
            <p className={statCardValue}>{highRiskResidents.length}</p>
            <p className={statCardSub}>Residents marked high or critical in current risk level</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Upcoming conferences</p>
            <p className={statCardValue}>{dashboard.upcomingCaseConferences.length}</p>
            <p className={statCardSub}>Conference-linked intervention plans already on the calendar</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Recent visit activity</p>
            <p className={statCardValue}>{recentVisits.length}</p>
            <p className={statCardSub}>Most recent field or family visit entries surfaced below</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className={statCardInner}>Safehouse load</p>
            <p className={statCardValue}>{dashboard.activeResidentsTotal}</p>
            <p className={statCardSub}>Active residents across all safehouses in the current dataset</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <TriangleAlert className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Immediate follow-up queue</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Overdue plan targets and visit follow-up prompts that may need outreach, supervision, or documentation updates.
          </p>

          <div className="space-y-3">
            {overdueFollowUps.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No overdue follow-up items were detected from current plans and home visitation records.
              </div>
            ) : (
              overdueFollowUps.map((item) => {
                const resident = residentLookup.get(item.residentId)
                return (
                  <div key={item.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-primary">{item.kind}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{resident ? residentLabel(resident) : `Resident #${item.residentId}`}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${card} space-y-5`}>
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Reintegration watch</h3>
            </div>
            <div className="space-y-3">
              {reintegrationInProgress.slice(0, 6).map((resident) => (
                <div key={resident.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{residentLabel(resident)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {resident.safehouseName ?? 'No safehouse listed'} · {resident.caseCategory}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {resident.reintegrationStatus ?? '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {resident.reintegrationType ?? 'No reintegration type recorded'} · Current risk {resident.currentRiskLevel ?? '—'}
                  </p>
                </div>
              ))}
              {reintegrationInProgress.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  No residents are currently marked as reintegration in progress.
                </div>
              ) : null}
            </div>
          </div>

          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Safehouse occupancy context</h3>
            </div>
            <div className="space-y-3">
              {dashboard.safehouses.map((safehouse) => {
                const occupancyPercent = safehouse.capacity > 0 ? (safehouse.occupancy / safehouse.capacity) * 100 : 0
                return (
                  <div key={safehouse.id} className="rounded-2xl border border-border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{safehouse.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{safehouse.region}</p>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {safehouse.occupancy}/{safehouse.capacity}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.min(occupancyPercent, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Upcoming conferences & plan milestones</h3>
          </div>
          <div className="space-y-3">
            {upcomingPlans.length === 0 ? (
              <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                No upcoming case conferences or target milestones are currently scheduled.
              </div>
            ) : (
              upcomingPlans.map((plan) => {
                const resident = residentLookup.get(plan.residentId)
                const nextDate = plan.caseConferenceDate ?? plan.targetDate
                return (
                  <div key={plan.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{plan.planCategory}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{plan.planDescription}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {resident ? residentLabel(resident) : `Resident #${plan.residentId}`} · Status {plan.status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{formatDate(nextDate)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {plan.caseConferenceDate ? 'Case conference' : 'Target date'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Recent documentation activity</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Process recordings</p>
              <div className="mt-3 space-y-3">
                {recentRecordings.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No process recordings yet.
                  </div>
                ) : (
                  recentRecordings.map((recording) => (
                    <div key={recording.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{recording.residentInternalCode}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {recording.sessionType} · {recording.socialWorker}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(recording.sessionDate)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home visitations</p>
              <div className="mt-3 space-y-3">
                {recentVisits.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No home visit records yet.
                  </div>
                ) : (
                  recentVisits.map((visit) => (
                    <div key={visit.id} className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{visit.residentInternalCode}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {visit.visitType} · {visit.socialWorker}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatDate(visit.visitDate)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map(({ to, label, hint, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">{label}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
