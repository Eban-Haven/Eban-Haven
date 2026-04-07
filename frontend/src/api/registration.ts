import { createSupporter } from './admin'

export type DonorRegistrationInput = {
  email: string
  password: string
  supporterType: string
  displayName: string
  organizationName: string
  firstName: string
  lastName: string
  relationshipType: string
  region: string
  country: string
  phone: string
  acquisitionChannel: string
}

/**
 * Creates Supabase Auth user, profile row (role donor), and supporter record when data mode is Supabase.
 * Requires RLS policy profiles_insert_self and lighthouse insert permissions.
 */
export async function registerDonorAccount(input: DonorRegistrationInput): Promise<void> {
  await createSupporter({
    supporterType: input.supporterType.trim() || 'MonetaryDonor',
    displayName: input.displayName.trim(),
    email: input.email.trim().toLowerCase(),
    region: input.region.trim() || undefined,
    status: 'Active',
    organizationName: input.organizationName.trim() || undefined,
    firstName: input.firstName.trim() || undefined,
    lastName: input.lastName.trim() || undefined,
    relationshipType: input.relationshipType.trim() || undefined,
    country: input.country.trim() || undefined,
    phone: input.phone.trim() || undefined,
    acquisitionChannel: input.acquisitionChannel.trim() || 'Website',
  })
}
