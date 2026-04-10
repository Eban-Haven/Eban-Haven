import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  alertError,
  btnPrimary,
  card,
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
  createResident,
  deleteResident,
  getResident,
  getResidents,
  getSafehouses,
  patchResident,
  type ResidentDetail,
  type ResidentSummary,
} from '../../../api/admin'
import { AdminListToolbar } from '../shared/AdminListToolbar'
import { nextSortState, sortRows, SortableTh, type SortDirection } from '../shared/SortableTh'
import { AdminBulkActionsBar } from '../shared/adminDataTable/AdminBulkActionsBar'
import { AdminDeleteModal } from '../shared/adminDataTable/AdminDeleteModal'
import { ReintegrationBadge, RiskBadge, StatusBadge } from '../shared/adminDataTable/AdminBadges'
import {
  FilterPanelCard,
  DateRangeFilter,
  MultiSelectFilter,
  SearchableEntityMultiFilter,
  TextSearchFilter,
} from '../shared/adminDataTable/AdminFilterPrimitives'
import {
  formatAdminDate,
  inDateRange,
  matchesIdMulti,
  matchesStringMulti,
  uniqSortedStrings,
} from '../shared/adminDataTable/adminFormatters'

const caseStatuses = ['Active', 'Closed', 'Transferred'] as const
const caseCategoryOptions = [
  'Surrendered',
  'Trafficked',
  'Physical Abuse',
  'Sexual Abuse',
  'Neglect',
  'Child Labor',
  'At Risk',
] as const
const reintegrationStatuses = ['In Progress', 'Completed', 'On Hold', 'Not Started'] as const
const riskOptions = ['Low', 'Medium', 'High', 'Critical'] as const

const PICK_FOR_RECORD = new Set(['education', 'health', 'incident', 'plan'])

const pickForLabels: Record<string, string> = {
  education: 'an education record',
  health: 'a health & wellbeing record',
  incident: 'an incident report',
  plan: 'an intervention plan',
}

/** Fields that match the columns on this list page (safe PATCH to Postgres; no boolean "" payloads). */
type ResidentListPageFormState = {
  safehouse_id: string
  case_status: string
  case_category: string
  date_of_admission: string
  reintegration_status: string
  current_risk_level: string
  assigned_social_worker: string
}

function emptyFilters() {
  return {
    internalCode: '',
    safehouseIds: new Set<number>(),
    caseStatuses: new Set<string>(),
    caseCategories: new Set<string>(),
    admissionFrom: '',
    admissionTo: '',
    reintegrations: new Set<string>(),
    riskLevels: new Set<string>(),
    socialWorkers: new Set<string>(),
  }
}

function blankListPageForm(defaultSafehouseId?: number): ResidentListPageFormState {
  return {
    safehouse_id: defaultSafehouseId ? String(defaultSafehouseId) : '',
    case_status: 'Active',
    case_category: 'Surrendered',
    date_of_admission: new Date().toISOString().slice(0, 10),
    reintegration_status: '',
    current_risk_level: '',
    assigned_social_worker: '',
  }
}

function listPageFormFromResidentDetail(detail: ResidentDetail, defaultSafehouseId?: number): ResidentListPageFormState {
  const f = detail.fields
  const b = blankListPageForm(defaultSafehouseId)
  const rawSh = (f.safehouse_id ?? b.safehouse_id).toString().trim()
  const adm = (f.date_of_admission ?? '').trim().slice(0, 10)
  return {
    safehouse_id: rawSh,
    case_status: (f.case_status ?? b.case_status).trim(),
    case_category: (f.case_category ?? b.case_category).trim(),
    date_of_admission: adm || b.date_of_admission,
    reintegration_status: (f.reintegration_status ?? '').trim(),
    current_risk_level: (f.current_risk_level ?? '').trim(),
    assigned_social_worker: (f.assigned_social_worker ?? '').trim(),
  }
}

