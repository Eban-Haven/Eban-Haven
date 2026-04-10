import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  createIncidentReport,
  deleteHomeVisitation,
  deleteIncidentReport,
  deleteProcessRecording,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getResident,
  getSafehouses,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  patchIncidentReport,
  patchResident,
  type EducationRecord,
  type HealthRecord,
  type HomeVisitation,
  type InterventionPlan,
  type JsonTableRow,
  type ProcessRecording,
  type ResidentDetail,
  type SafehouseOption,
} from '../../../../api/admin'
import { alertError, btnPrimary, card, input, label, pageDesc, pageTitle } from '../adminStyles'
import { BooleanBadge, CategoryBadge, ReintegrationBadge, RiskBadge, StatusBadge } from '../adminDataTable/AdminBadges'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { AdminDeleteModal } from '../adminDataTable/AdminDeleteModal'
import { CASE_STATUSES, RISK_LEVELS, SEX_OPTIONS } from './caseConstants'
import { EducationSection, HealthSection, HomeVisitDrawer, ProcessRecordingDrawer } from './CareProgressContent'
import { PlansTabContent } from './PlansTabContent'
import { SessionWorkflowDrawer } from './SessionWorkflowDrawer'
import {
  buildTimelineItems,
  filterTimeline,
  planIsOverdue,
  type MainWorkspaceTab,
  type TimelineItem,
  type TimelineKind,
  type WorkspaceQuickAction,
} from './caseWorkspaceModel'
import { CaseDrawer, EmptyState, ToggleField } from './caseUi'

function gf(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    if (fields[k] != null && fields[k] !== '') return fields[k]
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
    if (fields[snake] != null && fields[snake] !== '') return fields[snake]
  }
  return ''
}

const TAB_LABELS: { k: MainWorkspaceTab; label: string }[] = [
  { k: 'overview', label: 'Overview' },
  { k: 'activity', label: 'Activity' },
  { k: 'plans', label: 'Plans & goals' },
  { k: 'safety', label: 'Safety' },
  { k: 'profile', label: 'Profile' },
]

const ACTIVITY_TYPES = [
  { id: 'counseling' as const, label: 'Add session' },
  { id: 'visit' as const, label: 'Add home visit' },
  { id: 'incident' as const, label: 'Add incident' },
  { id: 'health' as const, label: 'Add health record' },
  { id: 'education' as const, label: 'Add education record' },
  { id: 'plan' as const, label: 'Add plan' },
]

type GoalKey = 'health' | 'education' | 'safety'

type CurrentStateCard = {
  key: GoalKey
  label: string
  currentLabel: string
  targetLabel?: string
  chip: string
  chipTone: 'success' | 'warning' | 'danger' | 'default'
  trend: 'up' | 'down' | 'flat'
  subtext: string
}

type GoalCardData = {
  key: GoalKey
  label: string
  target: number
  current: number | null
  currentLabel: string
  targetLabel: string
  detail: string
}

type AttentionItem = {
  id: string
  label: string
  count?: number
  tone: 'danger' | 'warning' | 'default'
  actionLabel: string
  action: WorkspaceQuickAction
}

type TaskItem = {
  id: string
  source: string
  date: string
  summary: string
  action: WorkspaceQuickAction
}

