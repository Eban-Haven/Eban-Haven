import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, UserRound } from 'lucide-react'

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-2 border-b-2 px-3 pb-3 text-sm font-medium transition-colors ${
    isActive
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground'
  }`

export function DonorLayout() {
  return (
    <div className="min-h-[calc(100vh-5rem)] bg-muted/30 py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-6">
        <nav className="mb-8 flex flex-wrap gap-1 border-b border-border" aria-label="Donor sections">
          <NavLink to="/donor-dashboard" end className={tabClass}>
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </NavLink>
          <NavLink to="/donor-dashboard/account" className={tabClass}>
            <UserRound className="h-4 w-4" />
            Account
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </div>
  )
}
