import { apiFetch, parseJson } from './client'

const base = '/api/admin'

export type DashboardSummary = {
  activeResidentsTotal: number
  safehouses: SafehouseOccupancy[]
  recentDonations: RecentDonationRow[]
  upcomingCaseConferences: UpcomingConference[]
  monetaryDonationsLast30DaysPhp: number
  processRecordingsCount: number
  homeVisitationsLast90Days: number
  reintegration: { completedCount: number; inProgressCount: number; successRatePercent: number }
}

export type SafehouseOccupancy = {
  id: number
  code: string
  name: string
  region: string
  occupancy: number
  capacity: number
}

export type RecentDonationRow = {
  donationId: number
  supporterDisplayName: string
  donationType: string
  amount: number | null
  currencyCode: string | null
  donationDate: string
  campaignName: string | null
}

export type UpcomingConference = {
  planId: number
  residentId: number
  residentInternalCode: string
  planCategory: string
  caseConferenceDate: string | null
  status: string
  planDescription: string | null
}

export type Case = {
  id: string
  referenceCode: string
  status: string
  opened: string
  summary: string | null
}

export type ResidentSummary = {
  id: number
  caseControlNo: string
  internalCode: string
  safehouseId: number
  safehouseName: string | null
  caseStatus: string
  caseCategory: string
  sex: string
  assignedSocialWorker: string | null
  dateOfAdmission: string | null
  reintegrationStatus: string | null
  reintegrationType: string | null
}

export type ResidentDetail = { id: number; fields: Record<string, string> }

export type Supporter = {
  id: number
  supporterType: string
  displayName: string
  organizationName: string | null
  firstName: string | null
  lastName: string | null
  region: string | null
  country: string | null
  email: string | null
  phone: string | null
  status: string
  firstDonationDate: string | null
  acquisitionChannel: string | null
}

export type Donation = {
  id: number
  supporterId: number
  supporterDisplayName: string
  donationType: string
  donationDate: string
  isRecurring: boolean
  campaignName: string | null
  channelSource: string | null
  currencyCode: string | null
  amount: number | null
  estimatedValue: number | null
  impactUnit: string | null
  notes: string | null
}

export type DonationAllocation = {
  id: number
  donationId: number
  safehouseId: number
  safehouseName: string | null
  programArea: string
  amountAllocated: number
  allocationDate: string
  notes: string | null
}

export type SafehouseOption = { id: number; code: string; name: string; region: string }

export type ProcessRecording = {
  id: number
  residentId: number
  residentInternalCode: string
  sessionDate: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes: number | null
  emotionalStateObserved: string | null
  emotionalStateEnd: string | null
  sessionNarrative: string
  interventionsApplied: string | null
  followUpActions: string | null
  progressNoted: boolean
  concernsFlagged: boolean
  referralMade: boolean
}

export type HomeVisitation = {
  id: number
  residentId: number
  residentInternalCode: string
  visitDate: string
  socialWorker: string
  visitType: string
  locationVisited: string | null
  familyMembersPresent: string | null
  purpose: string | null
  observations: string | null
  familyCooperationLevel: string | null
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes: string | null
  visitOutcome: string | null
}

export type InterventionPlan = {
  id: number
  residentId: number
  residentInternalCode: string
  planCategory: string
  planDescription: string
  servicesProvided: string | null
  targetValue: number | null
  targetDate: string | null
  status: string
  caseConferenceDate: string | null
  createdAt: string
  updatedAt: string
}

export type ReportsSummary = {
  totalResidents: number
  activeResidents: number
  closedResidents: number
  totalMonetaryDonationsPhp: number
  processRecordingsCount: number
  donationTrends: { month: string; monetaryTotalPhp: number; donationCount: number }[]
  safehousePerformance: SafehousePerformance[]
  outcomeMetrics: {
    avgEducationProgressPercent: number
    avgHealthScore: number
    educationRecordsCount: number
    healthRecordsCount: number
  }
  annualAccomplishmentStyle: {
    beneficiaryResidentsServed: number
    servicesProvided: { caringSessions: number; healingSessions: number; teachingSessions: number }
    programOutcomeHighlights: string[]
  }
}

export type SafehousePerformance = {
  safehouseId: number
  name: string
  activeResidents: number
  capacity: number
  occupancyRatePercent: number
  avgEducationProgress: number | null
  avgHealthScore: number | null
}

export async function getDashboard(): Promise<DashboardSummary> {
  return parseJson<DashboardSummary>(await apiFetch(`${base}/dashboard`))
}

export async function getSafehouses(): Promise<SafehouseOption[]> {
  return parseJson<SafehouseOption[]>(await apiFetch(`${base}/safehouses`))
}

