import { Link } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import type { AtRiskDonorInfo, DonorUpgradeInfo, Supporter } from '../../../../api/adminTypes'
import { btnPrimary, card } from '../../shared/adminStyles'
import { StatusBadge } from '../../shared/adminDataTable/AdminBadges'
import { RESIDENT_SEMANTIC } from '../../shared/residentSemanticPalette'

type Props = {
  supporter: Supporter
  donationCount: number
  churn: AtRiskDonorInfo | null
  churnLoading: boolean
  /** API / ML error detail when churn prediction could not be loaded */
  churnError: string | null
  /** Present when this donor appears in the upgrade-candidates batch (ML propensity). */
  upgrade: DonorUpgradeInfo | null
}

function isLapseRisk(c: AtRiskDonorInfo) {
  return (
    c.prediction === 'At Risk' || c.risk_tier === 'High Risk' || c.risk_tier === 'Moderate Risk'
  )
}

/** Uses churn pipeline output: stable / low tier + low probability + giving history. */
function isDonateMorePotential(c: AtRiskDonorInfo, donationCount: number) {
  return (
    donationCount > 0 &&
    c.prediction === 'Stable' &&
    c.risk_tier === 'Low Risk' &&
    c.churn_probability < 0.45
  )
}

/** Full-width insight pills on the donor detail card (semantic palette + readable size). */
const insightChipBase =
  'inline-flex max-w-full min-w-0 items-center rounded-full border px-4 py-2 text-sm font-medium leading-snug'

function lapseInsightChipClass(churn: AtRiskDonorInfo) {
  if (churn.risk_tier === 'High Risk') return RESIDENT_SEMANTIC.danger.chip
  return RESIDENT_SEMANTIC.warning.chip
}

function upgradePropensityChipClass(propensityTier: string | undefined) {
  const t = propensityTier?.trim().toLowerCase() ?? ''
  if (t === 'high') return RESIDENT_SEMANTIC.success.chip
  if (t === 'moderate') return RESIDENT_SEMANTIC.warning.chip
  if (t === 'low') return RESIDENT_SEMANTIC.neutral.chip
  return RESIDENT_SEMANTIC.success.chip
}

export function DonorStatusCard({
  supporter,
  donationCount,
  churn,
  churnLoading,
  churnError,
  upgrade,
}: Props) {
  const outreachHref = `/admin/email-hub?supporterId=${supporter.id}`
  const showLapse = churn != null && isLapseRisk(churn)
  const showPotential = churn != null && isDonateMorePotential(churn, donationCount)
  const showUpgradeChip = upgrade != null && upgrade.prediction === 'Likely to Upgrade'

  const hasInsightChips = showLapse || showUpgradeChip || showPotential

  return (
    <div className={`${card} flex h-full min-h-0 flex-col gap-4`}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
        <span className="font-medium text-muted-foreground">Status:</span>
        <StatusBadge status={supporter.status} />
      </div>

      <div className="border-t border-border pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Donor insights</p>
        {churnLoading ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Loading insights…
          </p>
        ) : churn == null ? (
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Insights unavailable</p>
            {churnError ? (
              <p className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs leading-relaxed text-foreground">
                {churnError}
              </p>
            ) : null}
            {upgrade && showUpgradeChip ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <span className={`${insightChipBase} ${upgradePropensityChipClass(upgrade.propensity_tier)}`}>
                  Upgrade propensity · {Math.round(upgrade.upgrade_probability * 100)}%
                  {upgrade.propensity_tier ? ` · ${upgrade.propensity_tier}` : ''}
                </span>
              </div>
            ) : null}
            <p className="text-xs leading-relaxed">
              Churn scores come from the ML prediction service. If you are running locally, start the ML API and ensure
              the backend can reach it. A 502 usually means the model service is down or misconfigured.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-3">
            <div className="flex flex-wrap gap-2">
              {showLapse ? (
                <span
                  className={`${insightChipBase} ${lapseInsightChipClass(churn)}`}
                  title={churn.top_risk_signals?.length ? churn.top_risk_signals.join(' · ') : undefined}
                >
                  Lapse risk · {Math.round(churn.churn_probability * 100)}% · {churn.risk_tier}
                </span>
              ) : null}
              {showUpgradeChip && upgrade ? (
                <span className={`${insightChipBase} ${upgradePropensityChipClass(upgrade.propensity_tier)}`}>
                  Upgrade propensity · {Math.round(upgrade.upgrade_probability * 100)}%
                  {upgrade.propensity_tier ? ` · ${upgrade.propensity_tier}` : ''}
                </span>
              ) : null}
              {showPotential ? (
                <span className={`${insightChipBase} ${RESIDENT_SEMANTIC.success.chip}`}>
                  Stable engagement · growth opportunity
                </span>
              ) : null}
            </div>
            {!hasInsightChips ? (
              <p className="text-sm text-muted-foreground">No standout pipeline flags for this donor right now.</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        <Link to={outreachHref} className={`${btnPrimary} block w-full text-center`}>
          Donor outreach
        </Link>
      </div>
    </div>
  )
}