/** Only list-page columns; use null for optional clears (Postgres booleans must not receive ""). */
function patchBodyFromListPageForm(form: ResidentListPageFormState): Record<string, string | null> {
  const sh = form.safehouse_id.trim()
  if (!/^\d+$/.test(sh)) {
    throw new Error('Choose a valid safehouse.')
  }
  const adm = form.date_of_admission.trim()
  const cat = form.case_category.trim() || 'Surrendered'
  const status = form.case_status.trim()
  if (!status) {
    throw new Error('Case status is required.')
  }
  return {
    safehouse_id: sh,
    case_status: status,
    case_category: cat,
    date_of_admission: adm === '' ? null : adm,
    reintegration_status: form.reintegration_status.trim() === '' ? null : form.reintegration_status.trim(),
    current_risk_level: form.current_risk_level.trim() === '' ? null : form.current_risk_level.trim(),
    assigned_social_worker: form.assigned_social_worker.trim() === '' ? null : form.assigned_social_worker.trim(),
  }
}

function ResidentsTableEditForm({
  form,
  onChange,
  safehouses,
  submitLabel,
  saving,
  onCancel,
  internalCodeReadOnly,
}: {
  form: ResidentListPageFormState
  onChange: (field: keyof ResidentListPageFormState, value: string) => void
  safehouses: Array<{ id: number; code: string; name: string }>
  submitLabel: string
  saving: boolean
  onCancel: () => void
  /** When set (edit mode), internal code is display-only — same as the table column. */
  internalCodeReadOnly: string | null
}) {
  return (
    <div className={`${card} scroll-mt-28 space-y-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={sectionFormTitle}>{submitLabel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Only the fields shown on this table are edited here. Open the resident profile for full case details.
          </p>
        </div>
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {internalCodeReadOnly != null ? (
          <label className={label}>
            Internal Code
            <input className={input} readOnly value={internalCodeReadOnly} />
          </label>
        ) : null}
        <label className={label}>
          Safehouse
          <select
            className={input}
            value={form.safehouse_id}
            onChange={(e) => onChange('safehouse_id', e.target.value)}
            disabled={safehouses.length === 0}
          >
            {safehouses.length === 0 ? (
              <option value="">No safehouses — add one first</option>
            ) : (
              safehouses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))
            )}
          </select>
        </label>
        <label className={label}>
          Case Status
          <select className={input} value={form.case_status} onChange={(e) => onChange('case_status', e.target.value)}>
            {caseStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Case Category
          <select className={input} value={form.case_category} onChange={(e) => onChange('case_category', e.target.value)}>
            {caseCategoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Date of Admission
          <input type="date" className={input} value={form.date_of_admission} onChange={(e) => onChange('date_of_admission', e.target.value)} />
        </label>
        <label className={label}>
          Reintegration Status
          <select
            className={input}
            value={form.reintegration_status}
            onChange={(e) => onChange('reintegration_status', e.target.value)}
          >
            <option value="">—</option>
            {reintegrationStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Current Risk Level
          <select className={input} value={form.current_risk_level} onChange={(e) => onChange('current_risk_level', e.target.value)}>
            <option value="">—</option>
            {riskOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className={`${label} sm:col-span-2 lg:col-span-1`}>
          Assigned Social Worker
          <input
            className={input}
            value={form.assigned_social_worker}
            onChange={(e) => onChange('assigned_social_worker', e.target.value)}
            placeholder="e.g. SW-01"
          />
        </label>
      </div>

      <button type="submit" form="resident-profile-form" disabled={saving || safehouses.length === 0} className={btnPrimary}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </div>
  )
}

export function ResidentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<ResidentSummary[]>([])
  const [safehouses, setSafehouses] = useState<Awaited<ReturnType<typeof getSafehouses>>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null)
  const [editingResidentId, setEditingResidentId] = useState<number | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState(emptyFilters)
  const [shSearch, setShSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteModal, setDeleteModal] = useState<{ ids: number[]; labels: string[] } | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingResidentForm, setLoadingResidentForm] = useState(false)
  const [residentForm, setResidentForm] = useState<ResidentListPageFormState>(blankListPageForm())
  /** Internal code from API when editing (table row may be filtered out). */
  const [editingInternalCode, setEditingInternalCode] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [r, sh] = await Promise.all([getResidents({}), getSafehouses()])
      setRows(r)
      setSafehouses(sh)
      setResidentForm((current) => (current.safehouse_id ? current : blankListPageForm(sh[0]?.id)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const pickForParam = searchParams.get('pickFor')
  const pickFor =
    pickForParam && PICK_FOR_RECORD.has(pickForParam) ? (pickForParam as 'education' | 'health' | 'incident' | 'plan') : null

  useEffect(() => {
    if (loading || searchParams.get('new') !== '1') return
    setFormMode('add')
    setEditingResidentId(null)
    setEditingInternalCode(null)
    setResidentForm(blankListPageForm(safehouses[0]?.id))
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    requestAnimationFrame(() =>
      document.getElementById('resident-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
  }, [loading, searchParams, safehouses, setSearchParams])

  const safehouseOptions = useMemo(
    () => safehouses.map((s) => ({ id: s.id, label: `${s.name} (${s.code})` })),
    [safehouses],
  )

  const safehouseNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of safehouses) m.set(s.id, s.name)
    return m
  }, [safehouses])

  const caseStatusOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseStatus)), [rows])
  const caseCategoryOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.caseCategory)), [rows])
  const reintOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.reintegrationStatus)), [rows])
  const riskOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.currentRiskLevel)), [rows])
  const swOpts = useMemo(() => uniqSortedStrings(rows.map((r) => r.assignedSocialWorker)), [rows])

  const filteredSorted = useMemo(() => {
    let list = rows.filter((r) => {
      const hay = `${r.internalCode} ${r.caseCategory} ${r.caseStatus} ${r.safehouseName ?? ''} ${r.assignedSocialWorker ?? ''} ${r.presentAge ?? ''}`.toLowerCase()
      if (q.trim() && !hay.includes(q.trim().toLowerCase())) return false
      if (filters.internalCode.trim() && !r.internalCode.toLowerCase().includes(filters.internalCode.trim().toLowerCase())) {
        return false
      }
      if (!matchesIdMulti(r.safehouseId, filters.safehouseIds)) return false
      if (!matchesStringMulti(r.caseStatus, filters.caseStatuses)) return false
      if (!matchesStringMulti(r.caseCategory, filters.caseCategories)) return false
      if (filters.admissionFrom || filters.admissionTo) {
        if (!inDateRange(r.dateOfAdmission, filters.admissionFrom, filters.admissionTo)) return false
      }
      if (!matchesStringMulti(r.reintegrationStatus ?? '', filters.reintegrations)) return false
      if (!matchesStringMulti(r.currentRiskLevel ?? '', filters.riskLevels)) return false
      if (!matchesStringMulti(r.assignedSocialWorker ?? '', filters.socialWorkers)) return false
      return true
    })
    list = sortRows(list, sortKey, sortDir, (row, key) => {
      switch (key) {
        case 'internalCode':
          return row.internalCode
        case 'safehouseId':
          return row.safehouseId
        case 'caseStatus':
          return row.caseStatus
        case 'caseCategory':
          return row.caseCategory
        case 'dateOfAdmission':
          return row.dateOfAdmission ?? ''
        case 'reintegrationStatus':
          return row.reintegrationStatus ?? ''
        case 'currentRiskLevel':
          return row.currentRiskLevel ?? ''
        case 'assignedSocialWorker':
          return row.assignedSocialWorker ?? ''
        default:
          return ''
      }
    })
    return list
  }, [rows, q, filters, sortKey, sortDir])

  const activeSummary = useMemo(() => {
    const p: string[] = []
    if (filters.internalCode.trim()) p.push('Code')
    if (filters.safehouseIds.size) p.push(`Safehouse: ${filters.safehouseIds.size}`)
    if (filters.caseStatuses.size) p.push(`Status: ${filters.caseStatuses.size}`)
    if (filters.caseCategories.size) p.push(`Category: ${filters.caseCategories.size}`)
    if (filters.admissionFrom || filters.admissionTo) p.push('Admission range')
    if (filters.reintegrations.size) p.push(`Reintegration: ${filters.reintegrations.size}`)
    if (filters.riskLevels.size) p.push(`Risk: ${filters.riskLevels.size}`)
    if (filters.socialWorkers.size) p.push(`Social worker: ${filters.socialWorkers.size}`)
    return p
  }, [filters])

  function onSort(key: string) {
    const next = nextSortState(key, sortKey, sortDir)
    setSortKey(next.key)
    setSortDir(next.dir)
  }

  function setResidentFormField(field: keyof ResidentListPageFormState, value: string) {
    setResidentForm((current) => ({ ...current, [field]: value }))
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
    const labels = filteredSorted.filter((r) => selected.has(r.id)).map((r) => r.internalCode)
    setDeleteModal({ ids: [...selected], labels })
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setSaving(true)
    setError(null)
    try {
      for (const id of deleteModal.ids) {
        await deleteResident(id)
      }
      setSelected(new Set())
      setDeleteModal(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  function openAdd() {
    setFormMode('add')
    setEditingResidentId(null)
    setEditingInternalCode(null)
    setResidentForm(blankListPageForm(safehouses[0]?.id))
    requestAnimationFrame(() => document.getElementById('resident-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  async function openEdit(residentId: number) {
    setLoadingResidentForm(true)
    setFormMode('edit')
    setEditingResidentId(residentId)
    setError(null)
    try {
      const detail = await getResident(residentId)
      setEditingInternalCode(detail.fields.internal_code?.trim() || null)
      setResidentForm(listPageFormFromResidentDetail(detail, safehouses[0]?.id))
      requestAnimationFrame(() => document.getElementById('resident-profile-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load resident profile.')
      setFormMode(null)
      setEditingResidentId(null)
    } finally {
      setLoadingResidentForm(false)
    }
  }

  async function saveResidentProfile() {
    setSaving(true)
    setError(null)
    try {
      const patch = patchBodyFromListPageForm(residentForm)
      if (formMode === 'add') {
        const created = await createResident({
          caseStatus: patch.case_status!,
          caseCategory: patch.case_category ?? undefined,
        })
        await patchResident(created.id, patch)
      } else if (formMode === 'edit' && editingResidentId) {
        await patchResident(editingResidentId, patch)
      }
      setFormMode(null)
      setEditingResidentId(null)
      setEditingInternalCode(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const colCount = 10
  const internalCodeForForm =
    formMode === 'edit' && editingResidentId != null
      ? editingInternalCode ?? rows.find((r) => r.id === editingResidentId)?.internalCode ?? null
      : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className={pageTitle}>Residents</h2>
        <p className={pageDesc}>
          Manage resident profiles, case classifications, admission details, assigned staff, and reintegration tracking from one working list.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      {pickFor ? (
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <span className="font-medium">Add {pickForLabels[pickFor] ?? 'a record'}:</span>{' '}
          choose a resident below to open their case file — the right form will open automatically.
        </div>
      ) : null}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Search resident code, case category, worker, or safehouse…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAdd}
        addLabel="Add resident"
      />

      <AdminBulkActionsBar
        count={selected.size}
        recordLabel="resident"
        onDeleteClick={openDeleteModal}
        onClearSelection={() => setSelected(new Set())}
        disabled={saving}
      />

      {filterOpen && (
        <FilterPanelCard onClearAll={() => setFilters(emptyFilters())} activeSummary={activeSummary}>
          <TextSearchFilter
            labelText="Internal Code"
            value={filters.internalCode}
            onChange={(v) => setFilters((f) => ({ ...f, internalCode: v }))}
          />
          <SearchableEntityMultiFilter
            labelText="Safehouse"
            options={safehouseOptions}
            selectedIds={filters.safehouseIds}
            onChange={(s) => setFilters((f) => ({ ...f, safehouseIds: s }))}
            search={shSearch}
            onSearchChange={setShSearch}
          />
          <MultiSelectFilter
            labelText="Case Status"
            options={caseStatusOpts.length ? caseStatusOpts : [...caseStatuses]}
            selected={filters.caseStatuses}
            onChange={(s) => setFilters((f) => ({ ...f, caseStatuses: s }))}
          />
          <MultiSelectFilter
            labelText="Case Category"
            options={caseCategoryOpts.length ? caseCategoryOpts : [...caseCategoryOptions]}
            selected={filters.caseCategories}
            onChange={(s) => setFilters((f) => ({ ...f, caseCategories: s }))}
          />
          <DateRangeFilter
            labelText="Date of Admission"
            from={filters.admissionFrom}
            to={filters.admissionTo}
            onFrom={(v) => setFilters((f) => ({ ...f, admissionFrom: v }))}
            onTo={(v) => setFilters((f) => ({ ...f, admissionTo: v }))}
          />
          <MultiSelectFilter
            labelText="Reintegration Status"
            options={reintOpts.length ? reintOpts : [...reintegrationStatuses]}
            selected={filters.reintegrations}
            onChange={(s) => setFilters((f) => ({ ...f, reintegrations: s }))}
          />
          <MultiSelectFilter
            labelText="Current Risk Level"
            options={riskOpts.length ? riskOpts : [...riskOptions]}
            selected={filters.riskLevels}
            onChange={(s) => setFilters((f) => ({ ...f, riskLevels: s }))}
          />
          <MultiSelectFilter
            labelText="Assigned Social Worker"
            options={swOpts.length ? swOpts : ['SW-01']}
            selected={filters.socialWorkers}
            onChange={(s) => setFilters((f) => ({ ...f, socialWorkers: s }))}
          />
        </FilterPanelCard>
      )}

      {formMode && (
        <form
          id="resident-profile-form"
          onSubmit={(e) => {
            e.preventDefault()
            void saveResidentProfile()
          }}
        >
          {loadingResidentForm ? (
            <div className={card}>Loading resident profile…</div>
          ) : (
            <ResidentsTableEditForm
              form={residentForm}
              onChange={setResidentFormField}
              safehouses={safehouses}
              submitLabel={formMode === 'add' ? 'Save Resident' : 'Save Changes'}
              saving={saving}
              internalCodeReadOnly={internalCodeForForm}
              onCancel={() => {
                setFormMode(null)
                setEditingResidentId(null)
                setEditingInternalCode(null)
              }}
            />
          )}
        </form>
      )}

      <div className={tableWrap}>
        <table className="w-full text-left text-sm">
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
              <SortableTh label="Internal Code" sortKey="internalCode" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Safehouse" sortKey="safehouseId" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Case Status" sortKey="caseStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Case Category" sortKey="caseCategory" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Admission" sortKey="dateOfAdmission" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Reintegration" sortKey="reintegrationStatus" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Current Risk Level" sortKey="currentRiskLevel" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <SortableTh label="Social Worker" sortKey="assignedSocialWorker" activeKey={sortKey} direction={sortDir} onSort={onSort} />
              <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Edit</th>
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
                  No rows match filters.
                </td>
              </tr>
            ) : (
              filteredSorted.map((r) => (
                <tr
                  key={r.id}
                  className={`${tableRowHover} cursor-pointer`}
                  onClick={() =>
                    navigate(pickFor ? `/admin/residents/${r.id}?add=${pickFor}` : `/admin/residents/${r.id}`)
                  }
                >
                  <td className="pl-3 pr-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label={`Select ${r.internalCode}`} />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground">{r.internalCode}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.safehouseName ?? safehouseNameById.get(r.safehouseId) ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={r.caseStatus} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.caseCategory}</td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{formatAdminDate(r.dateOfAdmission)}</td>
                  <td className="px-3 py-2.5">
                    {r.reintegrationStatus ? <ReintegrationBadge value={r.reintegrationStatus} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.currentRiskLevel ? <RiskBadge level={r.currentRiskLevel} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.assignedSocialWorker ?? '—'}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => void openEdit(r.id)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminDeleteModal
        open={deleteModal != null}
        title={deleteModal && deleteModal.ids.length === 1 ? 'Delete resident?' : 'Delete residents?'}
        body={
          deleteModal
            ? deleteModal.ids.length === 1
              ? `You are about to delete resident “${deleteModal.labels[0] ?? deleteModal.ids[0]}”. Related records may block this.`
              : `You are about to delete ${deleteModal.ids.length} resident records. Related data may block some deletes.`
            : ''
        }
        previewLines={deleteModal && deleteModal.ids.length > 1 ? deleteModal.labels : undefined}
        loading={saving}
        onCancel={() => setDeleteModal(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
