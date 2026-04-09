import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { GraduationCap, Heart, Home, UserCheck, Users } from 'lucide-react'
import { getImpactSnapshots, getImpactSummary, type PublicImpactSnapshot, type PublicImpactSummary } from '../../api/impact'
import { SITE_DISPLAY_NAME } from '../../site'

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const crisisStats = [
  { value: '1 in 3', label: 'girls in Ghana experiences physical or sexual violence before age 18' },
  { value: '40%', label: 'of trafficking victims in West Africa are children under 18' },
  { value: '600,000+', label: 'children estimated in situations of child labor in Ghana (global estimates context)' },
  { value: '72%', label: 'of survivors lack consistent access to formal rehabilitation services' },
] as const

const allocation = [
  {
    pct: '45%',
    area: 'Wellbeing & counseling',
    desc: 'Trauma-informed therapy, health services, and nutritional support for every resident.',
  },
  {
    pct: '30%',
    area: 'Education',
    desc: 'School enrollment, bridge programs, vocational training, and tutoring.',
  },
  {
    pct: '25%',
    area: 'Operations',
    desc: 'Safehouse maintenance, dedicated staff, transport, and administration.',
  },
] as const

const btnPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90'
const btnOutline =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-8 text-sm font-medium text-primary transition-colors hover:bg-primary/10'

type GrowthPoint = {
  month: string
  label: string
  value: number
}

function metricNumber(value: string) {
  return value === '—' ? value : value
}

function buildStats(summary: PublicImpactSummary | null) {
  const base = [
    { icon: Home, color: 'text-accent' as const, tone: 'bg-accent/10' },
    { icon: GraduationCap, color: 'text-primary' as const, tone: 'bg-primary/10' },
    { icon: Heart, color: 'text-accent' as const, tone: 'bg-accent/10' },
    { icon: UserCheck, color: 'text-primary' as const, tone: 'bg-primary/10' },
    { icon: Users, color: 'text-accent' as const, tone: 'bg-accent/10' },
  ]
  const labels = [
    'Active safehouses',
    'School progress average',
    'Health score average',
    'Family reintegration rate',
    'Community partners',
  ]
  const descriptions = [
    'Safe spaces currently operating for girls in recovery.',
    'Average educational progress across active care plans.',
    'Wellbeing trend across active support records.',
    'Girls successfully transitioned into supported family settings.',
    'Supporters, advocates, and organizational partners in the network.',
  ]
  if (!summary) {
    return base.map((b, i) => ({ ...b, value: '—', label: labels[i] ?? '', description: descriptions[i] ?? '' }))
  }
  return [
    { ...base[0], value: String(summary.safehouseCount), label: labels[0], description: descriptions[0] },
    {
      ...base[1],
      value: `${summary.avgEducationProgressPercent.toFixed(0)}%`,
      label: labels[1],
      description: descriptions[1],
    },
    { ...base[2], value: summary.avgHealthScore.toFixed(2), label: labels[2], description: descriptions[2] },
    {
      ...base[3],
      value: `${summary.reintegrationSuccessRatePercent.toFixed(0)}%`,
      label: labels[3],
      description: descriptions[3],
    },
    { ...base[4], value: String(summary.supporterCount), label: labels[4], description: descriptions[4] },
  ]
}

function parseGrowthPoints(snapshots: PublicImpactSnapshot[]) {
  return snapshots
    .map((snapshot) => {
      const month = snapshot.metrics.month ?? snapshot.snapshotDate
      const raw = snapshot.metrics.total_residents
      const value = raw ? Number(raw) : Number.NaN
      if (!Number.isFinite(value)) return null
      const date = new Date(`${month}-01`)
      const label = date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
      return { month, label, value }
    })
    .filter((point): point is GrowthPoint => point != null)
    .sort((a, b) => a.month.localeCompare(b.month))
}

