import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createEducationRecord,
  createHealthRecord,
  createHomeVisitation,
  createInterventionPlan,
  createProcessRecording,
  getHomeVisitations,
  getInterventionPlans,
  getProcessRecordings,
  getReintegrationReadinessCohort,
  listEducationRecords,
  listHealthRecords,
  listIncidentReports,
  type EducationRecord,
  type HealthRecord,
  type HomeVisitation,
  type IncidentReport,
  type InterventionPlan,
  type ProcessRecording,
  type ResidentSummary,
} from '../../../api/admin'
import {
  alertError,
  btnPrimary,
  card,
  input,
  label,
  pageDesc,
  pageTitle,
} from '../shared/adminStyles'
import {
  deriveReadinessPrediction,
  deriveReadinessTier,
  formatFeatureValue,
  type ImprovementArea,
  type ReintegrationResult,
  TIER_CONFIG,
} from '../../../components/ml/reintegrationReadinessShared'

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

type SectionAction = {
  label: string
  section: SectionId
  preset?: Partial<PlannerPreset>
}

type PlannerPreset = {
  category: string
  description: string
  targetDate: string
  caseConferenceDate: string
  servicesProvided: string
}

type SectionId =
  | 'plan-overview'
  | 'health-history'
  | 'health-form'
  | 'education-history'
  | 'education-form'
  | 'session-history'
  | 'session-form'
  | 'incident-history'
  | 'visit-history'
  | 'visit-form'
  | 'plan-builder'

const ACTION_PLAN_STORAGE_KEY = 'reintegration-readiness-action-plans:v1'

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

function checklistItems(resident: CohortResident) {
  const actions = resident.readiness.top_improvements.slice(0, 3).map((area) => area.suggestion)
  return [...actions, 'Review reintegration status and set the next follow-up date.'].slice(0, 4)
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

function readinessNarrative(resident: CohortResident) {
  const topAreas = resident.readiness.top_improvements.slice(0, 2).map((area) => area.label.toLowerCase())
  const list = topAreas.length > 0 ? topAreas.join(' and ') : 'consistent case review'
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)

  if (prediction === 'Ready') {
    return `This resident is above the readiness threshold. Use this page to confirm transition details and keep ${list} stable before reintegration moves ahead.`
  }
  if (deriveReadinessTier(resident.readiness.reintegration_probability) === 'Moderate Readiness') {
    return `This resident is close to readiness, but ${list} still need follow-through before reintegration planning is fully safe.`
  }
  return `This resident is not yet ready for reintegration. The clearest blockers are ${list}, and the next actions on this page should focus there first.`
}

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function extendedNotes(label: string, notes: string) {
  return JSON.stringify({ source: 'reintegration-action-plan', label, notes })
}

