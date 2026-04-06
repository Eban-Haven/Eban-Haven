import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  GraduationCap,
  Heart,
  Home,
  UserCheck,
  Users,
} from 'lucide-react'
import { getImpactSnapshots, getImpactSummary, type PublicImpactSnapshot, type PublicImpactSummary } from '../api/impact'

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

const allocation = [
  {
    pct: '45%',
    area: 'Wellbeing & counseling',
    desc: 'Trauma-informed therapy, health services, and nutritional support',
  },
  {
    pct: '30%',
    area: 'Education',
    desc: 'Bridge programs, school supplies, vocational training, and tutoring',
  },
  {
    pct: '25%',
    area: 'Operations',
    desc: 'Safehouse maintenance, staff support, transport, and administrative costs',
  },
] as const

const staggerHeader = {
  visible: { transition: { staggerChildren: 0.12 } },
}

const yf = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
}

const moneyPhp = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'PHP' })

function buildStats(summary: PublicImpactSummary | null) {
  const base = [
    { icon: Users, color: 'text-primary' as const },
    { icon: Home, color: 'text-accent' as const },
    { icon: GraduationCap, color: 'text-primary' as const },
    { icon: Heart, color: 'text-accent' as const },
    { icon: UserCheck, color: 'text-primary' as const },
    { icon: Users, color: 'text-accent' as const },
  ]
  if (!summary) {
    return base.map((b, i) => ({
      ...b,
      value: '—',
      label: ['Active residents', 'Safehouses', 'Education (avg.)', 'Health score (avg.)', 'Reintegration rate', 'Supporters'][i],
    }))
  }
  return [
    { ...base[0], value: String(summary.activeResidents), label: 'Active residents (aggregate)' },
    { ...base[1], value: String(summary.safehouseCount), label: 'Active safehouses' },
    {
      ...base[2],
      value: `${summary.avgEducationProgressPercent.toFixed(0)}%`,
      label: 'Avg. education progress (records)',
    },
    { ...base[3], value: summary.avgHealthScore.toFixed(2), label: 'Avg. general health score (1–5 scale)' },
    {
      ...base[4],
      value: `${summary.reintegrationSuccessRatePercent.toFixed(0)}%`,
      label: 'Reintegration success rate (anonymized)',
    },
    { ...base[5], value: String(summary.supporterCount), label: 'Supporters in network' },
  ]
}

export function ImpactPage() {
  const [summary, setSummary] = useState<PublicImpactSummary | null>(null)
  const [snapshots, setSnapshots] = useState<PublicImpactSnapshot[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([getImpactSummary(), getImpactSnapshots()])
      .then(([s, sn]) => {
        if (!cancelled) {
          setSummary(s)
          setSnapshots(sn.slice(0, 14))
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

  return (
    <div>
      <section className="relative overflow-hidden py-20 lg:py-28">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 text-center lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerHeader}
            className="mx-auto max-w-3xl"
          >
            <motion.span
              variants={yf}
              className="text-xs font-semibold uppercase tracking-widest text-accent"
            >
              Transparency report
            </motion.span>
            <motion.h1
              variants={yf}
              className="mt-3 font-heading text-4xl font-bold text-foreground lg:text-5xl"
            >
              Our impact
            </motion.h1>
            <motion.p variants={yf} className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Aggregated, anonymized metrics from our operational dataset: outcomes, progress indicators, and
              resource use — no personally identifying information is shown on this public dashboard.
            </motion.p>
            {summary && (
              <motion.p variants={yf} className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Public monetary support (prior calendar month):{' '}
                <span className="font-medium text-foreground">{moneyPhp.format(summary.donationsLastMonthPhp)}</span>
              </motion.p>
            )}
            {loadError && (
              <motion.p variants={yf} className="mt-4 text-sm text-destructive">
                {loadError}
              </motion.p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="pb-20 lg:pb-28">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
            {stats.map((s, t) => (
              <motion.div
                key={s.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: t * 0.08 },
                  },
                }}
                className="rounded-2xl border border-border bg-card p-6 text-center transition-shadow hover:shadow-md lg:p-8"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <p className="font-heading text-3xl font-bold text-foreground lg:text-4xl">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-20 lg:py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fade}
            className="mb-16 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">Published snapshots</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              Monthly impact updates
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Selected rows from our public impact snapshot feed (anonymized aggregates).
            </p>
          </motion.div>
          <div className="space-y-6">
            {snapshots.length === 0 && !loadError ? (
              <p className="text-center text-sm text-muted-foreground">Loading snapshots…</p>
            ) : (
              snapshots.map((u, t) => (
                <motion.div
                  key={u.id}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: {
                      opacity: 1,
                      x: 0,
                      transition: { duration: 0.5, delay: t * 0.05 },
                    },
                  }}
                  className="rounded-2xl border border-border bg-card p-6 lg:p-8"
                >
                  <span className="text-xs font-medium text-accent">
                    {u.snapshotDate} {u.metrics.month ? `· ${u.metrics.month}` : ''}
                  </span>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-foreground">{u.headline}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{u.summaryText}</p>
                  {Object.keys(u.metrics).length > 0 && (
                    <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {Object.entries(u.metrics).map(([k, v]) =>
                        v ? (
                          <div key={k}>
                            <dt className="font-medium capitalize text-foreground">{k.replace(/_/g, ' ')}</dt>
                            <dd>{v}</dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fade}
            className="mb-16 text-center"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-accent">
              Your generosity at work
            </span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground lg:text-4xl">
              Where donations go
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Illustrative allocation mix aligned with program areas tracked in our donation allocation dataset
              (education, wellbeing, operations, transport, outreach).
            </p>
          </motion.div>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            {allocation.map((a, t) => (
              <motion.div
                key={a.area}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, delay: t * 0.1 },
                  },
                }}
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