function byNewestDate<T>(rows: T[], pickDate: (row: T) => string | null | undefined): T[] {
  return [...rows].sort((a, b) => {
    const ta = pickDate(a) ? new Date(pickDate(a)!).getTime() : 0
    const tb = pickDate(b) ? new Date(pickDate(b)!).getTime() : 0
    return tb - ta
  })
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function percentage(value: number | null, target: number) {
  if (value == null || target <= 0) return 0
  return clamp((value / target) * 100, 0, 100)
}

function scoreLabel(value: number | null, digits = 1) {
  return value == null ? '—' : value.toFixed(digits)
}

function attendanceLabel(value: number | null) {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function trendFromNumbers(current: number | null | undefined, previous: number | null | undefined): 'up' | 'down' | 'flat' {
  if (current == null || previous == null) return 'flat'
  if (current > previous) return 'up'
  if (current < previous) return 'down'
  return 'flat'
}

function severityPenalty(value: string): number {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'high') return 0.95
  if (normalized === 'medium') return 0.55
  if (normalized === 'low') return 0.25
  return 0.4
}

function deriveSafetyScore(visitations: HomeVisitation[], incidents: JsonTableRow[]): number | null {
  if (visitations.length === 0 && incidents.length === 0) return null
  let score = 5

  for (const incident of byNewestDate(incidents, (row) => row.fields.incident_date).slice(0, 5)) {
    const unresolved = (incident.fields.resolved ?? '').toLowerCase() !== 'true'
    if (!unresolved) continue
    score -= severityPenalty(incident.fields.severity ?? '')
  }

  for (const visit of byNewestDate(visitations, (row) => row.visitDate).slice(0, 3)) {
    if (visit.safetyConcernsNoted) score -= 0.55
    if (visit.followUpNeeded) score -= 0.25
    const outcome = (visit.visitOutcome ?? '').trim().toLowerCase()
    if (outcome === 'unfavorable') score -= 0.35
    if (outcome === 'needs improvement') score -= 0.15
  }

  return clamp(Number(score.toFixed(2)), 1, 5)
}

function findLatestPlan(plans: InterventionPlan[], categories: string[]): InterventionPlan | null {
  const wanted = new Set(categories.map((value) => value.toLowerCase()))
  return (
    byNewestDate(
      plans.filter((plan) => wanted.has(plan.planCategory.trim().toLowerCase())),
      (plan) => plan.updatedAt || plan.createdAt || plan.targetDate,
    )[0] ?? null
  )
}

function toneClass(tone: 'danger' | 'warning' | 'default' | 'success') {
  if (tone === 'danger') return 'bg-destructive/10 text-destructive'
  if (tone === 'warning') return 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
  if (tone === 'success') return 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
  return 'bg-muted text-muted-foreground'
}

export function ResidentCaseWorkspace({ residentId }: { residentId: number }) {
  const [mainTab, setMainTab] = useState<MainWorkspaceTab>('overview')
  const [detail, setDetail] = useState<ResidentDetail | null>(null)
  const [safehouses, setSafehouses] = useState<SafehouseOption[]>([])
  const [proc, setProc] = useState<ProcessRecording[]>([])
  const [vis, setVis] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [edu, setEdu] = useState<EducationRecord[]>([])
  const [hl, setHl] = useState<HealthRecord[]>([])
  const [inc, setInc] = useState<JsonTableRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [profileOpen, setProfileOpen] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [sessionWorkflowOpen, setSessionWorkflowOpen] = useState(false)
  const [expandedState, setExpandedState] = useState<GoalKey | null>('health')
  const [expandedGoal, setExpandedGoal] = useState<GoalKey | null>(null)
  const [profileSections, setProfileSections] = useState<Record<string, boolean>>({
    identity: true,
    admission: false,
    classification: false,
    family: false,
    worker: false,
    raw: false,
  })

  const [timelineKinds, setTimelineKinds] = useState<Set<TimelineKind>>(
    () => new Set<TimelineKind>(['process', 'visit', 'incident', 'education', 'health', 'plan']),
  )
  const [timelineFrom, setTimelineFrom] = useState('')
  const [timelineTo, setTimelineTo] = useState('')
  const [timelineWorker, setTimelineWorker] = useState('')
  const [timelineSearch, setTimelineSearch] = useState('')
  const [tlConcerns, setTlConcerns] = useState(false)
  const [tlFollow, setTlFollow] = useState(false)

  const [createSig, setCreateSig] = useState({ education: 0, health: 0, plan: 0 })
  const [focusPlanId, setFocusPlanId] = useState<number | null>(null)
  const [tlEduId, setTlEduId] = useState<number | null>(null)
  const [tlHealthId, setTlHealthId] = useState<number | null>(null)

  const [procDrawer, setProcDrawer] = useState<null | { mode: 'view' | 'edit'; row: ProcessRecording }>(null)
  const [visitDrawer, setVisitDrawer] = useState<null | { mode: 'view' | 'edit' | 'create'; row?: HomeVisitation | null }>(null)
  const [incidentDrawer, setIncidentDrawer] = useState<null | { mode: 'view' | 'edit' | 'create'; row?: JsonTableRow | null }>(null)
  const [deleteProcessId, setDeleteProcessId] = useState<number | null>(null)
  const [deleteVisitId, setDeleteVisitId] = useState<number | null>(null)
  const [deleteIncidentId, setDeleteIncidentId] = useState<number | null>(null)
  const [drawerErr, setDrawerErr] = useState<string | null>(null)
  const [drawerSaving, setDrawerSaving] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isFinite(residentId) || residentId <= 0) return
    setLoading(true)
    setError(null)
    try {
      const [d, sh, p, v, pl, e, h, incidents] = await Promise.all([
        getResident(residentId),
        getSafehouses(),
        getProcessRecordings(residentId),
        getHomeVisitations(residentId),
        getInterventionPlans(residentId),
        listEducationRecords(residentId),
        listHealthRecords(residentId),
        listIncidentReports(residentId),
      ])
      setDetail(d)
      setSafehouses(sh)
      setProc(p)
      setVis(v)
      setPlans(pl)
      setEdu(e)
      setHl(h)
      setInc(
        incidents.map((row) => ({
          id: row.id,
          fields: {
            resident_id: String(row.residentId),
            safehouse_id: row.safehouseId != null ? String(row.safehouseId) : '',
            incident_date: row.incidentDate,
            incident_type: row.incidentType,
            severity: row.severity,
            description: row.description ?? '',
            response_taken: row.responseTaken ?? '',
            resolved: String(row.resolved),
            resolution_date: row.resolutionDate ?? '',
            reported_by: row.reportedBy ?? '',
            follow_up_required: String(row.followUpRequired),
          },
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resident')
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [residentId])

  useEffect(() => {
    void load()
  }, [load])

  const fields = detail?.fields ?? {}
  const internalCode = gf(fields, 'internal_code', 'internalCode') || `Resident #${residentId}`
  const safehouseId = Number(gf(fields, 'safehouse_id', 'safehouseId')) || 0
  const safehouseName = safehouses.find((item) => item.id === safehouseId)?.name ?? (safehouseId ? `Safehouse #${safehouseId}` : '—')
  const assignedWorker = gf(fields, 'assigned_social_worker', 'assignedSocialWorker')
  const admissionDate = gf(fields, 'date_of_admission', 'dateOfAdmission')

  const latestHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[0] ?? null, [hl])
  const previousHealth = useMemo(() => byNewestDate(hl, (row) => row.recordDate)[1] ?? null, [hl])
  const latestEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[0] ?? null, [edu])
  const previousEducation = useMemo(() => byNewestDate(edu, (row) => row.recordDate)[1] ?? null, [edu])
  const latestHealthPlan = useMemo(() => findLatestPlan(plans, ['health', 'physical health']), [plans])
  const latestEducationPlan = useMemo(() => findLatestPlan(plans, ['education']), [plans])
  const latestSafetyPlan = useMemo(() => findLatestPlan(plans, ['safety']), [plans])

  const safetyScore = useMemo(() => deriveSafetyScore(vis, inc), [vis, inc])
  const priorSafetyScore = useMemo(() => deriveSafetyScore(vis.slice(1), inc.slice(1)), [vis, inc])

  const currentStateCards = useMemo<Record<GoalKey, CurrentStateCard>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health',
        currentLabel: scoreLabel(latestHealth?.healthScore ?? null),
        targetLabel: scoreLabel(latestHealthPlan?.targetValue ?? 4.2),
        chip:
          latestHealth?.healthScore != null && latestHealthPlan?.targetValue != null
            ? latestHealth.healthScore >= latestHealthPlan.targetValue
              ? 'On track'
              : 'Needs support'
            : 'Monitoring',
        chipTone:
          latestHealth?.healthScore != null && latestHealthPlan?.targetValue != null
            ? latestHealth.healthScore >= latestHealthPlan.targetValue
              ? 'success'
              : 'warning'
            : 'default',
        trend: trendFromNumbers(latestHealth?.healthScore ?? null, previousHealth?.healthScore ?? null),
        subtext: latestHealth ? `Latest score on ${formatAdminDate(latestHealth.recordDate)}` : 'No health record yet',
      },
      education: {
        key: 'education',
        label: 'Education',
        currentLabel: attendanceLabel(latestEducation?.attendanceRate ?? null),
        targetLabel: attendanceLabel(latestEducationPlan?.targetValue ?? 0.85),
        chip:
          latestEducation?.attendanceRate != null && latestEducationPlan?.targetValue != null
            ? latestEducation.attendanceRate >= latestEducationPlan.targetValue
              ? 'On track'
              : 'Watch'
            : 'Monitoring',
        chipTone:
          latestEducation?.attendanceRate != null && latestEducationPlan?.targetValue != null
            ? latestEducation.attendanceRate >= latestEducationPlan.targetValue
              ? 'success'
              : 'warning'
            : 'default',
        trend: trendFromNumbers(latestEducation?.attendanceRate ?? null, previousEducation?.attendanceRate ?? null),
        subtext: latestEducation ? `Latest attendance on ${formatAdminDate(latestEducation.recordDate)}` : 'No education record yet',
      },
      safety: {
        key: 'safety',
        label: 'Safety',
        currentLabel: scoreLabel(safetyScore),
        targetLabel: scoreLabel(latestSafetyPlan?.targetValue ?? 4.2),
        chip: inc.some((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true') ? 'Open concern' : 'Stable',
        chipTone: inc.some((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true') ? 'danger' : 'success',
        trend: trendFromNumbers(safetyScore, priorSafetyScore),
        subtext: safetyScore != null ? 'Derived from incidents and visit flags' : 'No recent safety activity',
      },
    }),
    [inc, latestEducation, latestEducationPlan, latestHealth, latestHealthPlan, latestSafetyPlan, previousEducation, previousHealth, priorSafetyScore, safetyScore],
  )

  const goalCards = useMemo<Record<GoalKey, GoalCardData>>(
    () => ({
      health: {
        key: 'health',
        label: 'Health goal',
        target: latestHealthPlan?.targetValue ?? 4.2,
        current: latestHealth?.healthScore ?? null,
        currentLabel: scoreLabel(latestHealth?.healthScore ?? null),
        targetLabel: scoreLabel(latestHealthPlan?.targetValue ?? 4.2),
        detail: latestHealthPlan?.planDescription || 'Wellbeing goal from the latest intervention plan.',
      },
      education: {
        key: 'education',
        label: 'Education goal',
        target: latestEducationPlan?.targetValue ?? 0.85,
        current: latestEducation?.attendanceRate ?? null,
        currentLabel: attendanceLabel(latestEducation?.attendanceRate ?? null),
        targetLabel: attendanceLabel(latestEducationPlan?.targetValue ?? 0.85),
        detail: latestEducationPlan?.planDescription || 'Attendance goal from the latest intervention plan.',
      },
      safety: {
        key: 'safety',
        label: 'Safety goal',
        target: latestSafetyPlan?.targetValue ?? 4.2,
        current: safetyScore,
        currentLabel: scoreLabel(safetyScore),
        targetLabel: scoreLabel(latestSafetyPlan?.targetValue ?? 4.2),
        detail: latestSafetyPlan?.planDescription || 'Safety goal informed by incidents and safety-related visits.',
      },
    }),
    [latestEducation, latestEducationPlan, latestHealth, latestHealthPlan, latestSafetyPlan, safetyScore],
  )

  const unresolvedIncidents = useMemo(
    () => inc.filter((row) => (row.fields.resolved ?? '').toLowerCase() !== 'true'),
    [inc],
  )

  const timelineAll = useMemo(() => buildTimelineItems(proc, vis, edu, hl, plans, inc), [proc, vis, edu, hl, plans, inc])
  const timelineFiltered = useMemo(
    () =>
      filterTimeline(timelineAll, {
        kinds: timelineKinds,
        dateFrom: timelineFrom,
        dateTo: timelineTo,
        workerQ: timelineWorker,
        concernsOnly: tlConcerns,
        followUpOnly: tlFollow,
        progressOnly: false,
        search: timelineSearch,
      }),
    [timelineAll, timelineKinds, timelineFrom, timelineTo, timelineWorker, tlConcerns, tlFollow, timelineSearch],
  )

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = []
    const overduePlans = plans.filter(planIsOverdue)
    const followVisits = vis.filter((row) => row.followUpNeeded)
    const flaggedSessions = proc.filter((row) => row.concernsFlagged)

    if (overduePlans.length) {
      items.push({
        id: 'overdue-plans',
        label: 'Overdue plans',
        count: overduePlans.length,
        tone: 'warning',
        actionLabel: 'Review',
        action: { kind: 'tab', tab: 'plans' },
      })
    }
    if (followVisits.length) {
      items.push({
        id: 'visit-follow-ups',
        label: 'Visit follow-ups',
        count: followVisits.length,
        tone: 'warning',
        actionLabel: 'Update',
        action: { kind: 'timeline', followUpOnly: true },
      })
    }
    if (flaggedSessions.length) {
      items.push({
        id: 'flagged-sessions',
        label: 'Flagged sessions',
        count: flaggedSessions.length,
        tone: 'danger',
        actionLabel: 'Review',
        action: { kind: 'timeline', concernsOnly: true },
      })
    }
    if (unresolvedIncidents.length) {
      items.push({
        id: 'unresolved-incidents',
        label: 'Unresolved incidents',
        count: unresolvedIncidents.length,
        tone: 'danger',
        actionLabel: 'Resolve',
        action: { kind: 'tab', tab: 'safety' },
      })
    }
    if (latestEducation?.attendanceRate != null && previousEducation?.attendanceRate != null && latestEducation.attendanceRate < previousEducation.attendanceRate) {
      items.push({
        id: 'attendance-dip',
        label: 'Attendance dip',
        tone: 'warning',
        actionLabel: 'Open',
        action: { kind: 'add_activity', activity: 'education' },
      })
    }
    return items.slice(0, 5)
  }, [latestEducation, previousEducation, plans, proc, unresolvedIncidents.length, vis])

  const openTasks = useMemo<TaskItem[]>(() => {
    const tasks: TaskItem[] = []
    proc
      .filter((row) => row.followUpActions?.trim())
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `proc-${row.id}`,
          source: 'Session',
          date: row.sessionDate,
          summary: row.followUpActions!.trim(),
          action: { kind: 'timeline', concernsOnly: false, followUpOnly: true },
        })
      })
    vis
      .filter((row) => row.followUpNeeded)
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `visit-${row.id}`,
          source: 'Home visit',
          date: row.visitDate,
          summary: row.followUpNotes?.trim() || 'Follow-up needed',
          action: { kind: 'open_visit', visitId: row.id },
        })
      })
    unresolvedIncidents
      .filter((row) => (row.fields.follow_up_required ?? '').toLowerCase() === 'true')
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `incident-${row.id}`,
          source: 'Incident',
          date: row.fields.incident_date ?? '',
          summary: row.fields.description?.trim() || row.fields.incident_type || 'Incident follow-up required',
          action: { kind: 'tab', tab: 'safety' },
        })
      })
    plans
      .filter(planIsOverdue)
      .slice(0, 4)
      .forEach((row) => {
        tasks.push({
          id: `plan-${row.id}`,
          source: 'Plan',
          date: row.targetDate ?? row.updatedAt ?? row.createdAt,
          summary: row.planDescription,
          action: { kind: 'open_plan', planId: row.id },
        })
      })
    return byNewestDate(tasks, (row) => row.date).slice(0, 8)
  }, [plans, proc, unresolvedIncidents, vis])

  const emotionalCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of proc) {
      const state = row.emotionalStateObserved?.trim()
      if (state) map.set(state, (map.get(state) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [proc])

  const keySignals = useMemo(() => {
    const signals: string[] = []
    if (latestEducation?.attendanceRate != null && previousEducation?.attendanceRate != null && latestEducation.attendanceRate < previousEducation.attendanceRate) {
      signals.push('Attendance dropped on the latest record.')
    }
    if (latestHealth?.healthScore != null && previousHealth?.healthScore != null && latestHealth.healthScore < previousHealth.healthScore) {
      signals.push('Health score is trending down.')
    }
    if (emotionalCounts[0] && emotionalCounts[0][1] >= 2) {
      signals.push(`Repeated emotional state: ${emotionalCounts[0][0]}.`)
    }
    if (vis.filter((row) => row.safetyConcernsNoted || row.followUpNeeded).length >= 2) {
      signals.push('Recent visits show safety or follow-up flags.')
    }
    const incidentsIn60Days = inc.filter((row) => {
      const t = new Date(row.fields.incident_date ?? '').getTime()
      return Number.isFinite(t) && t >= Date.now() - 60 * 86400000
    }).length
    if (incidentsIn60Days === 0) signals.push('No incidents logged in the last 60 days.')
    const recentProgress = proc.filter((row) => row.progressNoted).slice(0, 3).length
    if (recentProgress > 0) signals.push(`Progress noted in ${recentProgress} recent session${recentProgress === 1 ? '' : 's'}.`)
    return signals.slice(0, 6)
  }, [emotionalCounts, inc, latestEducation, latestHealth, previousEducation, previousHealth, proc, vis])

  const recentConcerns = useMemo(
    () =>
      proc
        .filter((row) => row.concernsFlagged)
        .slice(0, 3)
        .map((row) => `${formatAdminDate(row.sessionDate)} · ${row.sessionNarrative.slice(0, 90)}${row.sessionNarrative.length > 90 ? '…' : ''}`),
    [proc],
  )

  const activeGoalContext = useMemo(
    () =>
      plans
        .filter((row) => !row.status.toLowerCase().includes('closed') && !row.status.toLowerCase().includes('achieved'))
        .slice(0, 4)
        .map((row) => `${row.planCategory} · ${row.planDescription}`),
    [plans],
  )

  const recentActivityContext = useMemo(
    () => timelineAll.slice(0, 4).map((row) => `${formatAdminDate(row.dateIso)} · ${row.title} · ${row.summary}`),
    [timelineAll],
  )

  function closeAddMenu() {
    setAddMenuOpen(false)
  }

  function bumpCreate(kind: (typeof ACTIVITY_TYPES)[number]['id']) {
    closeAddMenu()
    if (kind === 'counseling') {
      setSessionWorkflowOpen(true)
      return
    }
    if (kind === 'visit') {
      setVisitDrawer({ mode: 'create', row: null })
      return
    }
    if (kind === 'incident') {
      setIncidentDrawer({ mode: 'create', row: null })
      return
    }
    if (kind === 'plan') {
      setMainTab('plans')
      setCreateSig((state) => ({ ...state, plan: state.plan + 1 }))
      return
    }
    if (kind === 'education') {
      setMainTab('activity')
      setCreateSig((state) => ({ ...state, education: state.education + 1 }))
      return
    }
    if (kind === 'health') {
      setMainTab('activity')
      setCreateSig((state) => ({ ...state, health: state.health + 1 }))
    }
  }

  function runWorkspaceAction(action: WorkspaceQuickAction) {
    switch (action.kind) {
      case 'tab':
        setMainTab(action.tab)
        break
      case 'timeline':
        setMainTab('activity')
        setTlFollow(Boolean(action.followUpOnly))
        setTlConcerns(Boolean(action.concernsOnly))
        break
      case 'open_visit': {
        const row = vis.find((item) => item.id === action.visitId)
        if (row) {
          setVisitDrawer({ mode: 'view', row })
          setMainTab('activity')
        }
        break
      }
      case 'open_plan':
        setFocusPlanId(action.planId)
        setMainTab('plans')
        break
      case 'add_activity':
        bumpCreate(action.activity)
        break
    }
  }

  function onTimelineSelect(item: TimelineItem) {
    switch (item.ref.kind) {
      case 'process':
        setProcDrawer({ mode: 'view', row: item.ref.row })
        break
      case 'visit':
        setVisitDrawer({ mode: 'view', row: item.ref.row })
        break
      case 'education':
        setTlEduId(item.ref.row.id)
        break
      case 'health':
        setTlHealthId(item.ref.row.id)
        break
      case 'plan':
        setFocusPlanId(item.ref.row.id)
        setMainTab('plans')
        break
      case 'incident':
        setIncidentDrawer({ mode: 'view', row: item.ref.row })
        break
    }
  }

  function openTimelineEdit(item: TimelineItem) {
    switch (item.ref.kind) {
      case 'process':
        setProcDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'visit':
        setVisitDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'incident':
        setIncidentDrawer({ mode: 'edit', row: item.ref.row })
        break
      case 'education':
        setTlEduId(item.ref.row.id)
        break
      case 'health':
        setTlHealthId(item.ref.row.id)
        break
      case 'plan':
        setFocusPlanId(item.ref.row.id)
        setMainTab('plans')
        break
    }
  }

  function requestDeleteFromTimeline(item: TimelineItem) {
    if (item.ref.kind === 'process') setDeleteProcessId(item.ref.row.id)
    if (item.ref.kind === 'visit') setDeleteVisitId(item.ref.row.id)
    if (item.ref.kind === 'incident') setDeleteIncidentId(item.ref.row.id)
  }

  if (!Number.isFinite(residentId) || residentId <= 0) {
    return <p className="text-destructive">Invalid resident.</p>
  }

  if (loading) return <p className="text-muted-foreground">Loading case…</p>
  if (error && !detail) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">{error}</p>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Back to residents
        </Link>
      </div>
    )
  }
  if (!detail) {
    return (
      <div className="space-y-3">
        <p className="text-destructive">Resident not found.</p>
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Back to residents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Link to="/admin/residents" className="text-sm text-primary hover:underline">
          ← Residents
        </Link>

        <div className={`${card} flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className={pageTitle}>{internalCode}</h2>
              {gf(fields, 'case_status', 'caseStatus') ? <StatusBadge status={gf(fields, 'case_status', 'caseStatus')} /> : null}
              {gf(fields, 'current_risk_level', 'currentRiskLevel') ? <RiskBadge level={gf(fields, 'current_risk_level', 'currentRiskLevel')} /> : null}
              {gf(fields, 'reintegration_type', 'reintegrationType') ? <CategoryBadge>{gf(fields, 'reintegration_type', 'reintegrationType')}</CategoryBadge> : null}
              {gf(fields, 'reintegration_status', 'reintegrationStatus') ? <ReintegrationBadge value={gf(fields, 'reintegration_status', 'reintegrationStatus')} /> : null}
            </div>
            <p className={`${pageDesc} mt-2`}>
              {safehouseName}
              {' · '}
              {assignedWorker || 'No worker assigned'}
              {admissionDate ? ` · Admitted ${formatAdminDate(admissionDate)}` : ''}
            </p>
          </div>

          <div className="relative flex flex-wrap gap-2 lg:justify-end">
            <button type="button" className={btnPrimary} onClick={() => setAddMenuOpen((open) => !open)}>
              Add
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
              onClick={() => setSessionWorkflowOpen(true)}
            >
              Start session
            </button>
            {addMenuOpen ? (
              <div className={`${card} absolute right-0 top-full z-40 mt-2 min-w-[15rem] space-y-1 py-2 shadow-lg`}>
                {ACTIVITY_TYPES.map((activity) => (
                  <button
                    key={activity.id}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => bumpCreate(activity.id)}
                  >
                    {activity.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <div className={alertError}>{error}</div> : null}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.k}
            type="button"
            onClick={() => setMainTab(tab.k)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              mainTab === tab.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'overview' ? (
        <div className="space-y-8">
          <OverviewSection title="Needs attention">
            {attentionItems.length === 0 ? (
              <EmptyState title="Nothing urgent right now" hint="This resident has no high-priority alerts at the moment." />
            ) : (
              <div className="space-y-2">
                {attentionItems.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(item.tone)}`}>{item.label}</span>
                      {item.count != null ? <span className="text-sm font-semibold text-foreground">{item.count}</span> : null}
                    </div>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => runWorkspaceAction(item.action)}>
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </OverviewSection>

          <OverviewSection title="Current state">
            <div className="grid gap-4 lg:grid-cols-3">
              {(Object.values(currentStateCards) as CurrentStateCard[]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setExpandedState((value) => (value === item.key ? null : item.key))}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    expandedState === item.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(item.chipTone)}`}>{item.chip}</span>
                  </div>
                  <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{item.currentLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Target {item.targetLabel}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.subtext}</span>
                    <TrendBadge trend={item.trend} />
                  </div>
                </button>
              ))}
            </div>

            {expandedState ? (
              <InlineDetailCard title={`${currentStateCards[expandedState].label} details`}>
                {expandedState === 'health' ? (
                  <StateDetailList
                    rows={byNewestDate(hl, (row) => row.recordDate).slice(0, 4).map((row) => ({
                      id: row.id,
                      title: formatAdminDate(row.recordDate),
                      subtitle: row.notes || 'Health record',
                      meta: row.healthScore != null ? `Score ${row.healthScore}` : 'No score',
                      onOpen: () => {
                        setMainTab('activity')
                        setTlHealthId(row.id)
                      },
                    }))}
                    emptyLabel="No health records yet."
                    primaryAction={<InlineActionButton onClick={() => bumpCreate('health')}>Add health record</InlineActionButton>}
                    secondaryAction={<InlineActionButton onClick={() => setMainTab('activity')}>View activity</InlineActionButton>}
                  />
                ) : null}
                {expandedState === 'education' ? (
                  <StateDetailList
                    rows={byNewestDate(edu, (row) => row.recordDate).slice(0, 4).map((row) => ({
                      id: row.id,
                      title: formatAdminDate(row.recordDate),
                      subtitle: row.notes || 'Education record',
                      meta: row.attendanceRate != null ? `Attendance ${attendanceLabel(row.attendanceRate)}` : 'No attendance value',
                      onOpen: () => {
                        setMainTab('activity')
                        setTlEduId(row.id)
                      },
                    }))}
                    emptyLabel="No education records yet."
                    primaryAction={<InlineActionButton onClick={() => bumpCreate('education')}>Add education record</InlineActionButton>}
                    secondaryAction={<InlineActionButton onClick={() => setMainTab('activity')}>View activity</InlineActionButton>}
                  />
                ) : null}
                {expandedState === 'safety' ? (
                  <StateDetailList
                    rows={[
                      ...unresolvedIncidents.slice(0, 3).map((row) => ({
                        id: row.id,
                        title: row.fields.incident_type || 'Incident',
                        subtitle: row.fields.description || 'Unresolved incident',
                        meta: row.fields.incident_date ? formatAdminDate(row.fields.incident_date) : 'No date',
                        onOpen: () => setIncidentDrawer({ mode: 'view', row }),
                      })),
                      ...vis
                        .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
                        .slice(0, 3)
                        .map((row) => ({
                          id: row.id + 100000,
                          title: `Visit · ${formatAdminDate(row.visitDate)}`,
                          subtitle: row.followUpNotes || row.observations || 'Safety-related visit',
                          meta: row.safetyConcernsNoted ? 'Safety concern' : 'Follow-up needed',
                          onOpen: () => setVisitDrawer({ mode: 'view', row }),
                        })),
                    ]}
                    emptyLabel="No recent safety issues."
                    primaryAction={<InlineActionButton onClick={() => bumpCreate('incident')}>Log incident</InlineActionButton>}
                    secondaryAction={<InlineActionButton onClick={() => setMainTab('safety')}>Open safety tab</InlineActionButton>}
                  />
                ) : null}
              </InlineDetailCard>
            ) : null}
          </OverviewSection>

          <OverviewSection title="Goals">
            <div className="grid gap-4 lg:grid-cols-3">
              {(Object.values(goalCards) as GoalCardData[]).map((goal) => (
                <button
                  key={goal.key}
                  type="button"
                  onClick={() => setExpandedGoal((value) => (value === goal.key ? null : goal.key))}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    expandedGoal === goal.key ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'
                  }`}
                >
                  <ProgressRing label={goal.label} progress={percentage(goal.current, goal.target)}>
                    <div className="text-xl font-semibold tabular-nums text-foreground">{goal.currentLabel}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current</div>
                  </ProgressRing>
                  <p className="mt-4 text-sm text-muted-foreground">Target {goal.targetLabel}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-foreground">{goal.detail}</p>
                </button>
              ))}
            </div>

            {expandedGoal ? (
              <InlineDetailCard title={`${goalCards[expandedGoal].label} details`}>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-3">
                    <MetaPill label="Target" value={goalCards[expandedGoal].targetLabel} />
                    <MetaPill label="Current" value={goalCards[expandedGoal].currentLabel} />
                    <MetaPill label="Progress" value={`${Math.round(percentage(goalCards[expandedGoal].current, goalCards[expandedGoal].target))}%`} />
                  </div>
                  <p className="text-sm text-muted-foreground">{goalCards[expandedGoal].detail}</p>
                  {expandedGoal === 'health' ? (
                    <div className="flex flex-wrap gap-2">
                      <InlineActionButton onClick={() => bumpCreate('health')}>Add health record</InlineActionButton>
                      <InlineActionButton onClick={() => setMainTab('plans')}>Open plans</InlineActionButton>
                    </div>
                  ) : null}
                  {expandedGoal === 'education' ? (
                    <div className="flex flex-wrap gap-2">
                      <InlineActionButton onClick={() => bumpCreate('education')}>Add education record</InlineActionButton>
                      <InlineActionButton onClick={() => setMainTab('plans')}>Open plans</InlineActionButton>
                    </div>
                  ) : null}
                  {expandedGoal === 'safety' ? (
                    <div className="flex flex-wrap gap-2">
                      <InlineActionButton onClick={() => bumpCreate('incident')}>Log incident</InlineActionButton>
                      <InlineActionButton onClick={() => setMainTab('safety')}>Open safety</InlineActionButton>
                    </div>
                  ) : null}
                </div>
              </InlineDetailCard>
            ) : null}
          </OverviewSection>

          <OverviewSection title="Open tasks / follow-ups">
            {openTasks.length === 0 ? (
              <EmptyState title="No open follow-ups" hint="New follow-up items from sessions, visits, incidents, and plans will show here." />
            ) : (
              <div className="space-y-2">
                {openTasks.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.source}</span>
                        <span className="text-xs text-muted-foreground">{formatAdminDate(item.date)}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{item.summary}</p>
                    </div>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => runWorkspaceAction(item.action)}>
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </OverviewSection>

          <OverviewSection title="Key signals">
            {keySignals.length === 0 ? (
              <EmptyState title="No strong signals yet" hint="Signals will appear as more resident activity is recorded." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {keySignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-border bg-card px-3 py-2 text-sm text-foreground">
                    {signal}
                  </span>
                ))}
              </div>
            )}
          </OverviewSection>

          <OverviewSection title="Recent activity">
            <div className="space-y-2">
              {timelineAll.slice(0, 5).map((item) => (
                <TimelineRow key={item.key} item={item} onOpen={onTimelineSelect} onEdit={openTimelineEdit} onDelete={requestDeleteFromTimeline} />
              ))}
            </div>
            <div className="pt-2">
              <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => setMainTab('activity')}>
                View all activity
              </button>
            </div>
          </OverviewSection>
        </div>
      ) : null}

      {mainTab === 'activity' ? (
        <div className="space-y-6">
          <div className={`${card} space-y-4`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={label}>
                From
                <input type="date" className={input} value={timelineFrom} onChange={(e) => setTimelineFrom(e.target.value)} />
              </label>
              <label className={label}>
                To
                <input type="date" className={input} value={timelineTo} onChange={(e) => setTimelineTo(e.target.value)} />
              </label>
              <label className={label}>
                Worker
                <input className={input} value={timelineWorker} onChange={(e) => setTimelineWorker(e.target.value)} placeholder="Search worker" />
              </label>
              <label className={label}>
                Search
                <input className={input} value={timelineSearch} onChange={(e) => setTimelineSearch(e.target.value)} placeholder="Keyword" />
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              {(['process', 'visit', 'incident', 'education', 'health', 'plan'] as TimelineKind[]).map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={timelineKinds.has(kind)}
                    onChange={() => {
                      setTimelineKinds((prev) => {
                        const next = new Set(prev)
                        if (next.has(kind)) next.delete(kind)
                        else next.add(kind)
                        return next
                      })
                    }}
                  />
                  {kind}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                <input type="checkbox" checked={tlFollow} onChange={(e) => setTlFollow(e.target.checked)} />
                Follow-up only
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm text-foreground">
                <input type="checkbox" checked={tlConcerns} onChange={(e) => setTlConcerns(e.target.checked)} />
                Flagged only
              </label>
            </div>
          </div>

          <EducationSection
            residentId={residentId}
            rows={edu}
            onReload={load}
            openCreateSignal={createSig.education}
            hideChrome
            initialOpenRecordId={tlEduId}
            onInitialOpenConsumed={() => setTlEduId(null)}
          />
          <HealthSection
            residentId={residentId}
            rows={hl}
            onReload={load}
            openCreateSignal={createSig.health}
            hideChrome
            initialOpenRecordId={tlHealthId}
            onInitialOpenConsumed={() => setTlHealthId(null)}
          />

          <div className="space-y-2">
            {timelineFiltered.length === 0 ? (
              <EmptyState title="No activity matches these filters" />
            ) : (
              timelineFiltered.map((item) => (
                <TimelineRow key={item.key} item={item} onOpen={onTimelineSelect} onEdit={openTimelineEdit} onDelete={requestDeleteFromTimeline} />
              ))
            )}
          </div>
        </div>
      ) : null}

      {mainTab === 'plans' ? (
        <PlansTabContent
          residentId={residentId}
          plans={plans}
          onReload={load}
          openCreateSignal={createSig.plan}
          layout="workspace"
          focusPlanId={focusPlanId}
          onFocusPlanConsumed={() => setFocusPlanId(null)}
        />
      ) : null}

      {mainTab === 'safety' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Safety summary</h3>
              <p className="mt-1 text-sm text-muted-foreground">Critical concerns, visits, and flagged sessions in one place.</p>
            </div>
            <button type="button" className={btnPrimary} onClick={() => bumpCreate('incident')}>
              Log incident
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <SummaryTile label="Unresolved incidents" value={unresolvedIncidents.length} />
            <SummaryTile label="Safety-related visits" value={vis.filter((row) => row.safetyConcernsNoted || row.followUpNeeded).length} />
            <SummaryTile label="Flagged sessions" value={proc.filter((row) => row.concernsFlagged).length} />
          </div>

          <SafetyBlock title="Incidents">
            {inc.length === 0 ? (
              <EmptyState title="No incidents logged" hint="Use Log incident to add the first one." />
            ) : (
              inc.map((row) => (
                <SafetyRow
                  key={row.id}
                  title={row.fields.incident_type || 'Incident'}
                  subtitle={row.fields.description || 'No description'}
                  meta={[
                    row.fields.incident_date ? formatAdminDate(row.fields.incident_date) : '',
                    row.fields.severity || '',
                    (row.fields.resolved ?? '').toLowerCase() === 'true' ? 'Resolved' : 'Open',
                  ]}
                  onView={() => setIncidentDrawer({ mode: 'view', row })}
                  onEdit={() => setIncidentDrawer({ mode: 'edit', row })}
                  onDelete={() => setDeleteIncidentId(row.id)}
                />
              ))
            )}
          </SafetyBlock>

          <SafetyBlock title="Visits with safety concerns or follow-up">
            {vis.filter((row) => row.safetyConcernsNoted || row.followUpNeeded).length === 0 ? (
              <EmptyState title="No safety-related visits" />
            ) : (
              vis
                .filter((row) => row.safetyConcernsNoted || row.followUpNeeded)
                .map((row) => (
                  <SafetyRow
                    key={row.id}
                    title={`Home visit · ${formatAdminDate(row.visitDate)}`}
                    subtitle={row.followUpNotes || row.observations || row.purpose || 'No notes'}
                    meta={[
                      row.socialWorker,
                      row.safetyConcernsNoted ? 'Safety concern' : '',
                      row.followUpNeeded ? 'Follow-up needed' : '',
                    ]}
                    onView={() => setVisitDrawer({ mode: 'view', row })}
                    onEdit={() => setVisitDrawer({ mode: 'edit', row })}
                    onDelete={() => setDeleteVisitId(row.id)}
                  />
                ))
            )}
          </SafetyBlock>

          <SafetyBlock title="Sessions with concerns flagged">
            {proc.filter((row) => row.concernsFlagged).length === 0 ? (
              <EmptyState title="No flagged sessions" />
            ) : (
              proc
                .filter((row) => row.concernsFlagged)
                .map((row) => (
                  <SafetyRow
                    key={row.id}
                    title={`Session · ${formatAdminDate(row.sessionDate)}`}
                    subtitle={row.sessionNarrative}
                    meta={[row.socialWorker, row.sessionType, row.followUpActions ? 'Follow-up noted' : '']}
                    onView={() => setProcDrawer({ mode: 'view', row })}
                    onEdit={() => setProcDrawer({ mode: 'edit', row })}
                    onDelete={() => setDeleteProcessId(row.id)}
                  />
                ))
            )}
          </SafetyBlock>
        </div>
      ) : null}

      {mainTab === 'profile' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
              <p className="mt-1 text-sm text-muted-foreground">Administrative details and background information.</p>
            </div>
            <button type="button" className={btnPrimary} onClick={() => setProfileOpen(true)}>
              Edit profile
            </button>
          </div>

          <ProfileSection
            title="Identity & case basics"
            open={profileSections.identity}
            onToggle={() => setProfileSections((value) => ({ ...value, identity: !value.identity }))}
          >
            <ProfileGrid rows={[
              ['Internal code', gf(fields, 'internal_code', 'internalCode')],
              ['Case control no', gf(fields, 'case_control_no', 'caseControlNo')],
              ['Case status', gf(fields, 'case_status', 'caseStatus')],
              ['Case category', gf(fields, 'case_category', 'caseCategory')],
              ['Sex', gf(fields, 'sex')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Admission & placement"
            open={profileSections.admission}
            onToggle={() => setProfileSections((value) => ({ ...value, admission: !value.admission }))}
          >
            <ProfileGrid rows={[
              ['Admission date', admissionDate ? formatAdminDate(admissionDate) : ''],
              ['Length of stay', gf(fields, 'length_of_stay', 'lengthOfStay')],
              ['Safehouse', safehouseName],
              ['Safehouse ID', gf(fields, 'safehouse_id', 'safehouseId')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Classification & risk"
            open={profileSections.classification}
            onToggle={() => setProfileSections((value) => ({ ...value, classification: !value.classification }))}
          >
            <ProfileGrid rows={[
              ['Risk level', gf(fields, 'current_risk_level', 'currentRiskLevel')],
              ['Reintegration status', gf(fields, 'reintegration_status', 'reintegrationStatus')],
              ['Reintegration type', gf(fields, 'reintegration_type', 'reintegrationType')],
              ['Present age', gf(fields, 'present_age', 'presentAge')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Family / vulnerability indicators"
            open={profileSections.family}
            onToggle={() => setProfileSections((value) => ({ ...value, family: !value.family }))}
          >
            <ProfileGrid rows={[
              ['Family background', gf(fields, 'family_background', 'familyBackground')],
              ['Vulnerability indicators', gf(fields, 'vulnerability_indicators', 'vulnerabilityIndicators')],
              ['Referral source', gf(fields, 'referral_source', 'referralSource')],
              ['Notes', gf(fields, 'notes')],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Worker assignment"
            open={profileSections.worker}
            onToggle={() => setProfileSections((value) => ({ ...value, worker: !value.worker }))}
          >
            <ProfileGrid rows={[
              ['Assigned social worker', assignedWorker],
              ['Safehouse', safehouseName],
            ]} />
          </ProfileSection>

          <ProfileSection
            title="Additional fields / raw fields"
            open={profileSections.raw}
            onToggle={() => setProfileSections((value) => ({ ...value, raw: !value.raw }))}
          >
            <dl className="grid gap-2 sm:grid-cols-2">
              {Object.keys(fields)
                .sort()
                .map((key) => (
                  <div key={key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="mt-1 text-sm text-foreground">{fields[key] || '—'}</dd>
                  </div>
                ))}
            </dl>
          </ProfileSection>
        </div>
      ) : null}

      {sessionWorkflowOpen ? (
        <SessionWorkflowDrawer
          residentId={residentId}
          assignedWorker={assignedWorker}
          recentConcerns={recentConcerns}
          activeGoals={activeGoalContext}
          recentActivity={recentActivityContext}
          onClose={() => setSessionWorkflowOpen(false)}
          onSaved={async () => {
            setSessionWorkflowOpen(false)
            await load()
          }}
        />
      ) : null}

      {profileOpen ? (
        <ProfileEditDrawer
          residentId={residentId}
          fields={fields}
          safehouses={safehouses}
          onClose={() => setProfileOpen(false)}
          onSaved={async () => {
            setProfileOpen(false)
            await load()
          }}
          saving={profileSaving}
          setSaving={setProfileSaving}
          onError={setError}
        />
      ) : null}

      {incidentDrawer ? (
        <IncidentDrawer
          mode={incidentDrawer.mode}
          residentId={residentId}
          safehouseId={safehouseId}
          initial={incidentDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setIncidentDrawer(null)
            setDrawerErr(null)
          }}
          onSaved={async () => {
            setIncidentDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onEdit={() => {
            if (incidentDrawer.row) setIncidentDrawer({ mode: 'edit', row: incidentDrawer.row })
          }}
          onDeleteRequest={(id) => setDeleteIncidentId(id)}
        />
      ) : null}

      {procDrawer ? (
        <ProcessRecordingDrawer
          key={String(procDrawer.row.id)}
          mode={procDrawer.mode}
          residentId={residentId}
          initial={procDrawer.row}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setProcDrawer(null)
            setDrawerErr(null)
          }}
          onEdit={() => setProcDrawer((value) => (value ? { ...value, mode: 'edit' } : value))}
          onSaved={async () => {
            setProcDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteProcessId(id)}
        />
      ) : null}

      {visitDrawer ? (
        <HomeVisitDrawer
          key={visitDrawer.mode === 'create' ? 'new-visit' : String(visitDrawer.row?.id ?? 'visit')}
          mode={visitDrawer.mode}
          residentId={residentId}
          initial={visitDrawer.row ?? null}
          error={drawerErr}
          onError={setDrawerErr}
          onClose={() => {
            setVisitDrawer(null)
            setDrawerErr(null)
          }}
          onEdit={() => setVisitDrawer((value) => (value && value.row ? { mode: 'edit', row: value.row } : value))}
          onSaved={async () => {
            setVisitDrawer(null)
            setDrawerErr(null)
            await load()
          }}
          onDeleteRequest={(id) => setDeleteVisitId(id)}
        />
      ) : null}

      <AdminDeleteModal
        open={deleteProcessId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteProcessId(null)}
        onConfirm={async () => {
          if (deleteProcessId == null) return
          setDrawerSaving(true)
          try {
            await deleteProcessRecording(deleteProcessId)
            setDeleteProcessId(null)
            setProcDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />

      <AdminDeleteModal
        open={deleteVisitId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteVisitId(null)}
        onConfirm={async () => {
          if (deleteVisitId == null) return
          setDrawerSaving(true)
          try {
            await deleteHomeVisitation(deleteVisitId)
            setDeleteVisitId(null)
            setVisitDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />

      <AdminDeleteModal
        open={deleteIncidentId != null}
        title="Delete record?"
        body="This action cannot be undone."
        loading={drawerSaving}
        onCancel={() => setDeleteIncidentId(null)}
        onConfirm={async () => {
          if (deleteIncidentId == null) return
          setDrawerSaving(true)
          try {
            await deleteIncidentReport(deleteIncidentId)
            setDeleteIncidentId(null)
            setIncidentDrawer(null)
            await load()
          } catch (err) {
            setDrawerErr(err instanceof Error ? err.message : 'Delete failed')
          } finally {
            setDrawerSaving(false)
          }
        }}
      />
    </div>
  )
}

function OverviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function InlineDetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-5">
      <h4 className="text-base font-semibold text-foreground">{title}</h4>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function ProgressRing({ label, progress, children }: { label: string; progress: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-24 w-24 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--primary) ${progress}%, rgba(148, 163, 184, 0.15) ${progress}% 100%)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-card text-center">{children}</div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{Math.round(progress)}% of target</p>
      </div>
    </div>
  )
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-border bg-muted/20 px-3 py-1.5 text-sm text-foreground">
      <span className="text-muted-foreground">{label}</span>
      {' · '}
      <span className="font-medium">{value}</span>
    </div>
  )
}

function InlineActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50" onClick={onClick}>
      {children}
    </button>
  )
}

function TrendBadge({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span className="text-emerald-700 dark:text-emerald-300">Up</span>
  if (trend === 'down') return <span className="text-destructive">Down</span>
  return <span>Flat</span>
}

function StateDetailList({
  rows,
  emptyLabel,
  primaryAction,
  secondaryAction,
}: {
  rows: { id: number; title: string; subtitle: string; meta: string; onOpen: () => void }[]
  emptyLabel: string
  primaryAction: ReactNode
  secondaryAction?: ReactNode
}) {
  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <EmptyState title={emptyLabel} />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <button key={row.id} type="button" onClick={row.onOpen} className="w-full rounded-xl border border-border bg-muted/10 px-4 py-3 text-left hover:bg-muted/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{row.title}</span>
                <span className="text-xs text-muted-foreground">{row.meta}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.subtitle}</p>
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {primaryAction}
        {secondaryAction}
      </div>
    </div>
  )
}

function TimelineRow({
  item,
  onOpen,
  onEdit,
  onDelete,
}: {
  item: TimelineItem
  onOpen: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
  onDelete: (item: TimelineItem) => void
}) {
  const canDelete = item.ref.kind === 'process' || item.ref.kind === 'visit' || item.ref.kind === 'incident'
  const editLabel = item.ref.kind === 'education' || item.ref.kind === 'health' || item.ref.kind === 'plan' ? 'Open' : 'Edit'
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-primary">{item.title}</span>
            <span className="text-sm text-muted-foreground">{formatAdminDate(item.dateIso)}</span>
            {item.worker ? <span className="text-sm text-muted-foreground">· {item.worker}</span> : null}
          </div>
          <p className="mt-2 text-sm text-foreground">{item.summary}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {item.flags.map((flag) => (
              <span key={flag.label} className={`rounded-full px-2 py-1 text-xs font-medium ${toneClass(flag.tone)}`}>
                {flag.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InlineActionButton onClick={() => onOpen(item)}>View</InlineActionButton>
          <InlineActionButton onClick={() => onEdit(item)}>{editLabel}</InlineActionButton>
          {canDelete ? <InlineActionButton onClick={() => onDelete(item)}>Delete</InlineActionButton> : null}
        </div>
      </div>
    </div>
  )
}

function SafetyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function SafetyRow({
  title,
  subtitle,
  meta,
  onView,
  onEdit,
  onDelete,
}: {
  title: string
  subtitle: string
  meta: string[]
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meta.filter(Boolean).map((item) => (
              <span key={item} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <InlineActionButton onClick={onView}>View</InlineActionButton>
          <InlineActionButton onClick={onEdit}>Edit</InlineActionButton>
          <InlineActionButton onClick={onDelete}>Delete</InlineActionButton>
        </div>
      </div>
    </div>
  )
}

function ProfileSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-sm text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? <div className="border-t border-border px-5 py-4">{children}</div> : null}
    </div>
  )
}

function ProfileGrid({ rows }: { rows: [string, string][] }) {
  const filtered = rows.filter(([, value]) => value)
  if (filtered.length === 0) {
    return <p className="text-sm text-muted-foreground">No fields in this section yet.</p>
  }
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {filtered.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
          <dd className="mt-1 text-sm text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function IncidentDrawer({
  mode,
  residentId,
  safehouseId,
  initial,
  error,
  onError,
  onClose,
  onSaved,
  onEdit,
  onDeleteRequest,
}: {
  mode: 'view' | 'edit' | 'create'
  residentId: number
  safehouseId: number
  initial: JsonTableRow | null
  error: string | null
  onError: (value: string | null) => void
  onClose: () => void
  onSaved: () => Promise<void>
  onEdit: () => void
  onDeleteRequest: (id: number) => void
}) {
  const [saving, setSaving] = useState(false)
  const [incidentDate, setIncidentDate] = useState(initial?.fields.incident_date ?? new Date().toISOString().slice(0, 10))
  const [incidentType, setIncidentType] = useState(initial?.fields.incident_type ?? 'Medical')
  const [severity, setSeverity] = useState(initial?.fields.severity ?? 'Medium')
  const [description, setDescription] = useState(initial?.fields.description ?? '')
  const [responseTaken, setResponseTaken] = useState(initial?.fields.response_taken ?? '')
  const [reportedBy, setReportedBy] = useState(initial?.fields.reported_by ?? '')
  const [resolved, setResolved] = useState((initial?.fields.resolved ?? '').toLowerCase() === 'true')
  const [followUpRequired, setFollowUpRequired] = useState((initial?.fields.follow_up_required ?? '').toLowerCase() === 'true')
  const [resolutionDate, setResolutionDate] = useState(initial?.fields.resolution_date ?? '')
  const readOnly = mode === 'view'

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    setSaving(true)
    try {
      const payload = {
        safehouse_id: safehouseId > 0 ? String(safehouseId) : '',
        incident_date: incidentDate,
        incident_type: incidentType,
        severity,
        description,
        response_taken: responseTaken,
        reported_by: reportedBy,
        resolved: resolved ? 'true' : 'false',
        follow_up_required: followUpRequired ? 'true' : 'false',
        resolution_date: resolved ? resolutionDate || incidentDate : '',
      }
      if (mode === 'create') {
        await createIncidentReport(residentId, payload)
      } else if (initial && mode === 'edit') {
        await patchIncidentReport(initial.id, payload)
      }
      await onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save incident')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer
      title={mode === 'create' ? 'Add incident' : 'Incident'}
      onClose={onClose}
      footer={
        readOnly && initial ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={onEdit}>
              Edit
            </button>
            <button
              type="button"
              className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              onClick={() => onDeleteRequest(initial.id)}
            >
              Delete
            </button>
          </div>
        ) : null
      }
    >
      {error ? <div className={alertError}>{error}</div> : null}
      {readOnly && initial ? (
        <div className="space-y-3 text-sm">
          <p className="font-medium text-foreground">{initial.fields.incident_type || 'Incident'}</p>
          <p className="text-muted-foreground">{initial.fields.incident_date ? formatAdminDate(initial.fields.incident_date) : 'No date'}</p>
          <div className="flex flex-wrap gap-2">
            {initial.fields.severity ? <CategoryBadge>{initial.fields.severity}</CategoryBadge> : null}
            <BooleanBadge value={(initial.fields.resolved ?? '').toLowerCase() === 'true'} trueLabel="Resolved" falseLabel="Open" trueVariant="success" />
            {(initial.fields.follow_up_required ?? '').toLowerCase() === 'true' ? <BooleanBadge value={true} trueLabel="Follow-up required" trueVariant="warning" /> : null}
          </div>
          {initial.fields.description ? <p className="whitespace-pre-wrap text-foreground">{initial.fields.description}</p> : null}
          {initial.fields.response_taken ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Response</p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{initial.fields.response_taken}</p>
            </div>
          ) : null}
          {initial.fields.reported_by ? <p className="text-muted-foreground">Reported by {initial.fields.reported_by}</p> : null}
        </div>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <label className={label}>
            Incident date
            <input type="date" className={input} value={incidentDate} onChange={(e) => setIncidentDate(e.target.value)} required />
          </label>
          <label className={label}>
            Incident type
            <select className={input} value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
              {['Medical', 'Security', 'Behavioral', 'SelfHarm', 'RunawayAttempt', 'ConflictWithPeer', 'PropertyDamage', 'Other'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Severity
            <select className={input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {['Low', 'Medium', 'High'].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Description
            <textarea className={input} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className={label}>
            Response taken
            <textarea className={input} rows={3} value={responseTaken} onChange={(e) => setResponseTaken(e.target.value)} />
          </label>
          <label className={label}>
            Reported by
            <input className={input} value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} />
          </label>
          <ToggleField labelText="Resolved" value={resolved} onChange={setResolved} />
          {resolved ? (
            <label className={label}>
              Resolution date
              <input type="date" className={input} value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} />
            </label>
          ) : null}
          <ToggleField labelText="Follow-up required" value={followUpRequired} onChange={setFollowUpRequired} />
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Saving…' : mode === 'create' ? 'Save incident' : 'Save changes'}
            </button>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </CaseDrawer>
  )
}

function ProfileEditDrawer({
  residentId,
  fields,
  safehouses,
  onClose,
  onSaved,
  saving,
  setSaving,
  onError,
}: {
  residentId: number
  fields: Record<string, string>
  safehouses: SafehouseOption[]
  onClose: () => void
  onSaved: () => Promise<void>
  saving: boolean
  setSaving: (value: boolean) => void
  onError: (value: string | null) => void
}) {
  const [caseStatus, setCaseStatus] = useState(gf(fields, 'case_status', 'caseStatus'))
  const [riskLevel, setRiskLevel] = useState(gf(fields, 'current_risk_level', 'currentRiskLevel'))
  const [reintegrationStatus, setReintegrationStatus] = useState(gf(fields, 'reintegration_status', 'reintegrationStatus'))
  const [reintegrationType, setReintegrationType] = useState(gf(fields, 'reintegration_type', 'reintegrationType'))
  const [assignedWorker, setAssignedWorker] = useState(gf(fields, 'assigned_social_worker', 'assignedSocialWorker'))
  const [presentAge, setPresentAge] = useState(gf(fields, 'present_age', 'presentAge'))
  const [sex, setSex] = useState(gf(fields, 'sex'))
  const [safehouseId, setSafehouseId] = useState(gf(fields, 'safehouse_id', 'safehouseId'))
  const [admissionDate, setAdmissionDate] = useState(gf(fields, 'date_of_admission', 'dateOfAdmission'))

  async function submit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    setSaving(true)
    try {
      await patchResident(residentId, {
        case_status: caseStatus,
        current_risk_level: riskLevel,
        reintegration_status: reintegrationStatus,
        reintegration_type: reintegrationType,
        assigned_social_worker: assignedWorker,
        present_age: presentAge || null,
        sex,
        safehouse_id: safehouseId || null,
        date_of_admission: admissionDate || null,
      })
      await onSaved()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <CaseDrawer title="Edit profile" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className={label}>
          Case status
          <select className={input} value={caseStatus} onChange={(e) => setCaseStatus(e.target.value)}>
            <option value="">—</option>
            {CASE_STATUSES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Risk level
          <select className={input} value={riskLevel} onChange={(e) => setRiskLevel(e.target.value)}>
            <option value="">—</option>
            {RISK_LEVELS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Reintegration status
          <input className={input} value={reintegrationStatus} onChange={(e) => setReintegrationStatus(e.target.value)} />
        </label>
        <label className={label}>
          Reintegration type
          <input className={input} value={reintegrationType} onChange={(e) => setReintegrationType(e.target.value)} />
        </label>
        <label className={label}>
          Assigned social worker
          <input className={input} value={assignedWorker} onChange={(e) => setAssignedWorker(e.target.value)} />
        </label>
        <label className={label}>
          Present age
          <input className={input} inputMode="numeric" value={presentAge} onChange={(e) => setPresentAge(e.target.value)} />
        </label>
        <label className={label}>
          Sex
          <select className={input} value={sex} onChange={(e) => setSex(e.target.value)}>
            <option value="">—</option>
            {SEX_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Safehouse
          <select className={input} value={safehouseId} onChange={(e) => setSafehouseId(e.target.value)}>
            <option value="">—</option>
            {safehouses.map((option) => (
              <option key={option.id} value={String(option.id)}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Admission date
          <input type="date" className={input} value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <button type="submit" disabled={saving} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </CaseDrawer>
  )
}
