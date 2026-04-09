import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createInterventionPlan, getReintegrationReadinessCohort, type ResidentSummary } from '../../../api/admin'
import {
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  READINESS_READY_THRESHOLD,
  type ReintegrationResult,
  TIER_CONFIG,
  topImprovementLabel,
} from '../../../components/ml/reintegrationReadinessShared'
import {
  alertError,
  btnPrimary,
  card,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  statCardInner,
  statCardSub,
  statCardValue,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from '../shared/adminStyles'

type TierFilter = 'all' | ReintegrationResult['risk_tier']

type CohortResident = ResidentSummary & {
  readiness: ReintegrationResult
}

type SavedChecklistItem = {
  id: string
  text: string
  done: boolean
}

type SavedActionPlan = {
  owner: string
  dueDate: string
  nextReviewDate: string
  lastReviewedAt: string | null
  checklist: SavedChecklistItem[]
}

const ACTION_PLAN_STORAGE_KEY = 'reintegration-readiness-action-plans:v1'

type QuickAction = {
  label: string
  to: string
}

function loadSavedActionPlans(): Record<string, SavedActionPlan> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(ACTION_PLAN_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, SavedActionPlan>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveActionPlans(plans: Record<string, SavedActionPlan>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACTION_PLAN_STORAGE_KEY, JSON.stringify(plans))
}

function buildQuickActions(resident: CohortResident, area?: ReintegrationResult['top_improvements'][number]): QuickAction[] {
  const base: QuickAction[] = [
    { label: 'Open full case', to: `/admin/residents/${resident.id}` },
    { label: 'Resident pipeline', to: '/admin/resident-pipeline' },
  ]

  const feature = area?.feature ?? ''
  const mapped: QuickAction[] =
    feature.includes('attendance') || feature.includes('progress')
      ? [
          { label: 'Update resident record', to: `/admin/residents/${resident.id}` },
          { label: 'Add process recording', to: '/admin/process-recordings' },
        ]
      : feature.includes('health') || feature.includes('psych')
        ? [
            { label: 'Open health review', to: `/admin/residents/${resident.id}` },
            { label: 'Add process recording', to: '/admin/process-recordings' },
          ]
        : feature.includes('incident') || feature.includes('concern')
          ? [
              { label: 'Log home visit', to: '/admin/home-visitations' },
              { label: 'Open full case', to: `/admin/residents/${resident.id}` },
            ]
          : feature.includes('plan')
            ? [
                { label: 'Review case goals', to: `/admin/residents/${resident.id}` },
                { label: 'Case conferences', to: '/admin/case-conferences' },
              ]
            : [
                { label: 'Log home visit', to: '/admin/home-visitations' },
                { label: 'Case conferences', to: '/admin/case-conferences' },
              ]

  const deduped = new Map<string, QuickAction>()
  for (const action of [...mapped, ...base]) {
    deduped.set(action.label, action)
  }
  return [...deduped.values()].slice(0, 4)
}

function readinessNarrative(resident: CohortResident) {
  const topAreas = resident.readiness.top_improvements.slice(0, 2).map((area) => area.label.toLowerCase())
  const list = topAreas.length > 0 ? topAreas.join(' and ') : 'consistent case review'
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)

  if (prediction === 'Ready') {
    return `This resident is currently above the readiness threshold. Keep momentum by confirming transition steps and validating that ${list} stay stable.`
  }
  if (deriveReadinessTier(resident.readiness.reintegration_probability) === 'Moderate Readiness') {
    return `This resident is close to readiness, but ${list} still need focused follow-through before transition planning is fully safe.`
  }
  return `This resident is not yet ready for reintegration. The clearest blockers right now are ${list}, and those should be addressed before advancing the case.`
}

function checklistItems(resident: CohortResident) {
  const actions = resident.readiness.top_improvements.slice(0, 3).map((area) => area.suggestion)
  return [
    ...actions,
    'Review reintegration status and assign the next follow-up date.',
  ].slice(0, 4)
}