function actionConfig(area: ImprovementArea): SectionAction[] {
  switch (area.feature) {
    case 'avg_general_health_score':
    case 'pct_psych_checkup_done':
    case 'num_health_records':
      return [
        { label: 'Review health history', section: 'health-history' },
        {
          label: 'Schedule health assessment',
          section: 'plan-builder',
          preset: {
            category: 'Health',
            description: `Schedule a health assessment to address ${area.label.toLowerCase()}.`,
            servicesProvided: 'Health assessment follow-up',
          },
        },
        { label: 'Create health assessment', section: 'health-form' },
      ]
    case 'avg_progress_percent':
    case 'latest_attendance_rate':
      return [
        { label: 'Review education history', section: 'education-history' },
        {
          label: 'Create education support plan',
          section: 'plan-builder',
          preset: {
            category: 'Education',
            description: `Create an education support plan to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Education support and follow-up',
          },
        },
        { label: 'Log education update', section: 'education-form' },
      ]
    case 'total_incidents':
    case 'num_severe_incidents':
      return [
        { label: 'Review incident history', section: 'incident-history' },
        {
          label: 'Create behaviour support plan',
          section: 'plan-builder',
          preset: {
            category: 'Behaviour',
            description: `Create a behaviour support plan to address ${area.label.toLowerCase()}.`,
            servicesProvided: 'Behaviour support and incident review',
          },
        },
        {
          label: 'Schedule case conference',
          section: 'plan-builder',
          preset: {
            category: 'Case Conference',
            description: `Schedule a case conference to review ${area.label.toLowerCase()} and next steps.`,
            servicesProvided: 'Case conference and risk review',
          },
        },
      ]
    case 'pct_progress_noted':
    case 'pct_concerns_flagged':
    case 'total_sessions':
      return [
        { label: 'Review session history', section: 'session-history' },
        { label: 'Add process note', section: 'session-form' },
        {
          label: 'Create support plan',
          section: 'plan-builder',
          preset: {
            category: 'Counselling',
            description: `Create a support plan to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Counselling and progress monitoring',
          },
        },
      ]
    case 'total_plans':
    case 'pct_plans_achieved':
      return [
        { label: 'Review current plans', section: 'plan-builder' },
        {
          label: 'Create reintegration goal',
          section: 'plan-builder',
          preset: {
            category: 'Reintegration',
            description: `Create a reintegration goal to improve ${area.label.toLowerCase()}.`,
            servicesProvided: 'Reintegration planning and follow-up',
          },
        },
        { label: 'Review visit history', section: 'visit-history' },
      ]
    case 'days_in_program':
      return [
        { label: 'Review action plan', section: 'plan-overview' },
        {
          label: 'Create transition readiness plan',
          section: 'plan-builder',
          preset: {
            category: 'Reintegration',
            description: 'Create a transition readiness plan to build stability before reintegration.',
            servicesProvided: 'Transition planning and supervision',
          },
        },
        { label: 'Schedule home visit', section: 'visit-form' },
      ]
    default:
      return [
        { label: 'Review action plan', section: 'plan-overview' },
        { label: 'Review visit history', section: 'visit-history' },
        { label: 'Create support plan', section: 'plan-builder' },
      ]
  }
}

