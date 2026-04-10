import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  cardForm,
  checkboxInput,
  emptyCell,
  input,
  label,
  pageDesc,
  pageTitle,
  sectionFormTitle,
  tableBody,
  tableHead,
  tableRowHover,
  tableWrap,
} from '../shared/adminStyles'
import {
  createProcessRecording,
  deleteProcessRecording,
  getProcessRecordings,
  getResidents,
  patchProcessRecording,
  type ProcessRecording,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { BooleanBadge, CategoryBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MinMaxFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
  TriBoolFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inAmountRange,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  matchesTriBool,
  type TriBool,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

const sessionTypes = ['Individual', 'Group'] as const
const emotionalStateOptions = ['Anxious', 'Fearful', 'Neutral', 'Sad', 'Calm', 'Hopeful', 'Engaged'] as const

/** Stored when the directory form hides narrative; API still requires a non-empty narrative. */
const DIRECTORY_SESSION_NARRATIVE = 'Session logged from the counseling sessions directory.'

function residentLabel(r: ResidentSummary) {
  return `${r.internalCode} (#${r.id})`
}

function resolveResidentId(raw: string, residents: ResidentSummary[]): number | null {
  const t = raw.trim()
  if (!t) return null
  const hash = t.match(/#(\d+)\s*$/)
  if (hash) {
    const id = Number(hash[1])
    if (residents.some((r) => r.id === id)) return id
  }
  const exact = residents.find((r) => residentLabel(r) === t)
  if (exact) return exact.id
  const lower = t.toLowerCase()
  const byCode = residents.filter((r) => r.internalCode.toLowerCase() === lower)
  if (byCode.length === 1) return byCode[0].id
  return null
}

function ResidentTypeahead({
  residents,
  inputValue,
  onInputChange,
  onPick,
  disabled,
}: {
  residents: ResidentSummary[]
  inputValue: string
  onInputChange: (v: string) => void
  onPick: (id: number, label: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q) return residents.slice(0, 40)
    return residents
      .filter(
        (r) =>
          r.internalCode.toLowerCase().includes(q) ||
          String(r.id).includes(q) ||
          residentLabel(r).toLowerCase().includes(q),
      )
      .slice(0, 25)
  }, [residents, inputValue])

  useEffect(() => {
    if (!open) return
    function docClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', docClick)
    return () => document.removeEventListener('mousedown', docClick)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <label className={label}>
        Resident
        <input
          className={input}
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type code or #id, pick from list"
          disabled={disabled}
          autoComplete="off"
        />
      </label>
      {open && filtered.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
          role="listbox"
        >
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(r.id, residentLabel(r))
                  setOpen(false)
                }}
              >
                <span className="font-medium text-foreground">{r.internalCode}</span>
                <span className="text-muted-foreground"> · #{r.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function SocialWorkerTypeahead({
  value,
  onChange,
  suggestions,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return suggestions.slice(0, 20)
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 20)
  }, [value, suggestions])

  useEffect(() => {
    if (!open) return
    function docClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', docClick)
    return () => document.removeEventListener('mousedown', docClick)
  }, [open])

  return (
    <div className="relative" ref={wrapRef}>
      <label className={label}>
        Social worker
        <input
          className={input}
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Type or pick from past workers"
          disabled={disabled}
          autoComplete="off"
        />
      </label>
      {open && filtered.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s)
                  setOpen(false)
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function sessionFormStateFromRecording(r: ProcessRecording) {
  return {
    sessionDate: new Date(r.sessionDate).toISOString().slice(0, 10),
    socialWorker: r.socialWorker,
    sessionType: r.sessionType,
    duration: r.sessionDurationMinutes != null ? String(r.sessionDurationMinutes) : '',
    emoStart: r.emotionalStateObserved ?? '',
    emoEnd: r.emotionalStateEnd ?? '',
    narrative: r.sessionNarrative ?? '',
    interventions: r.interventionsApplied ?? '',
    followUp: r.followUpActions ?? '',
    progressNoted: r.progressNoted,
    concernsFlagged: r.concernsFlagged,
    referralMade: r.referralMade,
  }
}

type SessionFormFields = ReturnType<typeof sessionFormStateFromRecording>

function CounselingSessionModal({
  recording,
  swSuggestions,
  error,
  onClose,
  onSaved,
  onError,
}: {
  recording: ProcessRecording
  swSuggestions: string[]
  error: string | null
  onClose: () => void
  onSaved: () => Promise<void>
  onError: (msg: string | null) => void
}) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [busy, setBusy] = useState(false)
  const [fd, setFd] = useState<SessionFormFields>(() => sessionFormStateFromRecording(recording))

  useEffect(() => {
    setFd(sessionFormStateFromRecording(recording))
    setMode('view')
  }, [recording.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    onError(null)
    const sw = fd.socialWorker.trim()
    if (!sw) {
      onError('Social worker is required.')
      return
    }
    const dur = fd.duration.trim() ? parseInt(fd.duration, 10) : undefined
    if (fd.duration.trim() && !Number.isFinite(dur)) {
      onError('Duration must be a number.')
      return
    }
    const at = `${fd.sessionDate}T12:00:00`
    const narr = fd.narrative.trim() || '(No narrative)'
    setBusy(true)
    try {
      await patchProcessRecording(recording.id, {
        sessionDate: at,
        socialWorker: sw,
        sessionType: fd.sessionType,
        sessionDurationMinutes: dur,
        emotionalStateObserved: fd.emoStart.trim() || undefined,
        emotionalStateEnd: fd.emoEnd.trim() || undefined,
        sessionNarrative: narr,
        interventionsApplied: fd.interventions.trim() || undefined,
        followUpActions: fd.followUp.trim() || undefined,
        progressNoted: fd.progressNoted,
        concernsFlagged: fd.concernsFlagged,
        referralMade: fd.referralMade,
      })
      await onSaved()
      onClose()
    } catch (x) {
      onError(x instanceof Error ? x.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this counseling session? This cannot be undone.')) return
    onError(null)
    setBusy(true)
    try {
      await deleteProcessRecording(recording.id)
      await onSaved()
      onClose()
    } catch (x) {
      onError(x instanceof Error ? x.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="session-modal-title" className="text-lg font-semibold text-foreground">
              Counseling session
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {recording.residentInternalCode} · {formatAdminDate(recording.sessionDate)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-3">
          <Link
            to={`/admin/residents/${recording.residentId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open resident profile →
          </Link>
        </div>

        {error ? <div className={`${alertError} mt-4`}>{error}</div> : null}

        {mode === 'view' ? (
          <div className="mt-5 space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Social worker</span>
                <br />
                <span className="font-medium text-foreground">{recording.socialWorker}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Type</span>
                <br />
                <CategoryBadge>{recording.sessionType}</CategoryBadge>
              </p>
              <p>
                <span className="text-muted-foreground">Duration</span>
                <br />
                {recording.sessionDurationMinutes != null ? `${recording.sessionDurationMinutes} min` : '—'}
              </p>
              <p>
                <span className="text-muted-foreground">Emotion (start → end)</span>
                <br />
                {(recording.emotionalStateObserved ?? '—') + ' → ' + (recording.emotionalStateEnd ?? '—')}
              </p>
            </div>
            {recording.sessionNarrative ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Narrative</p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{recording.sessionNarrative}</p>
              </div>
            ) : null}
            {recording.interventionsApplied ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interventions</p>
                <p className="mt-1 whitespace-pre-wrap">{recording.interventionsApplied}</p>
              </div>
            ) : null}
            {recording.followUpActions ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Follow-up</p>
                <p className="mt-1 whitespace-pre-wrap">{recording.followUpActions}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <span className="flex items-center gap-1.5">
                <BooleanBadge value={recording.progressNoted} /> <span className="text-muted-foreground">Progress noted</span>
              </span>
              <span className="flex items-center gap-1.5">
                <BooleanBadge value={recording.concernsFlagged} trueVariant="danger" />{' '}
                <span className="text-muted-foreground">Concerns flagged</span>
              </span>
              <span className="flex items-center gap-1.5">
                <BooleanBadge value={recording.referralMade} /> <span className="text-muted-foreground">Referral made</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" className={btnPrimary} onClick={() => setMode('edit')}>
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                onClick={() => void handleDelete()}
                disabled={busy}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={saveEdit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Session date
                <input
                  type="date"
                  className={input}
                  value={fd.sessionDate}
                  onChange={(e) => setFd((d) => ({ ...d, sessionDate: e.target.value }))}
                  required
                />
              </label>
              <SocialWorkerTypeahead
                value={fd.socialWorker}
                onChange={(v) => setFd((d) => ({ ...d, socialWorker: v }))}
                suggestions={swSuggestions}
              />
              <label className={label}>
                Session type
                <select
                  className={input}
                  value={fd.sessionType}
                  onChange={(e) => setFd((d) => ({ ...d, sessionType: e.target.value }))}
                >
                  {sessionTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Duration (minutes)
                <input
                  className={input}
                  inputMode="numeric"
                  value={fd.duration}
                  onChange={(e) => setFd((d) => ({ ...d, duration: e.target.value }))}
                />
              </label>
              <label className={label}>
                Emotional state (start)
                <select
                  className={input}
                  value={fd.emoStart}
                  onChange={(e) => setFd((d) => ({ ...d, emoStart: e.target.value }))}
                >
                  <option value="">—</option>
                  {emotionalStateOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Emotional state (end)
                <select
                  className={input}
                  value={fd.emoEnd}
                  onChange={(e) => setFd((d) => ({ ...d, emoEnd: e.target.value }))}
                >
                  <option value="">—</option>
                  {emotionalStateOptions.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className={label}>
              Session narrative
              <textarea
                className={input}
                rows={4}
                value={fd.narrative}
                onChange={(e) => setFd((d) => ({ ...d, narrative: e.target.value }))}
              />
            </label>
            <label className={label}>
              Interventions applied
              <input
                className={input}
                value={fd.interventions}
                onChange={(e) => setFd((d) => ({ ...d, interventions: e.target.value }))}
              />
            </label>
            <label className={label}>
              Follow-up actions
              <input className={input} value={fd.followUp} onChange={(e) => setFd((d) => ({ ...d, followUp: e.target.value }))} />
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Progress noted</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={fd.progressNoted}
                  onChange={(e) => setFd((d) => ({ ...d, progressNoted: e.target.checked }))}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Concerns flagged</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={fd.concernsFlagged}
                  onChange={(e) => setFd((d) => ({ ...d, concernsFlagged: e.target.checked }))}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Referral made</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={fd.referralMade}
                  onChange={(e) => setFd((d) => ({ ...d, referralMade: e.target.checked }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={btnPrimary} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted/50"
                onClick={() => {
                  setFd(sessionFormStateFromRecording(recording))
                  setMode('view')
                  onError(null)
                }}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    residentIds: new Set<number>(),
    socialWorker: '',
    socialWorkers: new Set<string>(),
    sessionTypes: new Set<string>(),
    durationMin: '',
    durationMax: '',
    emotionalStates: new Set<string>(),
    progress: 'all' as TriBool,
    concerns: 'all' as TriBool,
  }
}

export function ProcessRecordingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [rows, setRows] = useState<ProcessRecording[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [resSearch, setResSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [formResidentId, setFormResidentId] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  const [socialWorker, setSocialWorker] = useState('')
  const [sessionType, setSessionType] = useState<string>('Individual')
  const [duration, setDuration] = useState('')
  const [emoStart, setEmoStart] = useState('')
  const [emoEnd, setEmoEnd] = useState('')
  const [interventions, setInterventions] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [residentInput, setResidentInput] = useState('')
  const [progressNoted, setProgressNoted] = useState(true)
  const [concernsFlagged, setConcernsFlagged] = useState(false)
  const [referralMade, setReferralMade] = useState(false)
  const [sessionModal, setSessionModal] = useState<ProcessRecording | null>(null)
  const [sessionModalErr, setSessionModalErr] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, rec] = await Promise.all([getResidents({}), getProcessRecordings()])
      setResidents(r)
      setRows(rec)
      setFormResidentId((prev) => prev || r[0]?.id || 0)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    setShowNew(true)
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!showNew || residents.length === 0) return
    setFormResidentId((prev) => (prev && residents.some((r) => r.id === prev) ? prev : residents[0]?.id ?? 0))
  }, [showNew, residents])

  useEffect(() => {
    if (!showNew) return
    const resident = residents.find((r) => r.id === formResidentId)
    setResidentInput(resident ? `${resident.internalCode} (#${resident.id})` : '')
  }, [showNew, residents, formResidentId])

  const residentOptions = useMemo(
    () => residents.map((r) => ({ id: r.id, label: `${r.internalCode} (#${r.id})` })),
    [residents],
  )

  const emoOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.emotionalStateObserved)), [rows])
  const swOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.socialWorker)), [rows])
  const swSuggestionsForm = useMemo(() => {
    const base = ['SW-01', ...swOpts]
    return uniqSortedStrings(base)
  }, [swOpts])
  const typeOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.sessionType)), [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.residentInternalCode} ${r.sessionType} ${r.socialWorker} ${r.sessionNarrative}`.toLowerCase()
      if (search.trim() && !hay.includes(search.trim().toLowerCase())) return false
      if (filters.dateFrom || filters.dateTo) {
        if (!inDateRange(r.sessionDate, filters.dateFrom, filters.dateTo)) return false
      }
      if (!matchesIdMulti(r.residentId, filters.residentIds)) return false
      const swListOk = filters.socialWorkers.size === 0 || matchesStringMulti(r.socialWorker, filters.socialWorkers)
      const swTextOk =
        !filters.socialWorker.trim() ||
        r.socialWorker.toLowerCase().includes(filters.socialWorker.trim().toLowerCase())
      if (!swListOk || !swTextOk) return false
      if (!matchesStringMulti(r.sessionType, filters.sessionTypes)) return false
      if (!inAmountRange(r.sessionDurationMinutes, filters.durationMin, filters.durationMax)) return false
      if (!matchesStringMulti(r.emotionalStateObserved ?? '', filters.emotionalStates)) return false
      if (!matchesTriBool(r.progressNoted, filters.progress)) return false
      if (!matchesTriBool(r.concernsFlagged, filters.concerns)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'sessionDate':
          return row.sessionDate
        case 'residentInternalCode':
          return row.residentInternalCode
        case 'socialWorker':
          return row.socialWorker
        case 'sessionType':
          return row.sessionType
        case 'sessionDurationMinutes':
          return row.sessionDurationMinutes ?? 0
        case 'emotionalStateObserved':
          return row.emotionalStateObserved ?? ''
        case 'progressNoted':
          return row.progressNoted ? 1 : 0
        case 'concernsFlagged':
          return row.concernsFlagged ? 1 : 0
        default:
          return ''
      }
    })
    return list
  }, [rows, search, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.dateFrom || filters.dateTo) p.push('Date')
    if (filters.residentIds.size) p.push(`Residents: ${filters.residentIds.size}`)
    if (filters.socialWorker.trim() || filters.socialWorkers.size) p.push('Social worker')
    if (filters.sessionTypes.size) p.push(`Type: ${filters.sessionTypes.size}`)
    if (filters.durationMin || filters.durationMax) p.push('Duration')
    if (filters.emotionalStates.size) p.push('Emotion')
    if (filters.progress !== 'all') p.push(`Progress: ${filters.progress}`)
    if (filters.concerns !== 'all') p.push(`Concerns: ${filters.concerns}`)
    return p
  }, [filters])

  function onSort(key: string) {
    const next = nextSortState(key, sortKey, sortDir)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function toggleSelectAll() {
    const ids = filteredSorted.map((r) => r.id)
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id))
    setSelected((prev) => {
      const n = new Set(prev)
      if (allOn) for (const id of ids) n.delete(id)
      else for (const id of ids) n.add(id)
      return n
    })
  }

  function openDeleteModal() {
    if (selected.size === 0) return
    const labels = filteredSorted
      .filter((r) => selected.has(r.id))
      .map((r) => `${formatAdminDate(r.sessionDate)} · ${r.residentInternalCode}`)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteProcessRecording(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const rid = formResidentId || resolveResidentId(residentInput, residents)
    if (!rid) {
      setError('Choose a resident from the list (or type an exact code / #id).')
      return
    }
    if (!socialWorker.trim()) {
      setError('Social worker is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createProcessRecording({
        residentId: rid,
        sessionDate: `${sessionDate}T12:00:00`,
        socialWorker: socialWorker.trim(),
        sessionType,
        sessionDurationMinutes: duration ? Number(duration) : undefined,
        emotionalStateObserved: emoStart.trim() || undefined,
        emotionalStateEnd: emoEnd.trim() || undefined,
        sessionNarrative: DIRECTORY_SESSION_NARRATIVE,
        interventionsApplied: interventions.trim() || undefined,
        followUpActions: followUp.trim() || undefined,
        progressNoted,
        concernsFlagged,
        referralMade,
      })
      setInterventions('')
      setFollowUp('')
      setEmoStart('')
      setEmoEnd('')
      setProgressNoted(true)
      setConcernsFlagged(false)
      setReferralMade(false)
      setShowNew(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setShowNew(true)
    requestAnimationFrame(() => document.getElementById('admin-add-process')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const colCount = 9

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Counseling Sessions</h2>
        <p className={pageDesc}>
          Document counseling sessions, key observations, interventions used, and follow-up steps for each resident interaction.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search narrative, worker, resident…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add session"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="session"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <DateRangeFilter
            labelText="Session date"
            from={filters.dateFrom}
            to={filters.dateTo}
            onFrom={(v) => setFilters((f) => ({ ...f, dateFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, dateTo: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Resident"
            options={residentOptions}
            selectedIds={filters.residentIds}
            onChange={(s) => setFilters((f) => ({ ...f, residentIds: s }))}
            search={resSearch}
            onSearchChange={setResSearch}
          />
          <TextSearchFilter
            labelText="Social worker (text)"
            value={filters.socialWorker}
            onChange={(v) => setFilters((f) => ({ ...f, socialWorker: v }))}
          />
          <MultiSelectFilter
            labelText="Social worker (pick from list)"
            options={swOpts.length ? swOpts : ['—']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
          <MultiSelectFilter
            labelText="Session type"
            options={typeOpts.length ? typeOpts : [...sessionTypes]}
            selected={filters.sessionTypes}
            onChange={(s) => setFilters((f) => ({ ...f, sessionTypes: s }))}
          />
          <MinMaxFilter
            labelText="Duration (minutes)"
            min={filters.durationMin}
            max={filters.durationMax}
            onMin={(v) => setFilters((f) => ({ ...f, durationMin: v }))}
            onMax={(v) => setFilters((f) => ({ ...f, durationMax: v }))}
          />
          <MultiSelectFilter
            labelText="Emotional state"
            options={emoOpts.length ? emoOpts : [...emotionalStateOptions]}
            selected={filters.emotionalStates}
            onChange={(s) => setFilters((f) => ({ ...f, emotionalStates: s }))}
          />
          <TriBoolFilter labelText="Progress noted" value={filters.progress} onChange={(v) => setFilters((f) => ({ ...f, progress: v }))} />
          <TriBoolFilter labelText="Concerns flagged" value={filters.concerns} onChange={(v) => setFilters((f) => ({ ...f, concerns: v }))} />
        </FilterPanelCard>
      )}

      {showNew && (
        <form id="admin-add-process" onSubmit={onSubmit} className={`${cardForm} scroll-mt-28 space-y-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={sectionFormTitle}>New counseling session</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Session notes use a short default line unless you edit this session later in the detail view.
              </p>
            </div>
            <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowNew(false)}>
              Close
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ResidentTypeahead
              residents={residents}
              inputValue={residentInput}
              onInputChange={(v) => {
                setResidentInput(v)
                setFormResidentId(0)
              }}
              onPick={(id, lbl) => {
                setFormResidentId(id)
                setResidentInput(lbl)
              }}
              disabled={residents.length === 0}
            />
            <label className={label}>
              Session date
              <input type="date" className={input} value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
            </label>
            <div className="lg:col-span-2">
              <SocialWorkerTypeahead
                value={socialWorker}
                onChange={setSocialWorker}
                suggestions={swSuggestionsForm}
                disabled={residents.length === 0}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className={label}>
              Session type
              <select className={input} value={sessionType} onChange={(e) => setSessionType(e.target.value)}>
                {sessionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Duration (minutes)
              <input type="number" min={0} className={input} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </label>
            <label className={label}>
              Emotional state (start)
              <select className={input} value={emoStart} onChange={(e) => setEmoStart(e.target.value)}>
                <option value="">—</option>
                {emotionalStateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Emotional state (end)
              <select className={input} value={emoEnd} onChange={(e) => setEmoEnd(e.target.value)}>
                <option value="">—</option>
                {emotionalStateOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>
              Interventions applied
              <input className={input} value={interventions} onChange={(e) => setInterventions(e.target.value)} />
            </label>
            <label className={label}>
              Follow-up actions
              <input className={input} value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session flags</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Progress noted</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={progressNoted}
                  onChange={(e) => setProgressNoted(e.target.checked)}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Concerns flagged</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={concernsFlagged}
                  onChange={(e) => setConcernsFlagged(e.target.checked)}
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2.5">
                <span className="text-sm text-foreground">Referral made</span>
                <input
                  type="checkbox"
                  className={checkboxInput}
                  checked={referralMade}
                  onChange={(e) => setReferralMade(e.target.checked)}
                />
              </label>
            </div>
          </div>

          <button type="submit" disabled={saving || residents.length === 0} className={btnPrimary}>
            {saving ? 'Saving…' : 'Save session'}
          </button>
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="w-10 pl-3 pr-2 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={filteredSorted.length > 0 && filteredSorted.every((r) => selected.has(r.id))}
                  onChange={toggleSelectAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
              <SortableTh label="Session Date" sortKey="sessionDate" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Resident" sortKey="residentInternalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social Worker" sortKey="socialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Type" sortKey="sessionType" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Minutes" sortKey="sessionDurationMinutes" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Emotion" sortKey="emotionalStateObserved" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Progress" sortKey="progressNoted" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Concerns" sortKey="concernsFlagged" activeKey={sortKey} direction={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filteredSorted.length === 0 ? (
              <tr>
                <td colSpan={colCount} className={emptyCell}>
                  No sessions for this view.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() => {
                    setSessionModalErr(null)
                    setSessionModal(r)
                  }}
                >
                  <td className="pl-3 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.id}`} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.sessionDate)}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.residentInternalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.socialWorker}</td>
                  <td className="px-3 py-2.5">
                    <CategoryBadge>{r.sessionType}</CategoryBadge>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {r.sessionDurationMinutes != null ? `${r.sessionDurationMinutes} min` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.emotionalStateObserved ? <CategoryBadge>{r.emotionalStateObserved}</CategoryBadge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={r.progressNoted} />
                  </td>
                  <td className="px-3 py-2.5">
                    <BooleanBadge value={r.concernsFlagged} trueVariant="danger" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sessionModal ? (
        <CounselingSessionModal
          recording={sessionModal}
          swSuggestions={swSuggestionsForm}
          error={sessionModalErr}
          onError={setSessionModalErr}
          onClose={() => {
            setSessionModal(null)
            setSessionModalErr(null)
          }}
          onSaved={loadAll}
        />
      ) : null}

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete session?' : 'Delete sessions?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? 'You are about to delete one counseling session.'
              : `You are about to delete ${deleteModal.ids.length} counseling sessions.`
            : ''
        }
        previewLines={deleteModal && deleteModal.labels.length > 1 ? deleteModal.labels : deleteModal?.labels.slice(0, 1)}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