function defaultSavedPlan(resident: CohortResident): SavedActionPlan {
  return {
    owner: resident.assignedSocialWorker ?? '',
    dueDate: '',
    nextReviewDate: '',
    lastReviewedAt: null,
    checklist: checklistItems(resident).map((text, index) => ({
      id: `${resident.id}-${index}-${text}`,
      text,
      done: false,
    })),
  }
}

function CohortOverviewCard({
  counts,
  total,
  activeTier,
  onSelectTier,
}: {
  counts: Record<ReintegrationResult['risk_tier'], number>
  total: number
  activeTier: TierFilter
  onSelectTier: (tier: TierFilter) => void
}) {
  const segments: ReintegrationResult['risk_tier'][] = ['High Readiness', 'Moderate Readiness', 'Low Readiness']
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">Cohort Overview</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Current readiness mix across residents with a live prediction score. Click a card to filter the worklist.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => onSelectTier('all')}
          className={`rounded-xl border px-4 py-4 text-left transition ${
            activeTier === 'all' ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border hover:bg-muted/40'
          }`}
        >
          <p className={statCardInner}>All scored</p>
          <p className={statCardValue}>{total}</p>
          <p className={statCardSub}>Reset tier filter</p>
        </button>
        {segments.map((tier) => {
          const percent = total > 0 ? Math.round((counts[tier] / total) * 100) : 0
          const tone =
            tier === 'High Readiness'
              ? 'text-emerald-700'
              : tier === 'Moderate Readiness'
                ? 'text-amber-700'
                : 'text-red-700'

          return (
            <button
              key={tier}
              type="button"
              onClick={() => onSelectTier(activeTier === tier ? 'all' : tier)}
              className={`rounded-xl border px-4 py-4 text-left transition ${TIER_CONFIG[tier].border} ${TIER_CONFIG[tier].bg} ${
                activeTier === tier ? 'ring-2 ring-primary/20' : 'hover:brightness-[0.99]'
              }`}
            >
              <p className={statCardInner}>{tier}</p>
              <p className={statCardValue}>{counts[tier]}</p>
              <p className={`${statCardSub} ${tone}`}>{percent}% of scored residents</p>
            </button>
          )
        })}
      </div>
      <div className="flex h-4 overflow-hidden rounded-full bg-muted">
        {segments.map((tier) => {
          const width = total > 0 ? (counts[tier] / total) * 100 : 0
          return <div key={tier} className={`h-full ${TIER_CONFIG[tier].bar}`} style={{ width: `${width}%` }} />
        })}
      </div>
      <p className="text-xs text-muted-foreground">{total} residents currently scored.</p>
    </div>
  )
}

