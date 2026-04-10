import { useEffect, useMemo, useState } from 'react'
import { HeartPulse, Home, Sparkles, TrendingUp, Users, Waypoints } from 'lucide-react'
import { getDashboard, getReportsSummary, type DashboardSummary, type ReportsSummary } from '../../../api/admin'
import {
  alertError,
  card,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
} from '../shared/adminStyles'
import { formatUsd, formatUsdCompact } from '../../../utils/currency'

/** Bar / progress fills — aligned with resident Goals donut palette */
const RPT = {
  teal: 'bg-[#3D6D66] dark:bg-[#4f8f86]',
  navy: 'bg-[#2D424D] dark:bg-[#4a6670]',
  ochre: 'bg-[#E09E4E] dark:bg-[#c88a42]',
  peach: 'bg-[#E8A87C] dark:bg-[#d09068]',
} as const

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

function formatMonthLabel(month: string) {
  const date = new Date(`${month}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return month
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function parseYearMonth(m: string): { y: number; mon: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(m.trim())
  if (!match) return null
  return { y: Number(match[1]), mon: Number(match[2]) }
}

function formatYearMonth(y: number, mon: number) {
  return `${y}-${String(mon).padStart(2, '0')}`
}

/** Every calendar month from start through end (inclusive), in order. */
function expandMonthRangeInclusive(startKey: string, endKey: string): string[] {
  const a = parseYearMonth(startKey)
  const b = parseYearMonth(endKey)
  if (!a || !b) return []
  const out: string[] = []
  let y = a.y
  let mon = a.mon
  const endOrd = b.y * 100 + b.mon
  while (y * 100 + mon <= endOrd) {
    out.push(formatYearMonth(y, mon))
    mon += 1
    if (mon > 12) {
      mon = 1
      y += 1
    }
  }
  return out
}

function innerPanelClassName(extra = '') {
  return `rounded-lg border border-border bg-muted/15 p-4 ${extra}`.trim()
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportsSummary | null>(null)
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [donationTrendWindow, setDonationTrendWindow] = useState<'all' | '36' | '24' | '12'>('all')

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const [reportsSummary, dashboardSummary] = await Promise.all([getReportsSummary(), getDashboard()])
        if (!cancelled) {
          setReports(reportsSummary)
          setDashboard(dashboardSummary)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load reports')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const sortedRawDonationTrends = useMemo(
    () => [...(reports?.donationTrends ?? [])].sort((a, b) => a.month.localeCompare(b.month)),
    [reports?.donationTrends],
  )

  const changePercent = useMemo(() => {
    if (sortedRawDonationTrends.length < 2) return null
    const latest = sortedRawDonationTrends[sortedRawDonationTrends.length - 1]
    const prev = sortedRawDonationTrends[sortedRawDonationTrends.length - 2]
    if (prev.monetaryTotalPhp <= 0) return null
    return ((latest.monetaryTotalPhp - prev.monetaryTotalPhp) / prev.monetaryTotalPhp) * 100
  }, [sortedRawDonationTrends])

  const latestTrend = sortedRawDonationTrends[sortedRawDonationTrends.length - 1]

  const donationTrendsFull = useMemo(() => {
    const raw = reports?.donationTrends ?? []
    if (raw.length === 0) return []
    const sorted = [...raw].sort((a, b) => a.month.localeCompare(b.month))
    const map = new Map(raw.map((t) => [t.month, t]))
    const months = expandMonthRangeInclusive(sorted[0].month, sorted[sorted.length - 1].month)
    return months.map((month) => map.get(month) ?? { month, monetaryTotalPhp: 0, donationCount: 0 })
  }, [reports?.donationTrends])

  const donationTrends = useMemo(() => {
    if (donationTrendsFull.length === 0) return []
    if (donationTrendWindow === 'all') return donationTrendsFull
    const n = Number(donationTrendWindow)
    return donationTrendsFull.slice(-n)
  }, [donationTrendsFull, donationTrendWindow])

  if (loading) return <p className="text-sm text-muted-foreground">Loading reports…</p>

  if (error || !reports || !dashboard) {
    return <div className={alertError}>{error ?? 'No report data available.'}</div>
  }

  const maxTrend = Math.max(...donationTrends.map((t) => t.monetaryTotalPhp), 1)
  const trendRangeLabel =
    donationTrendsFull.length > 0
      ? `${formatMonthLabel(donationTrendsFull[0].month)} – ${formatMonthLabel(donationTrendsFull[donationTrendsFull.length - 1].month)}`
      : null
  const strongestSafehouse = [...reports.safehousePerformance].sort(
    (a, b) =>
      (b.avgEducationProgress ?? 0) + (b.avgHealthScore ?? 0) - ((a.avgEducationProgress ?? 0) + (a.avgHealthScore ?? 0)),
  )[0]
  const highestOccupancy = [...reports.safehousePerformance].sort((a, b) => b.occupancyRatePercent - a.occupancyRatePercent)[0]
  const totalServicePillars =
    reports.annualAccomplishmentStyle.servicesProvided.caringSessions +
    reports.annualAccomplishmentStyle.servicesProvided.healingSessions +
    reports.annualAccomplishmentStyle.servicesProvided.teachingSessions

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Reports & Insights</h2>
        <p className={pageDesc}>
          Program performance, donor momentum, and outcome reporting — donation trends, resident signals, safehouse
          comparisons, reintegration progress, and annual accomplishment-style summaries.
        </p>
      </div>

      <section className={card}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Residents served</p>
            <p className={statCardValue}>{reports.annualAccomplishmentStyle.beneficiaryResidentsServed}</p>
            <p className={statCardSub}>
              Active {reports.activeResidents} · Closed {reports.closedResidents}
            </p>
          </div>
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Monetary giving</p>
            <p className={statCardValue}>{formatUsdCompact(reports.totalMonetaryDonationsPhp)}</p>
            <p className={statCardSub}>
              {changePercent != null
                ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}% vs prior month`
                : 'Trend comparison available as data grows'}
            </p>
          </div>
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Reintegration success</p>
            <p className={statCardValue}>{dashboard.reintegration.successRatePercent.toFixed(0)}%</p>
            <p className={statCardSub}>
              Completed {dashboard.reintegration.completedCount} · In progress {dashboard.reintegration.inProgressCount}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-6 md:grid-cols-2 xl:grid-cols-4">
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Education progress</p>
            <p className={statCardValue}>{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
            <p className={statCardSub}>{reports.outcomeMetrics.educationRecordsCount} progress records logged</p>
          </div>
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Health improvement</p>
            <p className={statCardValue}>{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
            <p className={statCardSub}>{reports.outcomeMetrics.healthRecordsCount} wellbeing records logged</p>
          </div>
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Service touchpoints</p>
            <p className={statCardValue}>{totalServicePillars}</p>
            <p className={statCardSub}>Caring, healing, and teaching sessions combined</p>
          </div>
          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Case documentation</p>
            <p className={statCardValue}>{reports.processRecordingsCount}</p>
            <p className={statCardSub}>Process recording entries across the program</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(21rem,0.95fr)]">
        <div className={`${card} space-y-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Donation trends over time</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Monthly monetary contributions and gift count trends to support campaign timing, stewardship, and budget
                planning.
              </p>
            </div>
            {latestTrend ? (
              <div className={innerPanelClassName('text-right')}>
                <p className={statCardInner}>Latest month</p>
                <p className="mt-2 font-heading text-xl font-bold text-foreground">{formatUsd(latestTrend.monetaryTotalPhp)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{latestTrend.donationCount} gifts recorded</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_14rem]">
            <div className={innerPanelClassName('space-y-3')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {trendRangeLabel ? (
                    <>
                      Full series <span className="font-medium text-foreground">{trendRangeLabel}</span>
                      {donationTrendWindow !== 'all' ? (
                        <span className="text-muted-foreground"> · showing last {donationTrendWindow} months</span>
                      ) : null}
                    </>
                  ) : null}
                </p>
                <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
                  {(
                    [
                      ['all', 'All'],
                      ['36', '36 mo'],
                      ['24', '24 mo'],
                      ['12', '12 mo'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDonationTrendWindow(key)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        donationTrendWindow === key
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {donationTrends.length === 0 ? (
                <p className="text-sm text-muted-foreground">No monetary donation months in the dataset yet.</p>
              ) : (
                <div className="overflow-x-auto pb-1">
                  <div className="inline-flex items-stretch gap-1.5 sm:gap-2">
                    {donationTrends.map((trend) => {
                      const frac = maxTrend > 0 ? trend.monetaryTotalPhp / maxTrend : 0
                      const barPct = Math.max(frac * 100, trend.monetaryTotalPhp > 0 ? 5 : 1)
                      return (
                        <div key={trend.month} className="flex h-64 w-8 shrink-0 flex-col sm:w-9">
                          <div className="flex min-h-0 flex-1 flex-col justify-end">
                            <div
                              className={`min-h-[3px] w-full rounded-t-md ${RPT.teal} ${trend.monetaryTotalPhp <= 0 ? 'opacity-40' : ''}`}
                              style={{ height: `${barPct}%` }}
                              title={`${trend.month}: ${formatUsd(trend.monetaryTotalPhp)} · ${trend.donationCount} gifts`}
                            />
                          </div>
                          <span className="mt-1.5 block min-h-[2.25rem] text-center text-[9px] font-medium leading-tight text-muted-foreground sm:text-[10px]">
                            {formatMonthLabel(trend.month)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Months with no gifts appear as short markers so the timeline stays continuous from first to last donation month.
              </p>
            </div>

            <div className="space-y-3">
              <div className={innerPanelClassName()}>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  Momentum signal
                </div>
                <p className="mt-3 font-heading text-2xl font-bold text-foreground">
                  {changePercent != null ? `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%` : '—'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Month-over-month monetary donation change</p>
              </div>

              <div className={innerPanelClassName()}>
                <p className="text-sm font-medium text-foreground">Planning note</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Use rising months to time stewardship asks and slower months to plan re-engagement sequences or campaign
                  refreshes.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Waypoints className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Reintegration snapshot</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className={innerPanelClassName()}>
                <p className={statCardInner}>Success rate</p>
                <p className={statCardValue}>{dashboard.reintegration.successRatePercent.toFixed(1)}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${RPT.teal}`}
                    style={{ width: `${clampPercent(dashboard.reintegration.successRatePercent)}%` }}
                  />
                </div>
              </div>
              <div className={innerPanelClassName()}>
                <p className={statCardInner}>Completed</p>
                <p className={statCardValue}>{dashboard.reintegration.completedCount}</p>
                <p className={statCardSub}>Residents marked completed in reintegration tracking</p>
              </div>
              <div className={innerPanelClassName()}>
                <p className={statCardInner}>In progress</p>
                <p className={statCardValue}>{dashboard.reintegration.inProgressCount}</p>
                <p className={statCardSub}>Cases currently moving through reintegration work</p>
              </div>
            </div>
          </div>

          <div className={`${card} space-y-4`}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Executive highlights</h3>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <li className={innerPanelClassName()}>
                Strongest overall safehouse signal:{' '}
                <span className="font-medium text-foreground">{strongestSafehouse?.name ?? 'No comparison yet'}</span>
              </li>
              <li className={innerPanelClassName()}>
                Highest occupancy:{' '}
                <span className="font-medium text-foreground">
                  {highestOccupancy ? `${highestOccupancy.name} (${highestOccupancy.occupancyRatePercent}%)` : 'No occupancy data'}
                </span>
              </li>
              <li className={innerPanelClassName()}>
                Annual accomplishment framing remains ready for agency reporting with beneficiary counts, service pillars, and
                outcome highlights below.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <h3 className="text-base font-semibold text-foreground">Resident outcome metrics</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Education progress and health improvement indicators derived from resident records to support service planning
            and reporting.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className={innerPanelClassName('p-5')}>
              <p className={statCardInner}>Average education progress</p>
              <p className={statCardValue}>{reports.outcomeMetrics.avgEducationProgressPercent.toFixed(1)}%</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${RPT.navy}`}
                  style={{ width: `${clampPercent(reports.outcomeMetrics.avgEducationProgressPercent)}%` }}
                />
              </div>
              <p className={statCardSub}>Based on {reports.outcomeMetrics.educationRecordsCount} education entries</p>
            </div>

            <div className={innerPanelClassName('p-5')}>
              <p className={statCardInner}>Average health score</p>
              <p className={statCardValue}>{reports.outcomeMetrics.avgHealthScore.toFixed(2)}</p>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full ${RPT.teal}`}
                  style={{ width: `${clampPercent(reports.outcomeMetrics.avgHealthScore * 10)}%` }}
                />
              </div>
              <p className={statCardSub}>Based on {reports.outcomeMetrics.healthRecordsCount} wellbeing entries</p>
            </div>
          </div>

          <div className={innerPanelClassName('p-5')}>
            <p className="text-sm font-medium text-foreground">Decision support note</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use outcome deltas alongside safehouse performance to identify where coaching, health interventions, or academic
              support may need to be intensified.
            </p>
          </div>
        </div>

        <div className={`${card} space-y-5`}>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <h3 className="text-base font-semibold text-foreground">Annual Accomplishment Report lens</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Structured to mirror accomplishment-report style summaries used for agency and board reporting.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className={`${innerPanelClassName()} text-center`}>
              <p className={`font-heading text-2xl font-bold text-[#3D6D66] dark:text-[#6eb5aa]`}>
                {reports.annualAccomplishmentStyle.servicesProvided.caringSessions}
              </p>
              <p className={`mt-2 ${statCardInner}`}>Caring</p>
            </div>
            <div className={`${innerPanelClassName()} text-center`}>
              <p className={`font-heading text-2xl font-bold text-[#E09E4E] dark:text-[#ebb866]`}>
                {reports.annualAccomplishmentStyle.servicesProvided.healingSessions}
              </p>
              <p className={`mt-2 ${statCardInner}`}>Healing</p>
            </div>
            <div className={`${innerPanelClassName()} text-center`}>
              <p className={`font-heading text-2xl font-bold text-[#2D424D] dark:text-[#7a9aa8]`}>
                {reports.annualAccomplishmentStyle.servicesProvided.teachingSessions}
              </p>
              <p className={`mt-2 ${statCardInner}`}>Teaching</p>
            </div>
          </div>

          <div className={innerPanelClassName()}>
            <p className={statCardInner}>Beneficiaries served</p>
            <p className={statCardValue}>{reports.annualAccomplishmentStyle.beneficiaryResidentsServed}</p>
            <p className={statCardSub}>Resident beneficiaries included in the current reporting set</p>
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Program outcomes</p>
            <ul className="mt-3 space-y-3">
              {reports.annualAccomplishmentStyle.programOutcomeHighlights.map((highlight) => (
                <li key={highlight} className={innerPanelClassName('text-sm leading-relaxed text-muted-foreground')}>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`${card} space-y-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Safehouse performance comparisons</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare occupancy, education support, and health indicators across safehouses to inform staffing and resource
              allocation.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {reports.safehousePerformance.map((safehouse) => (
            <article key={safehouse.safehouseId} className={innerPanelClassName('p-5')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-foreground">{safehouse.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {safehouse.activeResidents} active residents · capacity {safehouse.capacity}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {safehouse.occupancyRatePercent}%
                </span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Occupancy</span>
                    <span>{safehouse.occupancyRatePercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${RPT.navy}`}
                      style={{ width: `${clampPercent(safehouse.occupancyRatePercent)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Education progress</span>
                    <span>{safehouse.avgEducationProgress != null ? `${safehouse.avgEducationProgress.toFixed(1)}%` : '—'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${RPT.ochre}`}
                      style={{ width: `${clampPercent(safehouse.avgEducationProgress ?? 0)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Health score</span>
                    <span>{safehouse.avgHealthScore != null ? safehouse.avgHealthScore.toFixed(2) : '—'}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${RPT.teal}`}
                      style={{ width: `${clampPercent((safehouse.avgHealthScore ?? 0) * 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
