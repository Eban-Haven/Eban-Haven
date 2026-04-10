import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { ChevronDown, Filter, X } from 'lucide-react'
import { formatAdminDate } from '../adminDataTable/adminFormatters'
import { btnPrimary, input, label } from '../adminStyles'
import { RESIDENT_SEMANTIC } from '../residentSemanticPalette'
import { CaseDrawer } from './caseUi'
import type { TimelineItem, TimelineKind } from './caseWorkspaceModel'

export const ALL_TIMELINE_KINDS: TimelineKind[] = ['process', 'visit', 'incident', 'education', 'health', 'plan']

const KIND_LABELS: Record<TimelineKind, string> = {
  process: 'Session',
  visit: 'Visit',
  incident: 'Incident',
  education: 'Education',
  health: 'Health',
  plan: 'Plan',
}

function toneChipClass(tone: 'danger' | 'warning' | 'default' | 'success') {
  if (tone === 'danger') return RESIDENT_SEMANTIC.danger.chip
  if (tone === 'warning') return RESIDENT_SEMANTIC.warning.chip
  if (tone === 'success') return RESIDENT_SEMANTIC.success.chip
  return 'border border-[#D1D5DB] bg-[#F3F4F6] text-[#4B5563]'
}

export type ActivityAdvFilterDraft = {
  dateFrom: string
  dateTo: string
  worker: string
  kinds: Set<TimelineKind>
  followOnly: boolean
  flaggedOnly: boolean
}

export function emptyActivityAdvDraft(): ActivityAdvFilterDraft {
  return {
    dateFrom: '',
    dateTo: '',
    worker: '',
    kinds: new Set<TimelineKind>(ALL_TIMELINE_KINDS),
    followOnly: false,
    flaggedOnly: false,
  }
}

export function draftFromApplied(
  dateFrom: string,
  dateTo: string,
  worker: string,
  kinds: Set<TimelineKind>,
  followOnly: boolean,
  flaggedOnly: boolean,
): ActivityAdvFilterDraft {
  return {
    dateFrom,
    dateTo,
    worker,
    kinds: new Set(kinds),
    followOnly,
    flaggedOnly,
  }
}

function setsEqualKinds(a: Set<TimelineKind>, b: Set<TimelineKind>) {
  if (a.size !== b.size) return false
  for (const k of a) {
    if (!b.has(k)) return false
  }
  return true
}

export function activityAdvFiltersAreDefault(d: ActivityAdvFilterDraft) {
  const empty = emptyActivityAdvDraft()
  return (
    !d.dateFrom &&
    !d.dateTo &&
    !d.worker.trim() &&
    setsEqualKinds(d.kinds, empty.kinds) &&
    !d.followOnly &&
    !d.flaggedOnly
  )
}

/** Non-null label when the set is a strict subset of all record types (for active-filter chips). */
export function typesFilterChipLabel(kinds: Set<TimelineKind>): string | null {
  if (kinds.size === 0 || kinds.size >= ALL_TIMELINE_KINDS.length) return null
  const labels = ALL_TIMELINE_KINDS.filter((k) => kinds.has(k)).map((k) => KIND_LABELS[k])
  return labels.length ? `Types: ${labels.join(', ')}` : null
}

export function normalizeKindsForApply(kinds: Set<TimelineKind>): Set<TimelineKind> {
  if (kinds.size === 0) return new Set(ALL_TIMELINE_KINDS)
  return new Set(kinds)
}

export type ActivityFilterChip = {
  id: string
  label: string
}

type ActivityToolbarProps = {
  search: string
  onSearchChange: (v: string) => void
  onOpenFilters: () => void
  filtersActive: boolean
  addMenuOpen: boolean
  onToggleAddMenu: () => void
  onAddPick: (id: 'counseling' | 'visit' | 'incident' | 'health' | 'education' | 'plan') => void
  addOptions: { id: 'counseling' | 'visit' | 'incident' | 'health' | 'education' | 'plan'; label: string }[]
}