function ResidentActionDrawer({
  resident,
  savedPlan,
  onPlanChange,
  onClose,
}: {
  resident: CohortResident
  savedPlan: SavedActionPlan
  onPlanChange: (plan: SavedActionPlan) => void
  onClose: () => void
}) {
  const score = Math.round(resident.readiness.reintegration_probability * 100)
  const tier = deriveReadinessTier(resident.readiness.reintegration_probability)
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)
  const tierConfig = TIER_CONFIG[tier]
  const [planSaving, setPlanSaving] = useState(false)
  const [planMessage, setPlanMessage] = useState<string | null>(null)

  const completedCount = savedPlan.checklist.filter((item) => item.done).length

  const updateChecklist = (id: string, done: boolean) => {
    onPlanChange({
      ...savedPlan,
      checklist: savedPlan.checklist.map((item) => (item.id === id ? { ...item, done } : item)),
    })
  }

  const createPlanFromRecommendations = async () => {
    setPlanSaving(true)
    setPlanMessage(null)
    try {
      await createInterventionPlan({
        residentId: resident.id,
        planCategory: 'Reintegration',
        planDescription: savedPlan.checklist.map((item, index) => `${index + 1}. ${item.text}`).join('\n'),
        status: 'In Progress',
        targetDate: savedPlan.dueDate || null,
        caseConferenceDate: savedPlan.nextReviewDate || null,
        servicesProvided:
          resident.readiness.top_improvements
            .slice(0, 3)
            .map((area) => area.label)
            .join(', ') || 'Reintegration follow-up',
      })
      setPlanMessage('Intervention plan created from these recommendations.')
    } catch (error) {
      setPlanMessage(error instanceof Error ? error.message : 'Unable to create intervention plan.')
    } finally {
      setPlanSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <button type="button" className="flex-1 cursor-default" aria-label="Close details" onClick={onClose} />
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-background shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resident action plan</p>
              <h3 className="mt-1 text-xl font-semibold text-foreground">{resident.internalCode}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {resident.safehouseName ?? 'No safehouse'} · {resident.assignedSocialWorker ?? 'No assigned worker'}
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-foreground">
              {score}% readiness
            </span>
            <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${tierConfig.badge}`}>
              {prediction}
            </span>
            <span className="rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">
              {tier}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={`/admin/residents/${resident.id}`} className={btnPrimary}>
              Open full case
            </Link>
            <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => void createPlanFromRecommendations()} disabled={planSaving}>
              {planSaving ? 'Creating plan…' : 'Create reintegration plan'}
            </button>
            <Link to="/admin/resident-pipeline" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
              Resident pipeline
            </Link>
          </div>
        </div>

        <div className="space-y-6 px-5 py-5">
          <section className={`${card} space-y-3`}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Why this score</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{readinessNarrative(resident)}</p>
            </div>
          </section>

          <section className={`${card} space-y-4`}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Priority blockers</h4>
              <p className="mt-1 text-sm text-muted-foreground">Use these recommendations to move the case toward safe reintegration.</p>
            </div>
            {resident.readiness.top_improvements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific blockers surfaced in this model run. Maintain the current support plan and review the full case.</p>
            ) : (
              resident.readiness.top_improvements.slice(0, 3).map((area, index) => (
                <div key={area.feature} className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority {index + 1}</p>
                      <h5 className="mt-1 text-base font-semibold text-foreground">{area.label}</h5>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatFeatureValue(area.feature, area.resident_value)} current</div>
                      <div>{formatFeatureValue(area.feature, area.benchmark_value)} target</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{area.suggestion}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {buildQuickActions(resident, area).map((action) => (
                      <Link
                        key={`${area.feature}-${action.label}`}
                        to={action.to}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Reintegration work plan</h4>
              <p className="mt-1 text-sm text-muted-foreground">Track ownership, due dates, and what has already been completed.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</span>
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={savedPlan.owner}
                  onChange={(event) => onPlanChange({ ...savedPlan, owner: event.target.value })}
                  placeholder="Assigned worker"
                />
              </label>
              <label className="text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Due date</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={savedPlan.dueDate}
                  onChange={(event) => onPlanChange({ ...savedPlan, dueDate: event.target.value })}
                />
              </label>
              <label className="text-sm text-foreground">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Next review</span>
                <input
                  type="date"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={savedPlan.nextReviewDate}
                  onChange={(event) => onPlanChange({ ...savedPlan, nextReviewDate: event.target.value })}
                />
              </label>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Review status</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {savedPlan.lastReviewedAt ? `Reviewed ${new Date(savedPlan.lastReviewedAt).toLocaleString()}` : 'Not reviewed yet'}
                </p>
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                  onClick={() => onPlanChange({ ...savedPlan, lastReviewedAt: new Date().toISOString() })}
                >
                  Mark reviewed today
                </button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist progress</p>
                <p className="text-sm font-medium text-foreground">
                  {completedCount}/{savedPlan.checklist.length} complete
                </p>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {savedPlan.checklist.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) => updateChecklist(item.id, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border"
                    />
                    <span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            {planMessage ? <p className="text-sm text-muted-foreground">{planMessage}</p> : null}
          </section>

          <section className={`${card} space-y-3`}>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Case context</h4>
              <p className="mt-1 text-sm text-muted-foreground">Useful signals already available on the resident record.</p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Current risk</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{resident.currentRiskLevel ?? 'Not recorded'}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reintegration status</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{resident.reintegrationStatus ?? 'Not started'}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reintegration type</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{resident.reintegrationType ?? 'Not recorded'}</dd>
              </div>
              <div className="rounded-lg border border-border bg-background px-3 py-3">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Length of stay</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{resident.lengthOfStay ?? 'Not recorded'}</dd>
              </div>
            </dl>
          </section>

          <section className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-4 backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <Link to={`/admin/residents/${resident.id}`} className={btnPrimary}>
                Open full case
              </Link>
              <button
                type="button"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                onClick={() => void createPlanFromRecommendations()}
                disabled={planSaving}
              >
                {planSaving ? 'Creating…' : 'Create plan'}
              </button>
              <Link to="/admin/home-visitations" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Log visit
              </Link>
              <Link to="/admin/case-conferences" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Case conference
              </Link>
              <Link to="/admin/process-recordings" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                Add recording
              </Link>
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}

function PriorityCard({
  title,
  emptyMessage,
  residents,
}: {
  title: string
  emptyMessage: string
  residents: CohortResident[]
}) {
  return (
    <div className={`${card} space-y-4`}>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">Quick shortlist for case review and planning.</p>
      </div>
      {residents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          {residents.map((resident) => {
            const readinessPct = Math.round(resident.readiness.reintegration_probability * 100)
            const tier = deriveReadinessTier(resident.readiness.reintegration_probability)
            const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)
            const tierConfig = TIER_CONFIG[tier]
            const topArea = resident.readiness.top_improvements[0]
            return (
              <div key={resident.id} className="rounded-xl border border-border bg-background px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link to={`/admin/residents/${resident.id}`} className="font-medium text-primary hover:underline">
                      {resident.internalCode}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {resident.safehouseName ?? 'No safehouse'} · {resident.assignedSocialWorker ?? 'No assigned worker'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">{readinessPct}%</p>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${tierConfig.badge}`}>
                      {prediction}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground">
                  {topArea ? (
                    <>
                      <span className="font-medium">{topArea.label}:</span> {formatFeatureValue(topArea.feature, topArea.resident_value)} vs{' '}
                      {formatFeatureValue(topArea.feature, topArea.benchmark_value)}
                    </>
                  ) : (
                    'No immediate improvement gaps surfaced by the current model run.'
                  )}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function ReintegrationReadinessPage() {
  const [rows, setRows] = useState<CohortResident[]>([])
  const [safehouseFilter, setSafehouseFilter] = useState('all')
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [workerFilter, setWorkerFilter] = useState('all')
  const [rankingOrder, setRankingOrder] = useState<'desc' | 'asc'>('desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partialError, setPartialError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedResident, setSelectedResident] = useState<CohortResident | null>(null)
  const [savedPlans, setSavedPlans] = useState<Record<string, SavedActionPlan>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setSavedPlans(loadSavedActionPlans())
  }, [])

  const updateSavedPlan = useCallback((residentId: number, plan: SavedActionPlan) => {
    setSavedPlans((current) => {
      const next = { ...current, [String(residentId)]: plan }
      saveActionPlans(next)
      return next
    })
  }, [])

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setPartialError(null)

    try {
      const response = await getReintegrationReadinessCohort(controller.signal)
      if (controller.signal.aborted) return

      setRows(response.residents)
      setLastUpdated(new Date())

      if (response.failed_count > 0) {
        setPartialError(
          `Loaded ${response.residents.length} residents, but ${response.failed_count} readiness prediction${response.failed_count === 1 ? '' : 's'} failed.`,
        )
      }
    } catch (loadError) {
      if (!controller.signal.aborted) {
        setRows([])
        setError(loadError instanceof Error ? loadError.message : 'Failed to load reintegration readiness data.')
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void load()
    return () => abortRef.current?.abort()
  }, [load])

  const safehouseOptions = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((row) => row.safehouseName).filter((value): value is string => Boolean(value)))).sort()],
    [rows],
  )

  const workerOptions = useMemo(
    () => ['all', ...Array.from(new Set(rows.map((row) => row.assignedSocialWorker).filter((value): value is string => Boolean(value)))).sort()],
    [rows],
  )

  const baseFilteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        if (safehouseFilter !== 'all' && (row.safehouseName ?? '') !== safehouseFilter) return false
        if (workerFilter !== 'all' && (row.assignedSocialWorker ?? '') !== workerFilter) return false
        if (search.trim()) {
          const haystack = `${row.internalCode} ${row.safehouseName ?? ''} ${row.assignedSocialWorker ?? ''} ${topImprovementLabel(row.readiness)}`.toLowerCase()
          if (!haystack.includes(search.trim().toLowerCase())) return false
        }
        return true
      })
  }, [rows, safehouseFilter, workerFilter, search])

  const filteredRows = useMemo(() => {
    if (tierFilter === 'all') return baseFilteredRows
    return baseFilteredRows.filter(
      (row) => deriveReadinessTier(row.readiness.reintegration_probability) === tierFilter,
    )
  }, [baseFilteredRows, tierFilter])

  const rankingsRows = useMemo(() => {
    return [...filteredRows].sort((a, b) =>
      rankingOrder === 'desc'
        ? b.readiness.reintegration_probability - a.readiness.reintegration_probability
        : a.readiness.reintegration_probability - b.readiness.reintegration_probability,
    )
  }, [filteredRows, rankingOrder])

  const tierCounts = useMemo(() => {
    return baseFilteredRows.reduce<Record<ReintegrationResult['risk_tier'], number>>(
      (counts, row) => {
        counts[deriveReadinessTier(row.readiness.reintegration_probability)] += 1
        return counts
      },
      {
        'High Readiness': 0,
        'Moderate Readiness': 0,
        'Low Readiness': 0,
      },
    )
  }, [baseFilteredRows])

  const readyToTransition = useMemo(
    () =>
      filteredRows
        .filter(
          (row) => deriveReadinessPrediction(row.readiness.reintegration_probability) === 'Ready',
        )
        .sort((a, b) => b.readiness.reintegration_probability - a.readiness.reintegration_probability)
        .slice(0, 5),
    [filteredRows],
  )

  const needsAttention = useMemo(
    () =>
      filteredRows
        .filter((row) => deriveReadinessTier(row.readiness.reintegration_probability) === 'Low Readiness')
        .sort((a, b) => a.readiness.reintegration_probability - b.readiness.reintegration_probability)
        .slice(0, 5),
    [filteredRows],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className={pageTitle}>Reintigration Readiness</h2>
          <p className={pageDesc}>
            Population view of resident readiness predictions using the 70% / 50% cohort thresholds for quick triage and transition planning.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => void load()}>
          Refresh readiness
        </button>
      </div>

      {error && <div className={alertError}>{error}</div>}
      {partialError && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">{partialError}</div>}

      {loading ? (
        <div className="space-y-6">
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 rounded-xl bg-muted" />
              ))}
            </div>
            <div className="h-4 w-full rounded bg-muted" />
            <div className="h-3 w-36 rounded bg-muted" />
          </div>
          <div className={`${card} animate-pulse space-y-4`}>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-muted" />
                <div className="h-3 w-64 rounded bg-muted" />
              </div>
              <div className="h-6 w-24 rounded bg-muted" />
            </div>
            <div className="h-48 rounded-xl bg-muted" />
          </div>
        </div>
      ) : (
        <>
          <CohortOverviewCard
            counts={tierCounts}
            total={baseFilteredRows.length}
            activeTier={tierFilter}
            onSelectTier={setTierFilter}
          />

          <div className={`${card} grid gap-4 lg:grid-cols-4`}>
            <label className={label}>
              Safehouse
              <select className={input} value={safehouseFilter} onChange={(event) => setSafehouseFilter(event.target.value)}>
                {safehouseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All safehouses' : option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Risk tier
              <select className={input} value={tierFilter} onChange={(event) => setTierFilter(event.target.value as TierFilter)}>
                <option value="all">All tiers</option>
                <option value="High Readiness">High Readiness</option>
                <option value="Moderate Readiness">Moderate Readiness</option>
                <option value="Low Readiness">Low Readiness</option>
              </select>
            </label>
            <label className={label}>
              Assigned worker
              <select className={input} value={workerFilter} onChange={(event) => setWorkerFilter(event.target.value)}>
                {workerOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All workers' : option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Search
              <input
                className={input}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Resident code, worker, gap area…"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">Readiness Rankings</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ranked active residents using these thresholds: high readiness at {Math.round(READINESS_READY_THRESHOLD * 100)}%+, medium at 50% to under 70%, and low below 50%.
                </p>
              </div>
              {lastUpdated && <p className="text-xs text-muted-foreground">Updated {lastUpdated.toLocaleTimeString()}</p>}
            </div>

            <div className={tableWrap}>
              <table className="w-full text-left text-sm">
                <thead className={tableHead}>
                  <tr>
                    <th className="px-3 py-2">Resident</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>Tier</span>
                        <button
                          type="button"
                          onClick={() => setRankingOrder((current) => (current === 'desc' ? 'asc' : 'desc'))}
                          className="inline-flex items-center rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground transition-colors hover:bg-muted"
                          title={rankingOrder === 'desc' ? 'Switch to lowest readiness first' : 'Switch to highest readiness first'}
                          aria-label={rankingOrder === 'desc' ? 'Switch to lowest readiness first' : 'Switch to highest readiness first'}
                        >
                          <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                          {rankingOrder === 'desc' ? 'Desc' : 'Asc'}
                        </button>
                      </div>
                    </th>
                    <th className="px-3 py-2">Prediction</th>
                    <th className="px-3 py-2">Top improvement area</th>
                  </tr>
                </thead>
                <tbody className={tableBody}>
                  {rankingsRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className={emptyCell}>
                        No residents matched the current readiness filters.
                      </td>
                    </tr>
                  ) : (
                    rankingsRows.map((row) => {
                      const tier = deriveReadinessTier(row.readiness.reintegration_probability)
                      const prediction = deriveReadinessPrediction(row.readiness.reintegration_probability)
                      const tierConfig = TIER_CONFIG[tier]
                      const topArea = row.readiness.top_improvements[0]
                      return (
                        <tr
                          key={row.id}
                          className={`${tableRowHover} cursor-pointer`}
                          onClick={() => setSelectedResident(row)}
                        >
                          <td className="px-3 py-3 align-top">
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => setSelectedResident(row)}
                            >
                              {row.internalCode}
                            </button>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {row.safehouseName ?? 'No safehouse'} · {row.assignedSocialWorker ?? 'No assigned worker'}
                            </p>
                          </td>
                          <td className="px-3 py-3 align-top font-semibold text-foreground">
                            {Math.round(row.readiness.reintegration_probability * 100)}%
                          </td>
                          <td className="px-3 py-3 align-top">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${tierConfig.badge}`}>
                              {tier}
                            </span>
                          </td>
                          <td className="px-3 py-3 align-top text-foreground">{prediction}</td>
                          <td className="px-3 py-3 align-top">
                            {topArea ? (
                              <div>
                                <p className="font-medium text-foreground">{topArea.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {formatFeatureValue(topArea.feature, topArea.resident_value)} vs benchmark{' '}
                                  {formatFeatureValue(topArea.feature, topArea.benchmark_value)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Maintain current support plan</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <PriorityCard
              title="Ready to transition"
              emptyMessage="No residents in the current filtered cohort are over the readiness threshold yet."
              residents={readyToTransition}
            />
            <PriorityCard
              title="Needs attention"
              emptyMessage="No low-readiness residents matched the current filters."
              residents={needsAttention}
            />
          </div>
        </>
      )}

      {selectedResident ? (
        <ResidentActionDrawer
          resident={selectedResident}
          savedPlan={savedPlans[String(selectedResident.id)] ?? defaultSavedPlan(selectedResident)}
          onPlanChange={(plan) => updateSavedPlan(selectedResident.id, plan)}
          onClose={() => setSelectedResident(null)}
        />
      ) : null}
    </div>
  )
}
