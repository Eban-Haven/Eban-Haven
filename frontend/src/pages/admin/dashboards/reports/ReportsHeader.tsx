import { BarChart3 } from 'lucide-react'
import type { ReportFiltersState } from './reportTypes'
import { ReportFilters } from './ReportFilters'
import type { SafehousePerformance, CampaignPerformance, PlannedSocialPost } from '../../../../api/adminTypes'

type Props = {
  filters: ReportFiltersState
  onFiltersChange: (f: ReportFiltersState) => void
  safehouses: SafehousePerformance[]
  campaigns: CampaignPerformance[]
  plannedPosts: PlannedSocialPost[]
  donationTypeOptions: string[]
}

export function ReportsHeader({
  filters,
  onFiltersChange,
  safehouses,
  campaigns,
  plannedPosts,
  donationTypeOptions,
}: Props) {
  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-8">
        <div className="flex flex-col gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Admin reports
            </p>
            <h1 className="mt-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">Reports &amp; Insights</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Focus on the handful of signals that need action: fundraising health, resident risk, and program
              progress.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-muted/20 px-5 py-4 sm:px-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Filters</p>
        <ReportFilters
          filters={filters}
          onChange={onFiltersChange}
          safehouses={safehouses}
          campaigns={campaigns}
          plannedPosts={plannedPosts}
          donationTypeOptions={donationTypeOptions}
        />
      </div>
    </header>
  )
}
