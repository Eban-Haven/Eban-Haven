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

/** Monthly cumulative residents with date_enrolled on or before month-end; series begins Jan 2023. */
export type EnrollmentGrowthPoint = {
  month: string
  period: string
  cumulativeResidents: number
}

export async function getImpactEnrollmentGrowth(): Promise<EnrollmentGrowthPoint[]> {
  const res = await apiFetch('/api/impact/enrollment-growth')
  return parseJson<EnrollmentGrowthPoint[]>(res)
}
