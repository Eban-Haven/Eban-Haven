import type { EducationRecord, HealthRecord, HomeVisitation, InterventionPlan, ProcessRecording } from '../../../../api/admin'
import { formatAdminDate } from '../adminDataTable/adminFormatters'

export type MainWorkspaceTab = 'overview' | 'timeline' | 'plans' | 'safety' | 'info' | 'insights'

export type TimelineKind = 'process' | 'visit' | 'education' | 'health' | 'plan'

export type TimelineItem = {
  key: string
  kind: TimelineKind
  sort: number
  dateIso: string
  title: string
  summary: string
  worker?: string
  flags: { label: string; tone: 'default' | 'danger' | 'warning' | 'success' }[]
  /** Original row for drawer open */
  ref:
    | { kind: 'process'; row: ProcessRecording }
    | { kind: 'visit'; row: HomeVisitation }
    | { kind: 'education'; row: EducationRecord }
    | { kind: 'health'; row: HealthRecord }
    | { kind: 'plan'; row: InterventionPlan }
}

export function planIsOverdue(p: InterventionPlan): boolean {
  if (!p.targetDate) return false
  const st = p.status.toLowerCase()
  if (st.includes('achieved') || st.includes('closed') || st.includes('completed')) return false
  return new Date(p.targetDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)
}

export function buildTimelineItems(
  proc: ProcessRecording[],
  vis: HomeVisitation[],
  edu: EducationRecord[],
  hl: HealthRecord[],
  plans: InterventionPlan[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const r of proc) {
    const t = new Date(r.sessionDate).getTime()
    const flags: TimelineItem['flags'] = []
    if (r.concernsFlagged) flags.push({ label: 'Concerns', tone: 'danger' })
    if (r.progressNoted) flags.push({ label: 'Progress', tone: 'success' })
    if (r.followUpActions?.trim()) flags.push({ label: 'Follow-up', tone: 'warning' })
    items.push({
      key: `p-${r.id}`,
      kind: 'process',
      sort: t,
      dateIso: r.sessionDate,
      title: 'Process recording',
      summary: `${r.sessionType} · ${r.sessionNarrative.slice(0, 120)}${r.sessionNarrative.length > 120 ? '…' : ''}`,
      worker: r.socialWorker,
      flags,
      ref: { kind: 'process', row: r },
    })
  }
  for (const v of vis) {
    const t = new Date(v.visitDate).getTime()
    const flags: TimelineItem['flags'] = []
    if (v.safetyConcernsNoted) flags.push({ label: 'Safety', tone: 'danger' })
    if (v.followUpNeeded) flags.push({ label: 'Follow-up needed', tone: 'warning' })
    if (v.visitOutcome) flags.push({ label: v.visitOutcome, tone: 'default' })
    items.push({
      key: `v-${v.id}`,
      kind: 'visit',
      sort: t,
      dateIso: v.visitDate,
      title: 'Home visit',
      summary: `${v.visitType}${v.locationVisited ? ` · ${v.locationVisited}` : ''}`,
      worker: v.socialWorker,
      flags,
      ref: { kind: 'visit', row: v },
    })
  }
  for (const e of edu) {
    const t = new Date(e.recordDate).getTime()
    items.push({
      key: `e-${e.id}`,
      kind: 'education',
      sort: t,
      dateIso: e.recordDate,
      title: 'Education',
      summary: e.progressPercent != null ? `Progress ${e.progressPercent}%` : 'Record on file',
      flags: [],
      ref: { kind: 'education', row: e },
    })
  }
  for (const h of hl) {
    const t = new Date(h.recordDate).getTime()
    items.push({
      key: `h-${h.id}`,
      kind: 'health',
      sort: t,
      dateIso: h.recordDate,
      title: 'Health & wellbeing',
      summary: h.healthScore != null ? `Wellbeing score ${h.healthScore}` : 'Record on file',
      flags: [],
      ref: { kind: 'health', row: h },
    })
  }
  for (const p of plans) {
    const d = p.updatedAt || p.createdAt
    const t = new Date(d).getTime()
    const flags: TimelineItem['flags'] = [{ label: p.status, tone: 'default' }]
    if (planIsOverdue(p)) flags.push({ label: 'Overdue', tone: 'warning' })
    items.push({
      key: `pl-${p.id}`,
      kind: 'plan',
      sort: t,
      dateIso: d,
      title: 'Intervention plan',
      summary: `${p.planCategory} · ${p.planDescription.slice(0, 100)}${p.planDescription.length > 100 ? '…' : ''}`,
      flags,
      ref: { kind: 'plan', row: p },
    })
  }
  return items.sort((a, b) => b.sort - a.sort)
}

