import { apiFetch, parseJson } from './client'
<<<<<<< HEAD
import type { Donation, Supporter } from './adminTypes'

export async function getDonorMe(): Promise<{ email: string; supporter: Supporter | null }> {
  return parseJson(await apiFetch('/api/donor/me'))
}

export async function getMyDonations(): Promise<Donation[]> {
  return parseJson(await apiFetch('/api/donor/donations'))
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

=======
import type { Donation, DonationAllocation, Supporter } from './adminTypes'

export type DonorDashboardData = {
  email: string
  supporter: Supporter | null
  donations: Donation[]
  allocations: DonationAllocation[]
}

export async function getDonorDashboard(): Promise<DonorDashboardData> {
  return parseJson<DonorDashboardData>(await apiFetch('/api/donor/dashboard'))
}
>>>>>>> b29e9ebb297716d93237ecb2c090677a5f55d6d1