function buildChart(points: GrowthPoint[]) {
  const width = 640
  const height = 220
  const paddingX = 28
  const paddingTop = 16
  const paddingBottom = 36

  if (points.length === 0) {
    return { path: '', areaPath: '', points: [], gridLines: [], min: 0, max: 0, width, height, paddingBottom }
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const chartHeight = height - paddingTop - paddingBottom
  const chartWidth = width - paddingX * 2

  const plotted = points.map((point, index) => {
    const x = paddingX + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth)
    const y = paddingTop + (1 - (point.value - min) / range) * chartHeight
    return { ...point, x, y }
  })

  const path = plotted.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = `${path} L ${plotted[plotted.length - 1]?.x ?? paddingX} ${height - paddingBottom} L ${plotted[0]?.x ?? paddingX} ${height - paddingBottom} Z`
  const gridLines = [0, 0.5, 1].map((ratio) => paddingTop + ratio * chartHeight)

  return { path, areaPath, points: plotted, gridLines, min, max, width, height, paddingBottom }
}

export function ImpactPage() {
  const [summary, setSummary] = useState<PublicImpactSummary | null>(null)
  const [snapshots, setSnapshots] = useState<PublicImpactSnapshot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getImpactSummary(), getImpactSnapshots()])
      .then(([summaryResponse, snapshotResponse]) => {
        if (!cancelled) {
          setSummary(summaryResponse)
          setSnapshots(snapshotResponse)
          setLoadError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load impact data.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const stats = buildStats(summary)
  const growthPoints = useMemo(() => parseGrowthPoints(snapshots).slice(-8), [snapshots])
  const chart = useMemo(() => buildChart(growthPoints), [growthPoints])
  const growthDelta =
    growthPoints.length > 1 ? growthPoints[growthPoints.length - 1].value - growthPoints[0].value : null

  return (
    <div>
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 text-center lg:px-8">
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.p variants={fade} className="text-xs font-semibold uppercase tracking-widest text-accent">
              Our impact
            </motion.p>
            <motion.h1 variants={fade} className="mt-3 font-heading text-4xl font-bold text-foreground lg:text-5xl">
              Restoring hope, one life at a time.
            </motion.h1>
            <motion.p variants={fade} className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every number on this page represents a girl who deserved safety, love, and a future — and found it
              through {SITE_DISPLAY_NAME}. Your generosity makes this possible.
            </motion.p>
            <motion.div variants={fade} className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/login" className={btnPrimary}>
                Donate today
              </Link>
            </motion.div>
            {loadError && (
              <motion.p variants={fade} className="mt-4 text-sm text-destructive">
                {loadError}
              </motion.p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Why this matters</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              The crisis facing girls in Ghana
            </h2>
            <p className="mt-4 text-muted-foreground">
              Ghana faces serious risks of child abuse, exploitation, and trafficking. Behind every statistic is a
              child who needed someone to step in. We are that someone — and so are you.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {crisisStats.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-card p-6 text-center"
              >
                <p className="font-heading text-3xl font-bold text-primary">{c.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{c.label}</p>
              </motion.div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-muted-foreground">
            The cycle of poverty and abuse is not inevitable. Girls who receive holistic rehabilitation — safe
            housing, counseling, education, and family support — are far more likely to heal and thrive.{' '}
            {SITE_DISPLAY_NAME} exists to make that real.
          </p>
          <div className="mt-10 text-center">
            <Link to="/login" className={btnOutline}>
              Be part of the solution
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Our growth</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              Growth you can actually follow
            </h2>
            <p className="mt-4 text-muted-foreground">
              The headline number stays visible here, but it now sits beside the trend line and current operating
              metrics so the section reads like one story instead of separate boxes.
            </p>
          </div>

          <div className="mt-12 grid gap-6 xl:grid-cols-[0.95fr_1.45fr]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-[1.75rem] border border-border bg-card p-8 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Girls helped today</p>
              <p className="mt-4 font-heading text-5xl font-bold text-primary lg:text-6xl">
                {summary ? summary.activeResidents : '—'}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Girls currently reached through safe care, education, and reintegration support across our program
                network.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl bg-primary/6 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Current network</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {summary ? `${summary.safehouseCount} safehouses and ${summary.supporterCount} active supporters.` : 'Loading live network data.'}
                  </p>
                </div>
                <div className="rounded-2xl bg-accent/8 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Trend view</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {growthDelta != null
                      ? `${growthDelta >= 0 ? '+' : ''}${growthDelta} girls across the latest ${growthPoints.length} published monthly snapshots.`
                      : 'Published snapshots will populate the chart as they become available.'}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm lg:p-8"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] text-accent">Girls helped over time</p>
                  <h3 className="mt-2 font-heading text-2xl font-semibold text-foreground">Published monthly trend</h3>
                </div>
                {growthPoints.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {growthPoints[0].label} to {growthPoints[growthPoints.length - 1].label}
                  </p>
                )}
              </div>

              {growthPoints.length > 0 ? (
                <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-[linear-gradient(180deg,hsl(174_55%_28%/_0.08),transparent_55%),linear-gradient(180deg,hsl(0_0%_100%),hsl(40_20%_96%))] px-3 py-4 sm:px-5">
                  <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full" aria-label="Girls helped line chart">
                    {chart.gridLines.map((line) => (
                      <line key={line} x1="28" x2={chart.width - 28} y1={line} y2={line} stroke="currentColor" className="text-border" strokeDasharray="4 6" />
                    ))}
                    <path d={chart.areaPath} fill="hsl(174 55% 28% / 0.14)" />
                    <path d={chart.path} fill="none" stroke="hsl(174 55% 28%)" strokeWidth="4" strokeLinecap="round" />
                    {chart.points.map((point) => (
                      <g key={point.month}>
                        <circle cx={point.x} cy={point.y} r="5" fill="hsl(32 80% 55%)" />
                        <text x={point.x} y={chart.height - 12} textAnchor="middle" className="fill-current text-[12px] text-muted-foreground">
                          {point.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                  Growth snapshots will appear here once published data is available.
                </div>
              )}
            </motion.div>
          </div>

          <div className="mt-14">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">By the numbers</p>
                <h3 className="mt-2 font-heading text-2xl font-semibold text-foreground">A cleaner operational snapshot</h3>
              </div>
              <p className="max-w-xl text-right text-sm text-muted-foreground">
                These indicators now use a more editorial card layout so the values are easier to scan and compare.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {stats.map((s, t) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: t * 0.06 }}
                  className="rounded-[1.5rem] border border-border bg-card p-6 text-left"
                >
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${s.tone}`}>
                    <s.icon className={`h-6 w-6 ${s.color}`} />
                  </div>
                  <p className="font-heading text-3xl font-bold text-foreground">{metricNumber(String(s.value))}</p>
                  <p className="mt-2 text-base font-medium text-foreground">{s.label}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted py-20 lg:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">Life inside our homes</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
            A safe place to heal, learn, and grow
          </h2>
          <p className="mt-4 text-muted-foreground">
            Each safehouse is more than shelter — it is a community of healing. Girls receive trauma-informed support,
            attend school, build skills, and are surrounded by caregivers who believe in their futures. Many arrive
            frightened; with consistent care, they begin to laugh, dream, and plan again.
          </p>
          <div className="mt-8">
            <Link to="/login" className={btnPrimary}>
              Help a girl today
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/40 py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Transparency</p>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">Every dollar counts</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              We are committed to responsible stewardship. Here is how donations typically support our program areas.
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {allocation.map((a, t) => (
              <motion.div
                key={a.area}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: t * 0.08 }}
                className="rounded-2xl border border-border bg-card p-8 text-center"
              >
                <p className="font-heading text-4xl font-bold text-primary">{a.pct}</p>
                <p className="mt-2 font-heading text-lg font-semibold text-foreground">{a.area}</p>
                <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
