import { useParams, useSearchParams } from 'react-router-dom'
import {
  ResidentCaseWorkspace,
  type ResidentWorkspaceQuickAdd,
} from '../shared/residentCase/ResidentCaseWorkspace'

const QUICK_ADD = new Set<string>(['education', 'health', 'incident', 'plan'])

export function ResidentDetailPage() {
  const { id: idParam } = useParams()
  const [searchParams] = useSearchParams()
  const id = Number(idParam)
  const raw = searchParams.get('add')
  const initialQuickAdd: ResidentWorkspaceQuickAdd | null =
    raw && QUICK_ADD.has(raw) ? (raw as ResidentWorkspaceQuickAdd) : null
  return <ResidentCaseWorkspace residentId={id} initialQuickAdd={initialQuickAdd} />
}
