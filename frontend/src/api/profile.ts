// Supabase profile/role lookup is not used for Option 2 (backend-issued JWTs).
export type AppRole = 'staff'

export type UserProfile = {
  id: string
  email: string | null
  fullName: string
  role: AppRole
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  return null
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return role === 'staff'
}
