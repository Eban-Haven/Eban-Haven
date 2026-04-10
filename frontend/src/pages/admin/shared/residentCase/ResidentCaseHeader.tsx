import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Play, Plus } from 'lucide-react'
import { btnPrimary } from '../adminStyles'
import { RESIDENT_SEMANTIC } from '../residentSemanticPalette'
import { CategoryBadge, ReintegrationBadge, RiskBadge, StatusBadge } from '../adminDataTable/AdminBadges'

type ActivityType = {
  id: 'counseling' | 'visit' | 'incident' | 'health' | 'education' | 'plan'
  label: string
}

type ReadinessSummary = {
  percent: number
  label: string
  prediction: 'Ready' | 'Not Ready'
  topImprovement: string
  tone: 'success' | 'warning' | 'danger'
}

type Props = {
  internalCode: string
  caseStatus?: string
  currentRiskLevel?: string
  reintegrationType?: string
  reintegrationStatus?: string
  safehouseName: string
  assignedWorker?: string
  admissionLabel?: string
  caseCategory?: string
  caseControlNo?: string
  presentAge?: string
  lengthOfStay?: string
  readiness: ReadinessSummary | null
  onOpenReadiness: () => void
  onToggleAddMenu: () => void
  onStartSession: () => void
  addMenuOpen: boolean
  activityTypes: readonly ActivityType[]
  onSelectActivity: (kind: ActivityType['id']) => void
}

export function ResidentCaseHeader({
  internalCode,
  caseStatus,
  currentRiskLevel,
  reintegrationType,
  reintegrationStatus,
  safehouseName,
  assignedWorker,
  admissionLabel,
  caseCategory,
  caseControlNo,
  presentAge,
  lengthOfStay,
  readiness,
  onOpenReadiness,
  onToggleAddMenu,
  onStartSession,
  addMenuOpen,
  activityTypes,
  onSelectActivity,
}: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const metadata = useMemo(
    () =>
      [
        safehouseName,
        assignedWorker || 'No worker assigned',
        admissionLabel ? `Admitted ${admissionLabel}` : '',
      ].filter(Boolean),
    [admissionLabel, assignedWorker, safehouseName],
  )

  const detailItems = useMemo(
    () =>
      [
        { label: 'Case category', value: caseCategory },
        { label: 'Case control no.', value: caseControlNo },
        { label: 'Present age', value: presentAge },
        { label: 'Length of stay', value: lengthOfStay },
        { label: 'Reintegration type', value: reintegrationType },
        { label: 'Reintegration status', value: reintegrationStatus },
      ].filter((item) => item.value?.trim()),
    [caseCategory, caseControlNo, lengthOfStay, presentAge, reintegrationStatus, reintegrationType],
  )

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 text-card-foreground shadow-sm sm:px-5 sm:py-3.5">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-2xl font-bold leading-tight text-foreground sm:text-[2rem]">{internalCode}</h1>
            {caseStatus ? <StatusBadge status={caseStatus} /> : null}
            {currentRiskLevel ? <RiskBadge level={currentRiskLevel} /> : null}
            {reintegrationType ? <CategoryBadge>{reintegrationType}</CategoryBadge> : null}
            {reintegrationStatus ? <ReintegrationBadge value={reintegrationStatus} /> : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {metadata.map((item, index) => (
              <span key={item} className="inline-flex items-center gap-2">
                {index > 0 ? <span className="text-muted-foreground/60">·</span> : null}
                <span>{item}</span>
              </span>
            ))}
            {detailItems.length ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-muted"
                aria-expanded={detailsOpen}
                onClick={() => setDetailsOpen((open) => !open)}
              >
                {detailsOpen ? 'Less' : 'More'}
                {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : null}
          </div>

          {detailsOpen ? (
            <dl className="grid gap-x-4 gap-y-2 border-t border-border/70 pt-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
              {detailItems.map((item) => (
                <div key={item.label} className="min-w-0">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 truncate text-foreground" title={item.value}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="flex flex-wrap items-stretch gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onOpenReadiness}
            className={`min-w-[12rem] rounded-xl border px-3.5 py-2.5 text-left transition-colors ${readinessToneClass(readiness?.tone)}`}
            title={readiness?.topImprovement ? `Top blocker: ${readiness.topImprovement}` : 'Open reintegration readiness'}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Reintegration readiness</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">{readiness ? `${readiness.percent}%` : '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {readiness ? `${readiness.label} · ${readiness.prediction}` : 'Open readiness plan'}
                </p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Open</span>
            </div>
            {readiness?.topImprovement ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">Top blocker: {readiness.topImprovement}</p>
            ) : null}
          </button>

          <div className="relative flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              onClick={onToggleAddMenu}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button type="button" className={`${btnPrimary} inline-flex items-center gap-2`} onClick={onStartSession}>
              <Play className="h-4 w-4" />
              Start session
            </button>

            {addMenuOpen ? (
              <div className="absolute right-0 top-full z-40 mt-2 min-w-[15rem] space-y-1 rounded-xl border border-border bg-card py-2 shadow-lg">
                {activityTypes.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted"
                    onClick={() => onSelectActivity(activity.id)}
                  >
                    {activity.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function readinessToneClass(tone: ReadinessSummary['tone'] | undefined) {
  if (tone === 'success') return `${RESIDENT_SEMANTIC.success.border} bg-[#E8F7EE]/80 hover:bg-[#E8F7EE]`
  if (tone === 'warning') return `${RESIDENT_SEMANTIC.warning.border} bg-[#FFF4E5]/80 hover:bg-[#FFF4E5]`
  if (tone === 'danger') return `${RESIDENT_SEMANTIC.danger.border} bg-[#FDECEC]/70 hover:bg-[#FDECEC]`
  return 'border-border bg-muted/20 hover:bg-muted/40'
}
