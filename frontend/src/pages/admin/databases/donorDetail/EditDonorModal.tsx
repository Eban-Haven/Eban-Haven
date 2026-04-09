import type { Supporter } from '../../../../api/adminTypes'
import { btnPrimary, card, input, label, sectionFormTitle } from '../../shared/adminStyles'
import { supporterTypeOptions } from './donorDetailConstants'

function typeSelectOptions(current: string) {
  const set = new Set<string>(supporterTypeOptions)
  if (current && !set.has(current)) set.add(current)
  return [...set].sort((a, b) => a.localeCompare(b))
}

type Props = {
  edit: Supporter
  setEdit: (s: Supporter) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}

export function EditDonorModal({ edit, setEdit, saving, onSave, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className={`${card} max-h-[90vh] w-full max-w-2xl overflow-y-auto`}>
        <p className={sectionFormTitle}>Edit donor profile</p>
        <p className="mt-1 text-xs text-muted-foreground">
          All fields below map to supporter columns in the database. First donation date is read-only from records.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={`${label} sm:col-span-2`}>
            Display name
            <input
              className={input}
              value={edit.displayName}
              onChange={(e) => setEdit({ ...edit, displayName: e.target.value })}
            />
          </label>
          <label className={label}>
            Supporter type
            <select
              className={input}
              value={edit.supporterType}
              onChange={(e) => setEdit({ ...edit, supporterType: e.target.value })}
            >
              {typeSelectOptions(edit.supporterType).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Status
            <input className={input} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            Email
            <input
              className={input}
              value={edit.email ?? ''}
              onChange={(e) => setEdit({ ...edit, email: e.target.value })}
            />
          </label>
          <label className={label}>
            Phone
            <input
              className={input}
              value={edit.phone ?? ''}
              onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
            />
          </label>
          <label className={label}>
            Organization
            <input
              className={input}
              value={edit.organizationName ?? ''}
              onChange={(e) => setEdit({ ...edit, organizationName: e.target.value })}
            />
          </label>
          <label className={label}>
            First name
            <input
              className={input}
              value={edit.firstName ?? ''}
              onChange={(e) => setEdit({ ...edit, firstName: e.target.value })}
            />
          </label>
          <label className={label}>
            Last name
            <input
              className={input}
              value={edit.lastName ?? ''}
              onChange={(e) => setEdit({ ...edit, lastName: e.target.value })}
            />
          </label>
          <label className={label}>
            Relationship
            <input
              className={input}
              value={edit.relationshipType ?? ''}
              onChange={(e) => setEdit({ ...edit, relationshipType: e.target.value })}
            />
          </label>
          <label className={label}>
            Acquisition channel
            <input
              className={input}
              value={edit.acquisitionChannel ?? ''}
              onChange={(e) => setEdit({ ...edit, acquisitionChannel: e.target.value })}
            />
          </label>
          <label className={label}>
            Region
            <input
              className={input}
              value={edit.region ?? ''}
              onChange={(e) => setEdit({ ...edit, region: e.target.value })}
            />
          </label>
          <label className={label}>
            Country
            <input
              className={input}
              value={edit.country ?? ''}
              onChange={(e) => setEdit({ ...edit, country: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
