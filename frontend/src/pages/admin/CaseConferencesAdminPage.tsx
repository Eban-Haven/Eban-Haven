import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
} from './adminStyles'
import {
  createInterventionPlan,
  getInterventionPlans,
  getResidents,
  type InterventionPlan,
  type ResidentSummary,
} from '../../api/admin'
import { useSupabaseForLighthouseData } from '../../lib/useSupabaseLighthouse'
import { AdminListToolbar } from './AdminListToolbar'
import { scrollToAddForm } from './scrollToAdd'

const PLAN_STATUSES = ['In Progress', 'On Hold', 'Achieved', 'Not Achieved'] as const

export function CaseConferencesAdminPage() {
  const sbData = useSupabaseForLighthouseData()
  const [residents, setResidents] = useState<ResidentSummary[]>([])
  const [filterRes, setFilterRes] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [q, setQ] = useState('')
  const [plans, setPlans] = useState<InterventionPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newResidentId, setNewResidentId] = useState(0)
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newServices, setNewServices] = useState('')
  const [newTargetVal, setNewTargetVal] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')
  const [newStatus, setNewStatus] = useState<string>(PLAN_STATUSES[0])
  const [newConfDate, setNewConfDate] = useState('')

  const addFirstFieldRef = useRef<HTMLSelectElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getResidents({})
      setResidents(res)
      const rid = filterRes || undefined
      const p = await getInterventionPlans(rid)
      setPlans(p)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterRes])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!showAddPlan) return
    setNewResidentId((prev) => {
      if (prev && residents.some((r) => r.id === prev)) return prev
      if (filterRes && residents.some((r) => r.id === filterRes)) return filterRes
      return residents[0]?.id ?? 0
    })
  }, [showAddPlan, residents, filterRes])

  const statusOptions = [...new Set(plans.map((p) => p.status).filter(Boolean))].sort()

  const needle = q.trim().toLowerCase()
  const filtered = plans.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false
    if (categoryFilter.trim() && !p.planCategory.toLowerCase().includes(categoryFilter.trim().toLowerCase())) return false
    if (needle) {
      const hay = `${p.residentInternalCode} ${p.planCategory} ${p.planDescription} ${p.servicesProvided ?? ''} ${p.status}`.toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const upcomingPlans = [...plans]
    .filter((p) => p.caseConferenceDate)
    .sort((a, b) => (a.caseConferenceDate ?? '').localeCompare(b.caseConferenceDate ?? ''))
    .slice(0, 40)

  async function onCreatePlan(e: FormEvent) {
    e.preventDefault()
    if (!sbData || !newResidentId || !newCategory.trim() || !newDescription.trim()) return
    const tv = newTargetVal.trim() ? parseFloat(newTargetVal) : null
    setSaving(true)
    setError(null)
    try {
      await createInterventionPlan({
        residentId: newResidentId,
        planCategory: newCategory.trim(),
        planDescription: newDescription.trim(),
        servicesProvided: newServices.trim() || undefined,
        targetValue: tv != null && Number.isFinite(tv) ? tv : null,
        targetDate: newTargetDate.trim() || null,
        status: newStatus,
        caseConferenceDate: newConfDate.trim() || null,
      })
      setNewCategory('')
      setNewDescription('')
      setNewServices('')
      setNewTargetVal('')
      setNewTargetDate('')
      setNewConfDate('')
      setNewStatus(PLAN_STATUSES[0])
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  function openAddPlan() {
    setShowAddPlan(true)
    scrollToAddForm('admin-add-intervention-plan', addFirstFieldRef.current)
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className={pageTitle}>Case conferences</h2>
        <p className={pageDesc}>
          Intervention plans and scheduled case conference dates. Use <strong>Add plan</strong> to create a plan tied to a
          resident; filter and search the list or open a resident from a row.
        </p>
      </div>

      {error && <div className={alertError}>{error}</div>}

      <AdminListToolbar
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder="Plan category, services, resident code…"
        filterOpen={filterOpen}
        onFilterToggle={() => setFilterOpen((o) => !o)}
        onAddClick={openAddPlan}
        addLabel="Add plan"
      />

      {filterOpen && (
        <div className={`${card} flex flex-wrap items-end gap-3`}>
          <label className={label}>
            Resident (loads plans)
            <select
              className={`${input} min-w-[12rem]`}
              value={filterRes || ''}
              onChange={(e) => setFilterRes(Number(e.target.value))}
            >
              <option value={0}>All residents</option>
              {residents.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.internalCode}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Plan status
            <select className={input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Category contains
            <input
              className={input}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="e.g. Education"
            />
          </label>
        </div>
      )}

      {showAddPlan && (
        <div id="admin-add-intervention-plan" className={`${card} scroll-mt-28 space-y-4`}>
          <p className={sectionFormTitle}>New intervention plan</p>
          {!sbData ? (
            <p className="text-sm text-muted-foreground">
              Creating plans requires Supabase program data. Set <code className="rounded bg-muted px-1">VITE_USE_SUPABASE_DATA=true</code> and
              apply lighthouse migrations, then reload.
            </p>
          ) : (
            <form onSubmit={onCreatePlan} className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Resident *
                <select
                  ref={addFirstFieldRef}
                  className={input}
                  value={newResidentId || ''}
                  onChange={(e) => setNewResidentId(Number(e.target.value))}
                  required
                >
                  {residents.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.internalCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Plan status *
                <select className={input} value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                  {PLAN_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`${label} sm:col-span-2`}>
                Plan category *
                <input
                  className={input}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Education, Safety"
                  required
                />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Plan description *
                <textarea
                  className={input}
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                />
              </label>
              <label className={`${label} sm:col-span-2`}>
                Services provided
                <input
                  className={input}
                  value={newServices}
                  onChange={(e) => setNewServices(e.target.value)}
                  placeholder="Optional, comma-separated"
                />
              </label>
              <label className={label}>
                Case conference date
                <input type="date" className={input} value={newConfDate} onChange={(e) => setNewConfDate(e.target.value)} />
              </label>
              <label className={label}>
                Target date
                <input type="date" className={input} value={newTargetDate} onChange={(e) => setNewTargetDate(e.target.value)} />
              </label>
              <label className={label}>
                Target value (numeric)
                <input className={input} value={newTargetVal} onChange={(e) => setNewTargetVal(e.target.value)} placeholder="Optional" />
              </label>
              <div className="flex items-end">
                <button type="submit" disabled={saving} className={btnPrimary}>
                  {saving ? 'Saving…' : 'Save plan'}
                </button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setShowUpcoming((s) => !s)}>
              {showUpcoming ? 'Hide scheduled conferences' : 'Show scheduled conferences'}
            </button>
          </div>
          {showUpcoming && (
            <div id="admin-case-upcoming">
              <h3 className="text-sm font-semibold text-foreground">Upcoming / recent case conferences</h3>
              <p className="mt-1 text-xs text-muted-foreground">Plans with a scheduled conference date (current list filter).</p>
              <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
                {upcomingPlans.length === 0 ? (
                  <li className="text-muted-foreground">No plans with conference dates in current filter.</li>
                ) : (
                  upcomingPlans.map((p) => (
                    <li key={p.id} className="border-b border-border/60 pb-2">
                      <Link className="font-medium text-primary hover:underline" to={`/admin/residents/${p.residentId}`}>
                        {p.residentInternalCode}
                      </Link>
                      <span className="text-foreground"> · {p.planCategory}</span>
                      <span className="ml-2 text-muted-foreground">
                        {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'} · {p.status}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className={tableWrap}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className={tableHead}>
            <tr>
              <th className="px-4 py-3">Resident</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Conference</th>
              <th className="px-4 py-3">Services</th>
            </tr>
          </thead>
          <tbody className={tableBody}>
            {loading ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className={emptyCell}>
                  No plans match.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className={tableRowHover}>
                  <td className="px-4 py-3 font-medium">
                    <Link className="text-primary hover:underline" to={`/admin/residents/${p.residentId}`}>
                      {p.residentInternalCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.planCategory}</td>
                  <td className="px-4 py-3">{p.status}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.caseConferenceDate ? new Date(p.caseConferenceDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={p.servicesProvided ?? ''}>
                    {p.servicesProvided ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
