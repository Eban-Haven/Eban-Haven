import { Suspense, lazy, type ComponentType } from 'react'
import { Routes, Route } from 'react-router-dom'
import { PublicLayout } from './layouts/PublicLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { RequireAdmin } from './components/RequireAdmin'
import { RequireDonor } from './components/RequireDonor'
import { DonorLayout } from './layouts/DonorLayout'

function lazyNamedPage<TModule extends Record<string, ComponentType<any>>>(
  loader: () => Promise<TModule>,
  exportName: keyof TModule,
) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[exportName] as ComponentType<any> }
  })
}

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Loading page…
    </div>
  )
}

const HomePage = lazyNamedPage(() => import('./pages/public/HomePage'), 'HomePage')
const ImpactPage = lazyNamedPage(() => import('./pages/public/ImpactPage'), 'ImpactPage')
const PrivacyPage = lazyNamedPage(() => import('./pages/public/PrivacyPage'), 'PrivacyPage')
const LoginPage = lazyNamedPage(() => import('./pages/public/LoginPage'), 'LoginPage')
const AccessibilityPage = lazyNamedPage(() => import('./pages/public/AccessibilityPage'), 'AccessibilityPage')
const DonorDashboardPage = lazyNamedPage(() => import('./pages/donor/DonorDashboardPage'), 'DonorDashboardPage')
const DonorAccountPage = lazyNamedPage(() => import('./pages/donor/DonorAccountPage'), 'DonorAccountPage')
const AdminDashboardPage = lazyNamedPage(() => import('./pages/admin/dashboards/AdminDashboardPage'), 'AdminDashboardPage')
const DonorsAdminPage = lazyNamedPage(() => import('./pages/admin/databases/DonorsAdminPage'), 'DonorsAdminPage')
const DonorDetailPage = lazyNamedPage(() => import('./pages/admin/databases/DonorDetailPage'), 'DonorDetailPage')
const DonorDashboardAdminPage = lazyNamedPage(() => import('./pages/admin/dashboards/DonorDashboardAdminPage'), 'DonorDashboardAdminPage')
const DonorAllPage = lazyNamedPage(() => import('./pages/admin/databases/DonorAllPage'), 'DonorAllPage')
const ResidentInformationPage = lazyNamedPage(() => import('./pages/admin/databases/ResidentInformationPage'), 'ResidentInformationPage')
const MarketingAnalyticsPage = lazyNamedPage(() => import('./pages/admin/dashboards/MarketingAnalyticsPage'), 'MarketingAnalyticsPage')
const ContributionsAdminPage = lazyNamedPage(() => import('./pages/admin/databases/ContributionsAdminPage'), 'ContributionsAdminPage')
const AllocationsAdminPage = lazyNamedPage(() => import('./pages/admin/databases/AllocationsAdminPage'), 'AllocationsAdminPage')
const ResidentsPage = lazyNamedPage(() => import('./pages/admin/databases/ResidentsPage'), 'ResidentsPage')
const ResidentDetailPage = lazyNamedPage(() => import('./pages/admin/databases/ResidentDetailPage'), 'ResidentDetailPage')
const ResidentPipelinePage = lazyNamedPage(() => import('./pages/admin/tools/ResidentPipelinePage'), 'ResidentPipelinePage')
const ProcessRecordingsPage = lazyNamedPage(() => import('./pages/admin/databases/ProcessRecordingsPage'), 'ProcessRecordingsPage')
const HomeVisitationsAdminPage = lazyNamedPage(() => import('./pages/admin/databases/HomeVisitationsAdminPage'), 'HomeVisitationsAdminPage')
const CaseConferencesAdminPage = lazyNamedPage(() => import('./pages/admin/databases/CaseConferencesAdminPage'), 'CaseConferencesAdminPage')
const ReintegrationReadinessPage = lazyNamedPage(() => import('./pages/admin/databases/ReintegrationReadinessPage'), 'ReintegrationReadinessPage')
const ReintegrationActionPlanPage = lazyNamedPage(() => import('./pages/admin/databases/ReintegrationActionPlanPage'), 'ReintegrationActionPlanPage')
const ReportsPage = lazyNamedPage(() => import('./pages/admin/dashboards/ReportsPage'), 'ReportsPage')
const SocialPlannerPage = lazyNamedPage(() => import('./pages/admin/tools/SocialPlannerPage'), 'SocialPlannerPage')
const SocialWorkerDashboardPage = lazyNamedPage(() => import('./pages/admin/dashboards/SocialWorkerDashboardPage'), 'SocialWorkerDashboardPage')
const EmailHubPage = lazyNamedPage(() => import('./pages/admin/tools/EmailHubPage'), 'EmailHubPage')
const MyDonationsAdminPage = lazyNamedPage(() => import('./pages/admin/dashboards/MyDonationsAdminPage'), 'MyDonationsAdminPage')

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/impact" element={<ImpactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accessibility" element={<AccessibilityPage />} />
          <Route
            path="/donor-dashboard"
            element={
              <RequireDonor>
                <DonorLayout />
              </RequireDonor>
            }
          >
            <Route index element={<DonorDashboardPage />} />
            <Route path="account" element={<DonorAccountPage />} />
          </Route>
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="my-donations" element={<MyDonationsAdminPage />} />
          <Route path="social-worker-dashboard" element={<SocialWorkerDashboardPage />} />
          <Route path="donors" element={<DonorsAdminPage />} />
          <Route path="donors/:id" element={<DonorDetailPage />} />
          <Route path="donor-dashboard" element={<DonorDashboardAdminPage />} />
          <Route path="donor-all" element={<DonorAllPage />} />
          <Route path="resident-information" element={<ResidentInformationPage />} />
          <Route path="reintigration-readiness" element={<ReintegrationReadinessPage />} />
          <Route path="reintigration-readiness/:id" element={<ReintegrationActionPlanPage />} />
          <Route path="marketing-analytics" element={<MarketingAnalyticsPage />} />
          <Route path="email-hub" element={<EmailHubPage />} />
          <Route path="contributions" element={<ContributionsAdminPage />} />
          <Route path="allocations" element={<AllocationsAdminPage />} />
          <Route path="residents" element={<ResidentsPage />} />
          <Route path="residents/:id" element={<ResidentDetailPage />} />
          <Route path="resident-pipeline" element={<ResidentPipelinePage />} />
          <Route path="process-recordings" element={<ProcessRecordingsPage />} />
          <Route path="home-visitations" element={<HomeVisitationsAdminPage />} />
          <Route path="case-conferences" element={<CaseConferencesAdminPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route
            path="social-planner"
            element={
              <RequireAdmin>
                <SocialPlannerPage />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}