export async function getSupporters(): Promise<Supporter[]> {
  return parseJson<Supporter[]>(await apiFetch(`${base}/supporters`))
}

export async function createSupporter(body: {
  supporterType: string
  displayName: string
  email?: string
  region?: string
  status?: string
}): Promise<Supporter> {
  return parseJson<Supporter>(
    await apiFetch(`${base}/supporters`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function patchSupporter(
  id: number,
  body: { status?: string; supporterType?: string },
): Promise<Supporter> {
  return parseJson<Supporter>(
    await apiFetch(`${base}/supporters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  )
}

export async function getDonations(supporterId?: number): Promise<Donation[]> {
  const q = supporterId != null ? `?supporterId=${supporterId}` : ''
  return parseJson<Donation[]>(await apiFetch(`${base}/donations${q}`))
}

export async function createDonation(body: {
  supporterId: number
  donationType: string
  donationDate?: string
  amount?: number
  currencyCode?: string
  notes?: string
  campaignName?: string
}): Promise<Donation> {
  return parseJson<Donation>(
    await apiFetch(`${base}/donations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getAllocations(params?: {
  donationId?: number
  safehouseId?: number
}): Promise<DonationAllocation[]> {
  const sp = new URLSearchParams()
  if (params?.donationId != null) sp.set('donationId', String(params.donationId))
  if (params?.safehouseId != null) sp.set('safehouseId', String(params.safehouseId))
  const q = sp.toString() ? `?${sp}` : ''
  return parseJson<DonationAllocation[]>(await apiFetch(`${base}/donation-allocations${q}`))
}

export async function getResidents(params: {
  status?: string
  safehouseId?: number
  category?: string
  q?: string
}): Promise<ResidentSummary[]> {
  const sp = new URLSearchParams()
  if (params.status) sp.set('status', params.status)
  if (params.safehouseId != null) sp.set('safehouseId', String(params.safehouseId))
  if (params.category) sp.set('category', params.category)
  if (params.q) sp.set('q', params.q)
  const q = sp.toString() ? `?${sp}` : ''
  return parseJson<ResidentSummary[]>(await apiFetch(`${base}/residents${q}`))
}

export async function getResident(id: number): Promise<ResidentDetail> {
  return parseJson<ResidentDetail>(await apiFetch(`${base}/residents/${id}`))
}

export async function patchResident(id: number, fields: Record<string, string | null>): Promise<ResidentDetail> {
  return parseJson<ResidentDetail>(
    await apiFetch(`${base}/residents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    }),
  )
}

export async function createResident(body: {
  internalCode: string
  caseStatus: string
  caseCategory?: string
}): Promise<ResidentSummary> {
  return parseJson<ResidentSummary>(
    await apiFetch(`${base}/residents`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

/** Legacy alias — same as resident id */
export async function getCases(): Promise<Case[]> {
  return parseJson<Case[]>(await apiFetch(`${base}/cases`))
}

export async function updateCaseStatus(caseId: string, status: string): Promise<Case> {
  return parseJson<Case>(
    await apiFetch(`${base}/cases/${caseId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  )
}

export async function getProcessRecordings(residentId?: number): Promise<ProcessRecording[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<ProcessRecording[]>(await apiFetch(`${base}/process-recordings${q}`))
}

export async function createProcessRecording(body: {
  residentId: number
  sessionDate?: string
  socialWorker: string
  sessionType: string
  sessionDurationMinutes?: number
  emotionalStateObserved?: string
  emotionalStateEnd?: string
  sessionNarrative: string
  interventionsApplied?: string
  followUpActions?: string
}): Promise<ProcessRecording> {
  return parseJson<ProcessRecording>(
    await apiFetch(`${base}/process-recordings`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getHomeVisitations(residentId?: number): Promise<HomeVisitation[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<HomeVisitation[]>(await apiFetch(`${base}/home-visitations${q}`))
}

export async function createHomeVisitation(body: {
  residentId: number
  visitDate?: string
  socialWorker: string
  visitType: string
  locationVisited?: string
  observations?: string
  familyCooperationLevel?: string
  safetyConcernsNoted: boolean
  followUpNeeded: boolean
  followUpNotes?: string
}): Promise<HomeVisitation> {
  return parseJson<HomeVisitation>(
    await apiFetch(`${base}/home-visitations`, { method: 'POST', body: JSON.stringify(body) }),
  )
}

export async function getInterventionPlans(residentId?: number): Promise<InterventionPlan[]> {
  const q = residentId != null ? `?residentId=${residentId}` : ''
  return parseJson<InterventionPlan[]>(await apiFetch(`${base}/intervention-plans${q}`))
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  return parseJson<ReportsSummary>(await apiFetch(`${base}/reports/summary`))
}