export function filterTimeline(
  items: TimelineItem[],
  opts: {
    kinds: Set<TimelineKind>
    dateFrom: string
    dateTo: string
    workerQ: string
    concernsOnly: boolean
    followUpOnly: boolean
    progressOnly: boolean
    search: string
  },
): TimelineItem[] {
  return items.filter((it) => {
    if (!opts.kinds.has(it.kind)) return false
    if (opts.dateFrom || opts.dateTo) {
      const d = it.dateIso.slice(0, 10)
      if (opts.dateFrom && d < opts.dateFrom) return false
      if (opts.dateTo && d > opts.dateTo) return false
    }
    if (opts.workerQ.trim()) {
      const w = (it.worker ?? '').toLowerCase()
      if (!w.includes(opts.workerQ.trim().toLowerCase())) return false
    }
    if (opts.concernsOnly && it.kind === 'process') {
      const r = it.ref as { kind: 'process'; row: ProcessRecording }
      if (!r.row.concernsFlagged) return false
    } else if (opts.concernsOnly) return false
    if (opts.followUpOnly) {
      if (it.kind === 'visit') {
        const r = it.ref as { kind: 'visit'; row: HomeVisitation }
        if (!r.row.followUpNeeded) return false
      } else if (it.kind === 'process') {
        const r = it.ref as { kind: 'process'; row: ProcessRecording }
        if (!r.row.followUpActions?.trim()) return false
      } else return false
    }
    if (opts.progressOnly) {
      if (it.kind === 'process') {
        const r = it.ref as { kind: 'process'; row: ProcessRecording }
        if (!r.row.progressNoted) return false
      } else return false
    }
    if (opts.search.trim()) {
      const s = opts.search.trim().toLowerCase()
      if (!`${it.title} ${it.summary} ${it.worker ?? ''}`.toLowerCase().includes(s)) return false
    }
    return true
  })
}

export type AlertItem = { level: 'risk' | 'warn' | 'info'; text: string }

export function buildWorkspaceAlerts(params: {
  riskLevel: string
  plans: InterventionPlan[]
  vis: HomeVisitation[]
  proc: ProcessRecording[]
  edu: EducationRecord[]
  hl: HealthRecord[]
  assignedWorker: string
  admission: string
}): AlertItem[] {
  const list: AlertItem[] = []
  const risk = params.riskLevel.toLowerCase()
  if (risk.includes('high') || risk.includes('critical')) {
    list.push({ level: 'risk', text: `Elevated risk level: ${params.riskLevel}` })
  }
  const overdue = params.plans.filter(planIsOverdue)
  if (overdue.length) {
    list.push({ level: 'warn', text: `${overdue.length} intervention plan(s) past target date` })
  }
  params.vis.filter((v) => v.followUpNeeded).forEach((v) => {
    list.push({ level: 'warn', text: `Home visit follow-up · ${formatAdminDate(v.visitDate)}` })
  })
  const concernSessions = params.proc.filter((r) => r.concernsFlagged).length
  if (concernSessions >= 3) {
    list.push({ level: 'warn', text: `${concernSessions} counseling sessions have concerns flagged — review patterns` })
  }
  const eduSorted = [...params.edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (eduSorted.length >= 2) {
    const [a, b] = eduSorted
    const pa = a.progressPercent
    const pb = b.progressPercent
    if (pa != null && pb != null && pa < pb - 15) {
      list.push({ level: 'warn', text: 'Education progress may be declining vs prior record' })
    }
  }
  const hlSorted = [...params.hl].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())
  if (hlSorted.length >= 2) {
    const [a, b] = hlSorted
    const sa = a.healthScore
    const sb = b.healthScore
    if (sa != null && sb != null && sa < sb - 0.75) {
      list.push({ level: 'warn', text: 'General wellbeing score trending down' })
    }
  }
  if (!params.assignedWorker.trim()) {
    list.push({ level: 'warn', text: 'No assigned social worker on file' })
  }
  if (!params.admission.trim()) {
    list.push({ level: 'warn', text: 'Admission date missing' })
  }
  return list
}

export function buildNextActions(params: {
  plans: InterventionPlan[]
  vis: HomeVisitation[]
  proc: ProcessRecording[]
  edu: EducationRecord[]
}): string[] {
  const lines: string[] = []
  params.vis.filter((v) => v.followUpNeeded).forEach(() => lines.push('Schedule or document follow-up for a flagged home visit'))
  params.plans.filter(planIsOverdue).forEach((p) => lines.push(`Update or close overdue plan: ${p.planCategory}`))
  const openPlans = params.plans.filter((p) => !p.status.toLowerCase().includes('closed'))
  if (openPlans.length) lines.push('Review active intervention plans against recent activity')
  if (params.proc.length === 0) lines.push('Add a process recording after the next counseling session')
  const latestEdu = [...params.edu].sort((a, b) => new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime())[0]
  if (latestEdu?.progressPercent != null && latestEdu.progressPercent < 50) {
    lines.push('Check education progress and supports with the resident')
  }
  lines.push('Log the next home visit or field contact')
  return [...new Set(lines)].slice(0, 8)
}
