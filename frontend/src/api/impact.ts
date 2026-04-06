import { apiFetch, parseJson } from './client'

export type PublicImpactSummary = {
  activeResidents: number
  safehouseCount: number
  avgEducationProgressPercent: number
  avgHealthScore: number
  donationsLastMonthPhp: number
  supporterCount: number
  reintegrationSuccessRatePercent: number
}

export type PublicImpactSnapshot = {
  id: number
  snapshotDate: string
  headline: string
  summaryText: string
  metrics: Record<string, string | undefined>
  isPublished: boolean
}

export async function getImpactSummary(): Promise<PublicImpactSummary> {
  const res = await apiFetch('/api/impact/summary')
  return parseJson<PublicImpactSummary>(res)
}

export async function getImpactSnapshots(): Promise<PublicImpactSnapshot[]> {
  const res = await apiFetch('/api/impact/snapshots')
  return parseJson<PublicImpactSnapshot[]>(res)
}