export function ActivityTabToolbar({
  search,
  onSearchChange,
  onOpenFilters,
  filtersActive,
  addMenuOpen,
  onToggleAddMenu,
  onAddPick,
  addOptions,
}: ActivityToolbarProps) {
  const addRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!addMenuOpen) return
    function onDocClick(e: globalThis.MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) {
        onToggleAddMenu()
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [addMenuOpen, onToggleAddMenu])

  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
      <div className="min-w-0 shrink-0">
        <h3 className="text-base font-semibold text-foreground">Activity</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">All records in one timeline</p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2 lg:max-w-3xl">
        <label className="min-w-0 w-full sm:flex-1 sm:max-w-md">
          <span className="sr-only">Search activity</span>
          <input
            type="search"
            className={input}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search activity"
            aria-label="Search activity"
          />
        </label>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilters}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              filtersActive
                ? 'border-primary/50 bg-primary/5 text-foreground'
                : 'border-border text-foreground hover:bg-muted/50'
            }`}
          >
            <Filter className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            Filters
          </button>

          <div className="relative" ref={addRef}>
            <button
              type="button"
              onClick={onToggleAddMenu}
              className={`${btnPrimary} inline-flex items-center gap-1.5`}
              aria-expanded={addMenuOpen}
              aria-haspopup="menu"
            >
              Add record
              <ChevronDown className={`h-4 w-4 transition-transform ${addMenuOpen ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {addMenuOpen ? (
              <div
                className="absolute right-0 z-40 mt-2 min-w-[14rem] rounded-xl border border-border bg-card py-1 shadow-lg"
                role="menu"
              >
                {addOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted/60"
                    onClick={() => onAddPick(opt.id)}
                  >
                    {opt.label}
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

type ActivityFilterChipsProps = {
  chips: ActivityFilterChip[]
  onRemove: (id: string) => void
}

export function ActivityActiveFilterChips({ chips, onRemove }: ActivityFilterChipsProps) {
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Showing</span>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onRemove(c.id)}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/70"
        >
          <span className="truncate">{c.label}</span>
          <X className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
    </div>
  )
}

type ActivityAdvancedFiltersDrawerProps = {
  open: boolean
  onClose: () => void
  draft: ActivityAdvFilterDraft
  setDraft: Dispatch<SetStateAction<ActivityAdvFilterDraft>>
  keywordSearch: string
  onKeywordSearchChange: (v: string) => void
  onApply: () => void
  onClearDraft: () => void
}

export function ActivityAdvancedFiltersDrawer({
  open,
  onClose,
  draft,
  setDraft,
  keywordSearch,
  onKeywordSearchChange,
  onApply,
  onClearDraft,
}: ActivityAdvancedFiltersDrawerProps) {
  if (!open) return null

  function toggleKind(kind: TimelineKind) {
    setDraft((prev) => {
      const next = new Set(prev.kinds)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return { ...prev, kinds: next }
    })
  }

  return (
    <CaseDrawer
      title="Filter activity"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClearDraft}
          >
            Clear all
          </button>
          <button type="button" className={btnPrimary} onClick={onApply}>
            Apply filters
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            From date
            <input
              type="date"
              className={input}
              value={draft.dateFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
            />
          </label>
          <label className={label}>
            To date
            <input
              type="date"
              className={input}
              value={draft.dateTo}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
            />
          </label>
        </div>

        <label className={label}>
          Worker
          <input
            className={input}
            value={draft.worker}
            onChange={(e) => setDraft((d) => ({ ...d, worker: e.target.value }))}
            placeholder="Name or ID"
          />
        </label>

        <label className={label}>
          Keyword
          <p className="mb-1.5 text-xs font-normal text-muted-foreground">Matches title, summary, and worker (same as toolbar search).</p>
          <input
            className={input}
            value={keywordSearch}
            onChange={(e) => onKeywordSearchChange(e.target.value)}
            placeholder="Narrow the list…"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className={`${label} mb-2 block`}>Record types</legend>
          <div className="flex flex-wrap gap-2">
            {ALL_TIMELINE_KINDS.map((kind) => (
              <label
                key={kind}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  draft.kinds.has(kind) ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'
                }`}
              >
                <input type="checkbox" checked={draft.kinds.has(kind)} onChange={() => toggleKind(kind)} />
                {KIND_LABELS[kind]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={draft.followOnly}
              onChange={(e) => setDraft((d) => ({ ...d, followOnly: e.target.checked }))}
            />
            Follow-up only
          </label>
          <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
            <input
              type="checkbox"
              checked={draft.flaggedOnly}
              onChange={(e) => setDraft((d) => ({ ...d, flaggedOnly: e.target.checked }))}
            />
            Flagged only
          </label>
        </div>
      </div>
    </CaseDrawer>
  )
}

const rowActionBtn =
  'rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors'
const rowDeleteBtn = `${RESIDENT_SEMANTIC.danger.outlineButton} transition-colors`

export function ActivityTimelineRow({
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

  function stop(e: { stopPropagation: () => void }) {
    e.stopPropagation()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(item)
        }
      }}
      className="rounded-xl border border-border bg-card text-left shadow-sm outline-none transition-colors hover:border-border hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">{item.title}</span>
            <span className="text-sm tabular-nums text-muted-foreground">{formatAdminDate(item.dateIso)}</span>
            {item.worker ? <span className="text-sm text-muted-foreground">· {item.worker}</span> : null}
          </div>
          <p className="text-sm font-medium leading-snug text-foreground">{item.summary}</p>
          {item.flags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {item.flags.map((flag) => (
                <span key={flag.label} className={`rounded-full px-2 py-0.5 text-xs font-medium ${toneChipClass(flag.tone)}`}>
                  {flag.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
          onClick={stop}
        >
          <button type="button" className={rowActionBtn} onClick={(e) => { stop(e); onOpen(item) }}>
            View
          </button>
          <button type="button" className={rowActionBtn} onClick={(e) => { stop(e); onEdit(item) }}>
            {editLabel}
          </button>
          {canDelete ? (
            <button type="button" className={rowDeleteBtn} onClick={(e) => { stop(e); onDelete(item) }}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