function SectionCard({
  id,
  title,
  description,
  sectionRefs,
  children,
}: {
  id: SectionId
  title: string
  description: string
  sectionRefs: Record<SectionId, RefObject<HTMLDivElement | null>>
  children: ReactNode
}) {
  return (
    <section id={id} ref={sectionRefs[id]} className={`${card} scroll-mt-28 space-y-4`}>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export function ReintegrationActionPlanPage() {
  const { id: idParam } = useParams()
  const residentId = Number(idParam)

  const [resident, setResident] = useState<CohortResident | null>(null)
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([])
  const [educationRecords, setEducationRecords] = useState<EducationRecord[]>([])
  const [incidentReports, setIncidentReports] = useState<IncidentReport[]>([])
  const [processRecordings, setProcessRecordings] = useState<ProcessRecording[]>([])
  const [homeVisits, setHomeVisits] = useState<HomeVisitation[]>([])
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [savedPlans, setSavedPlans] = useState<Record<string, SavedActionPlan>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [plannerPreset, setPlannerPreset] = useState<PlannerPreset>({
    category: 'Reintegration',
    description: '',
    targetDate: '',
    caseConferenceDate: '',
    servicesProvided: '',
  })

  const [healthForm, setHealthForm] = useState({ recordDate: isoToday(), healthScore: '', notes: '' })
  const [educationForm, setEducationForm] = useState({ recordDate: isoToday(), progressPercent: '', notes: '' })
  const [sessionForm, setSessionForm] = useState({
    sessionDate: isoToday(),
    socialWorker: '',
    sessionType: 'Reintegration support',
    narrative: '',
    progressNoted: true,
    concernsFlagged: false,
  })
  const [visitForm, setVisitForm] = useState({
    visitDate: isoToday(),
    socialWorker: '',
    visitType: 'Reintegration assessment',
    purpose: '',
    observations: '',
    followUpNeeded: true,
  })
  const [plannerForm, setPlannerForm] = useState({
    category: 'Reintegration',
    description: '',
    targetDate: '',
    caseConferenceDate: '',
    servicesProvided: '',
  })

  const sectionRefs: Record<SectionId, RefObject<HTMLDivElement | null>> = {
    'plan-overview': useRef<HTMLDivElement>(null),
    'health-history': useRef<HTMLDivElement>(null),
    'health-form': useRef<HTMLDivElement>(null),
    'education-history': useRef<HTMLDivElement>(null),
    'education-form': useRef<HTMLDivElement>(null),
    'session-history': useRef<HTMLDivElement>(null),
    'session-form': useRef<HTMLDivElement>(null),
    'incident-history': useRef<HTMLDivElement>(null),
    'visit-history': useRef<HTMLDivElement>(null),
    'visit-form': useRef<HTMLDivElement>(null),
    'plan-builder': useRef<HTMLDivElement>(null),
  }

  const scrollToSection = useCallback((section: SectionId) => {
    sectionRefs[section].current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sectionRefs])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cohort, health, education, incidents, recordings, visits, interventionPlans] = await Promise.all([
        getReintegrationReadinessCohort(),
        listHealthRecords(residentId),
        listEducationRecords(residentId),
        listIncidentReports(residentId),
        getProcessRecordings(residentId),
        getHomeVisitations(residentId),
        getInterventionPlans(residentId),
      ])

      const row = cohort.residents.find((item) => item.id === residentId) ?? null
      if (!row) {
        throw new Error('Resident not found in the active reintegration readiness cohort.')
      }

      setResident(row)
      setHealthRecords(health)
      setEducationRecords(education)
      setIncidentReports(incidents)
      setProcessRecordings(recordings)
      setHomeVisits(visits)
      setPlans(interventionPlans)
      setPlannerForm((current) => ({
        ...current,
        servicesProvided: current.servicesProvided || 'Reintegration planning support',
      }))
      setSessionForm((current) => ({
        ...current,
        socialWorker: current.socialWorker || (row.assignedSocialWorker ?? ''),
      }))
      setVisitForm((current) => ({
        ...current,
        socialWorker: current.socialWorker || (row.assignedSocialWorker ?? ''),
      }))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load reintegration action plan.')
    } finally {
      setLoading(false)
    }
  }, [residentId])

  useEffect(() => {
    setSavedPlans(loadSavedActionPlans())
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!plannerPreset.description && !plannerPreset.servicesProvided && !plannerPreset.category) return
    setPlannerForm((current) => ({
      category: plannerPreset.category || current.category,
      description: plannerPreset.description || current.description,
      targetDate: plannerPreset.targetDate || current.targetDate,
      caseConferenceDate: plannerPreset.caseConferenceDate || current.caseConferenceDate,
      servicesProvided: plannerPreset.servicesProvided || current.servicesProvided,
    }))
  }, [plannerPreset])

  const actionPlan = useMemo(() => {
    if (!resident) return null
    return savedPlans[String(resident.id)] ?? defaultSavedPlan(resident)
  }, [resident, savedPlans])

  const updateActionPlan = useCallback((nextPlan: SavedActionPlan) => {
    if (!resident) return
    setSavedPlans((current) => {
      const next = { ...current, [String(resident.id)]: nextPlan }
      saveActionPlans(next)
      return next
    })
  }, [resident])

  const handlePriorityAction = (action: SectionAction) => {
    if (action.preset) setPlannerPreset((current) => ({ ...current, ...action.preset }))
    scrollToSection(action.section)
  }

  const handleCreateHealthRecord = async () => {
    if (!resident) return
    const score = Number(healthForm.healthScore)
    if (!Number.isFinite(score)) {
      setNotice('Enter a valid health score before creating the assessment.')
      return
    }
    await createHealthRecord({
      residentId: resident.id,
      recordDate: healthForm.recordDate,
      healthScore: score,
      extendedJson: extendedNotes('health_assessment', healthForm.notes),
    })
    setHealthForm({ recordDate: isoToday(), healthScore: '', notes: '' })
    setNotice('Health assessment created.')
    await load()
  }

  const handleCreateEducationRecord = async () => {
    if (!resident) return
    const progress = Number(educationForm.progressPercent)
    if (!Number.isFinite(progress)) {
      setNotice('Enter a valid progress percent before creating the education update.')
      return
    }
    await createEducationRecord({
      residentId: resident.id,
      recordDate: educationForm.recordDate,
      progressPercent: progress,
      extendedJson: extendedNotes('education_update', educationForm.notes),
    })
    setEducationForm({ recordDate: isoToday(), progressPercent: '', notes: '' })
    setNotice('Education update created.')
    await load()
  }

  const handleCreateProcessRecording = async () => {
    if (!resident) return
    if (!sessionForm.socialWorker.trim() || !sessionForm.narrative.trim()) {
      setNotice('Add both a social worker and session narrative before saving the process note.')
      return
    }
    await createProcessRecording({
      residentId: resident.id,
      sessionDate: sessionForm.sessionDate,
      socialWorker: sessionForm.socialWorker.trim(),
      sessionType: sessionForm.sessionType,
      sessionNarrative: sessionForm.narrative.trim(),
      progressNoted: sessionForm.progressNoted,
      concernsFlagged: sessionForm.concernsFlagged,
    })
    setSessionForm((current) => ({
      ...current,
      sessionDate: isoToday(),
      narrative: '',
      progressNoted: true,
      concernsFlagged: false,
    }))
    setNotice('Process note created.')
    await load()
  }

  const handleCreateVisit = async () => {
    if (!resident) return
    if (!visitForm.socialWorker.trim()) {
      setNotice('Add a social worker before scheduling the visit.')
      return
    }
    await createHomeVisitation({
      residentId: resident.id,
      visitDate: visitForm.visitDate,
      socialWorker: visitForm.socialWorker.trim(),
      visitType: visitForm.visitType,
      purpose: visitForm.purpose.trim(),
      observations: visitForm.observations.trim(),
      followUpNeeded: visitForm.followUpNeeded,
      safetyConcernsNoted: false,
    })
    setVisitForm((current) => ({
      ...current,
      visitDate: isoToday(),
      purpose: '',
      observations: '',
      followUpNeeded: true,
    }))
    setNotice('Home visit scheduled.')
    await load()
  }

  const handleCreatePlan = async () => {
    if (!resident) return
    if (!plannerForm.description.trim()) {
      setNotice('Add a plan description before creating the plan.')
      return
    }
    await createInterventionPlan({
      residentId: resident.id,
      planCategory: plannerForm.category,
      planDescription: plannerForm.description.trim(),
      status: 'In Progress',
      targetDate: plannerForm.targetDate || null,
      caseConferenceDate: plannerForm.caseConferenceDate || null,
      servicesProvided: plannerForm.servicesProvided.trim() || null,
    })
    setPlannerForm({
      category: 'Reintegration',
      description: '',
      targetDate: '',
      caseConferenceDate: '',
      servicesProvided: '',
    })
    setPlannerPreset({
      category: 'Reintegration',
      description: '',
      targetDate: '',
      caseConferenceDate: '',
      servicesProvided: '',
    })
    setNotice('Intervention plan created.')
    await load()
  }

  const sortedHealth = [...healthRecords].sort((a, b) => b.recordDate.localeCompare(a.recordDate))
  const sortedEducation = [...educationRecords].sort((a, b) => b.recordDate.localeCompare(a.recordDate))
  const sortedIncidents = [...incidentReports].sort((a, b) => b.incidentDate.localeCompare(a.incidentDate))
  const sortedSessions = [...processRecordings].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
  const sortedVisits = [...homeVisits].sort((a, b) => b.visitDate.localeCompare(a.visitDate))
  const sortedPlans = [...plans].sort((a, b) => (b.targetDate ?? '').localeCompare(a.targetDate ?? ''))

  if (loading) {
    return <div className="space-y-4"><div className={`${card} animate-pulse h-28`} /><div className={`${card} animate-pulse h-96`} /></div>
  }

  if (error || !resident || !actionPlan) {
    return <div className={alertError}>{error ?? 'Unable to load reintegration action plan.'}</div>
  }

  const tier = deriveReadinessTier(resident.readiness.reintegration_probability)
  const prediction = deriveReadinessPrediction(resident.readiness.reintegration_probability)
  const tierConfig = TIER_CONFIG[tier]
  const completedChecklist = actionPlan.checklist.filter((item) => item.done).length

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reintegration</p>
          <h1 className={pageTitle}>Action Plan for {resident.internalCode}</h1>
          <p className={pageDesc}>
            A full-page working plan with blocker-specific actions, related history, and in-page tools to move the case forward.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => void load()}>
            Refresh
          </button>
          <Link to="/admin/reintigration-readiness" className={btnPrimary}>
            Back to readiness list
          </Link>
        </div>
      </div>

      {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <SectionCard id="plan-overview" title="Plan overview" description="Readiness summary, ownership, and next review details." sectionRefs={sectionRefs}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Readiness score</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{Math.round(resident.readiness.reintegration_probability * 100)}%</p>
              <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tierConfig.badge}`}>{prediction}</span>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resident context</p>
              <p className="mt-2 text-sm font-medium text-foreground">{resident.safehouseName ?? 'No safehouse'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{resident.reintegrationStatus ?? 'Not started'} · {resident.currentRiskLevel ?? 'No current risk label'}</p>
            </div>
            <div className="rounded-xl border border-border bg-background px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Checklist progress</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{completedChecklist}/{actionPlan.checklist.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">Actions completed in this working plan</p>
            </div>
          </div>

          <p className="rounded-xl border border-border bg-muted/20 px-4 py-4 text-sm leading-relaxed text-muted-foreground">
            {readinessNarrative(resident)}
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <label className={label}>
              Owner
              <input className={input} value={actionPlan.owner} onChange={(e) => updateActionPlan({ ...actionPlan, owner: e.target.value })} />
            </label>
            <label className={label}>
              Due date
              <input type="date" className={input} value={actionPlan.dueDate} onChange={(e) => updateActionPlan({ ...actionPlan, dueDate: e.target.value })} />
            </label>
            <label className={label}>
              Next review
              <input type="date" className={input} value={actionPlan.nextReviewDate} onChange={(e) => updateActionPlan({ ...actionPlan, nextReviewDate: e.target.value })} />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {actionPlan.lastReviewedAt ? `Last reviewed ${new Date(actionPlan.lastReviewedAt).toLocaleString()}` : 'No review has been logged for this action plan yet.'}
            </p>
            <button type="button" className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted" onClick={() => updateActionPlan({ ...actionPlan, lastReviewedAt: new Date().toISOString() })}>
              Mark reviewed today
            </button>
          </div>
          <ul className="space-y-2">
            {actionPlan.checklist.map((item) => (
              <li key={item.id} className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) =>
                    updateActionPlan({
                      ...actionPlan,
                      checklist: actionPlan.checklist.map((entry) => entry.id === item.id ? { ...entry, done: e.target.checked } : entry),
                    })
                  }
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span className={item.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{item.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className={`${card} sticky top-24 h-fit space-y-4`}>
          <div>
            <h2 className="text-base font-semibold text-foreground">Priority blockers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each blocker has buttons that jump to the matching history or in-page form.</p>
          </div>
          {resident.readiness.top_improvements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No major blockers surfaced in the latest model run.</p>
          ) : (
            resident.readiness.top_improvements.map((area, index) => (
              <div key={area.feature} className="rounded-xl border border-border bg-background px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Priority {index + 1}</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">{area.label}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatFeatureValue(area.feature, area.resident_value)} current vs {formatFeatureValue(area.feature, area.benchmark_value)} target
                </p>
                <p className="mt-3 text-sm leading-relaxed text-foreground">{area.suggestion}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {actionConfig(area).map((action) => (
                    <button
                      key={`${area.feature}-${action.label}`}
                      type="button"
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                      onClick={() => handlePriorityAction(action)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard id="health-history" title="Health history" description="Review prior health scores and recent assessment notes." sectionRefs={sectionRefs}>
          {sortedHealth.length === 0 ? <p className="text-sm text-muted-foreground">No health records yet.</p> : (
            <ul className="space-y-2">
              {sortedHealth.slice(0, 8).map((record) => (
                <li key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{record.recordDate.slice(0, 10)} · Score {record.healthScore?.toFixed(2) ?? '—'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{record.extendedJson ?? 'No additional notes recorded.'}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="health-form" title="Create health assessment" description="Add a new health score update without leaving this page." sectionRefs={sectionRefs}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Assessment date
              <input type="date" className={input} value={healthForm.recordDate} onChange={(e) => setHealthForm((c) => ({ ...c, recordDate: e.target.value }))} />
            </label>
            <label className={label}>
              Health score
              <input className={input} value={healthForm.healthScore} onChange={(e) => setHealthForm((c) => ({ ...c, healthScore: e.target.value }))} placeholder="1.0 - 10.0" />
            </label>
          </div>
          <label className={label}>
            Notes
            <textarea className={input} rows={4} value={healthForm.notes} onChange={(e) => setHealthForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Assessment findings, follow-up needs, medications, referrals…" />
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateHealthRecord()}>
            Save health assessment
          </button>
        </SectionCard>

        <SectionCard id="education-history" title="Education history" description="Review progress records and attendance-related updates." sectionRefs={sectionRefs}>
          {sortedEducation.length === 0 ? <p className="text-sm text-muted-foreground">No education records yet.</p> : (
            <ul className="space-y-2">
              {sortedEducation.slice(0, 8).map((record) => (
                <li key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{record.recordDate.slice(0, 10)} · Progress {record.progressPercent?.toFixed(1) ?? '—'}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">{record.extendedJson ?? 'No additional notes recorded.'}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="education-form" title="Log education update" description="Add a progress update or school support note from this page." sectionRefs={sectionRefs}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Record date
              <input type="date" className={input} value={educationForm.recordDate} onChange={(e) => setEducationForm((c) => ({ ...c, recordDate: e.target.value }))} />
            </label>
            <label className={label}>
              Progress percent
              <input className={input} value={educationForm.progressPercent} onChange={(e) => setEducationForm((c) => ({ ...c, progressPercent: e.target.value }))} placeholder="0 - 100" />
            </label>
          </div>
          <label className={label}>
            Notes
            <textarea className={input} rows={4} value={educationForm.notes} onChange={(e) => setEducationForm((c) => ({ ...c, notes: e.target.value }))} placeholder="Attendance concerns, tutoring steps, school updates…" />
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateEducationRecord()}>
            Save education update
          </button>
        </SectionCard>

        <SectionCard id="session-history" title="Session history" description="Recent counselling and process-recording notes related to readiness." sectionRefs={sectionRefs}>
          {sortedSessions.length === 0 ? <p className="text-sm text-muted-foreground">No process recordings yet.</p> : (
            <ul className="space-y-2">
              {sortedSessions.slice(0, 8).map((record) => (
                <li key={record.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{record.sessionDate.slice(0, 10)} · {record.sessionType}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{record.socialWorker} · Progress {record.progressNoted ? 'noted' : 'not noted'} · Concerns {record.concernsFlagged ? 'flagged' : 'not flagged'}</p>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{record.sessionNarrative}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="session-form" title="Add process note" description="Capture a readiness-related session note here." sectionRefs={sectionRefs}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Session date
              <input type="date" className={input} value={sessionForm.sessionDate} onChange={(e) => setSessionForm((c) => ({ ...c, sessionDate: e.target.value }))} />
            </label>
            <label className={label}>
              Social worker
              <input className={input} value={sessionForm.socialWorker} onChange={(e) => setSessionForm((c) => ({ ...c, socialWorker: e.target.value }))} />
            </label>
          </div>
          <label className={label}>
            Session type
            <input className={input} value={sessionForm.sessionType} onChange={(e) => setSessionForm((c) => ({ ...c, sessionType: e.target.value }))} />
          </label>
          <label className={label}>
            Session narrative
            <textarea className={input} rows={4} value={sessionForm.narrative} onChange={(e) => setSessionForm((c) => ({ ...c, narrative: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-4 text-sm text-foreground">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.progressNoted} onChange={(e) => setSessionForm((c) => ({ ...c, progressNoted: e.target.checked }))} />
              Progress noted
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={sessionForm.concernsFlagged} onChange={(e) => setSessionForm((c) => ({ ...c, concernsFlagged: e.target.checked }))} />
              Concerns flagged
            </label>
          </div>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateProcessRecording()}>
            Save process note
          </button>
        </SectionCard>

        <SectionCard id="incident-history" title="Incident history" description="Review recent incidents and their resolution status." sectionRefs={sectionRefs}>
          {sortedIncidents.length === 0 ? <p className="text-sm text-muted-foreground">No incident reports yet.</p> : (
            <ul className="space-y-2">
              {sortedIncidents.slice(0, 8).map((incident) => (
                <li key={incident.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{incident.incidentDate.slice(0, 10)} · {incident.incidentType} · {incident.severity}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{incident.resolved ? 'Resolved' : 'Open'} · Follow-up {incident.followUpRequired ? 'required' : 'not required'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{incident.description ?? 'No description recorded.'}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="visit-history" title="Visit history" description="Home and reintegration visits that support family readiness work." sectionRefs={sectionRefs}>
          {sortedVisits.length === 0 ? <p className="text-sm text-muted-foreground">No home visits yet.</p> : (
            <ul className="space-y-2">
              {sortedVisits.slice(0, 8).map((visit) => (
                <li key={visit.id} className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{visit.visitDate.slice(0, 10)} · {visit.visitType}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{visit.socialWorker} · Follow-up {visit.followUpNeeded ? 'needed' : 'not needed'}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{visit.observations ?? visit.purpose ?? 'No observations recorded.'}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard id="visit-form" title="Schedule home visit" description="Add a reintegration-focused visit without leaving this page." sectionRefs={sectionRefs}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Visit date
              <input type="date" className={input} value={visitForm.visitDate} onChange={(e) => setVisitForm((c) => ({ ...c, visitDate: e.target.value }))} />
            </label>
            <label className={label}>
              Social worker
              <input className={input} value={visitForm.socialWorker} onChange={(e) => setVisitForm((c) => ({ ...c, socialWorker: e.target.value }))} />
            </label>
          </div>
          <label className={label}>
            Visit type
            <input className={input} value={visitForm.visitType} onChange={(e) => setVisitForm((c) => ({ ...c, visitType: e.target.value }))} />
          </label>
          <label className={label}>
            Purpose
            <textarea className={input} rows={3} value={visitForm.purpose} onChange={(e) => setVisitForm((c) => ({ ...c, purpose: e.target.value }))} />
          </label>
          <label className={label}>
            Observations
            <textarea className={input} rows={3} value={visitForm.observations} onChange={(e) => setVisitForm((c) => ({ ...c, observations: e.target.value }))} />
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={visitForm.followUpNeeded} onChange={(e) => setVisitForm((c) => ({ ...c, followUpNeeded: e.target.checked }))} />
            Follow-up needed
          </label>
          <button type="button" className={btnPrimary} onClick={() => void handleCreateVisit()}>
            Save home visit
          </button>
        </SectionCard>
      </div>

      <SectionCard id="plan-builder" title="Plan builder" description="Create a focused intervention, support plan, or case conference directly from the action plan page." sectionRefs={sectionRefs}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Plan category
            <input className={input} value={plannerForm.category} onChange={(e) => setPlannerForm((c) => ({ ...c, category: e.target.value }))} />
          </label>
          <label className={label}>
            Target date
            <input type="date" className={input} value={plannerForm.targetDate} onChange={(e) => setPlannerForm((c) => ({ ...c, targetDate: e.target.value }))} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={label}>
            Case conference date
            <input type="date" className={input} value={plannerForm.caseConferenceDate} onChange={(e) => setPlannerForm((c) => ({ ...c, caseConferenceDate: e.target.value }))} />
          </label>
          <label className={label}>
            Services provided
            <input className={input} value={plannerForm.servicesProvided} onChange={(e) => setPlannerForm((c) => ({ ...c, servicesProvided: e.target.value }))} />
          </label>
        </div>
        <label className={label}>
          Plan description
          <textarea className={input} rows={4} value={plannerForm.description} onChange={(e) => setPlannerForm((c) => ({ ...c, description: e.target.value }))} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => void handleCreatePlan()}>
            Create intervention plan
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            onClick={() => {
              setPlannerForm({
                category: 'Reintegration',
                description: '',
                targetDate: '',
                caseConferenceDate: '',
                servicesProvided: '',
              })
              setPlannerPreset({
                category: 'Reintegration',
                description: '',
                targetDate: '',
                caseConferenceDate: '',
                servicesProvided: '',
              })
            }}
          >
            Clear template
          </button>
        </div>
        <div className="rounded-xl border border-border bg-background px-4 py-4">
          <h3 className="text-sm font-semibold text-foreground">Existing plans</h3>
          {sortedPlans.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No intervention plans yet.</p> : (
            <ul className="mt-3 space-y-2">
              {sortedPlans.slice(0, 8).map((plan) => (
                <li key={plan.id} className="rounded-lg border border-border bg-muted/20 px-3 py-3">
                  <p className="text-sm font-medium text-foreground">{plan.planCategory} · {plan.status}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.planDescription}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Target {plan.targetDate ? plan.targetDate.slice(0, 10) : '—'} · Conference {plan.caseConferenceDate ? plan.caseConferenceDate.slice(0, 10) : '—'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
