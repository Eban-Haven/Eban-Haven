import { apiFetch, parseJson } from './client'
import type { Donation, DonationAllocation, Supporter } from './adminTypes'

export type DonorAccountData = {
  email: string
  fullName: string | null
  supporter: Supporter | null
}

export type DonorAccountPatch = {
  fullName?: string | null
  displayName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  region?: string | null
  country?: string | null
  organizationName?: string | null
}

export type DonorDashboardData = {
  email: string
  supporter: Supporter | null
  donations: Donation[]
  allocations: DonationAllocation[]
  designationOptions: string[]
}

export async function getDonorDashboard(): Promise<DonorDashboardData> {
  return parseJson<DonorDashboardData>(await apiFetch('/api/donor/dashboard'))
}

export async function getDonorAccount(): Promise<DonorAccountData> {
  return parseJson<DonorAccountData>(await apiFetch('/api/donor/account'))
}

export async function patchDonorAccount(body: DonorAccountPatch): Promise<DonorAccountData> {
  return parseJson<DonorAccountData>(
    await apiFetch('/api/donor/account', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  )
}

export async function createMyDonation(body: {
  donationType: string
  donationDate?: string
  amount?: number
  currencyCode?: string
  notes?: string
  campaignName?: string
}): Promise<Donation> {
  return parseJson(
    await apiFetch('/api/donor/donations', {
      method: 'POST',
      body: JSON.stringify({
        donationType: body.donationType,
        donationDate: body.donationDate,
        amount: body.amount,
        currencyCode: body.currencyCode,
        notes: body.notes,
        campaignName: body.campaignName,
      }),
    }),
  )
}
