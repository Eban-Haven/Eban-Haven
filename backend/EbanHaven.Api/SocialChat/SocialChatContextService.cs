using System.Data;
using System.Text.Json;
using Dapper;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.DataAccess;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.SocialChat;

public interface ISocialChatContextService
{
    Task<SocialChatContextSnapshot> BuildContextAsync(CancellationToken cancellationToken);
}

public sealed class SocialChatContextService(
    IOptions<SiteOptions> siteOptions,
    HavenDbContext db,
    IHttpClientFactory httpFactory) : ISocialChatContextService
{
    // ── SQL (mirrors MarketingAnalyticsController) ────────────────────────────

    private const string ChannelSql = """
        WITH donor_channel AS (
            SELECT
                channel_source,
                supporter_id,
                SUM(amount)::float AS lifetime_value,
                COUNT(*)           AS donation_count,
                AVG(amount)::float AS avg_donation,
                BOOL_OR(is_recurring) AS has_recurring
            FROM donations
            WHERE donation_type = 'Monetary'
              AND amount IS NOT NULL
              AND amount > 0
            GROUP BY channel_source, supporter_id
        )
        SELECT
            COALESCE(channel_source, 'Unknown')                              AS channel_source,
            COUNT(DISTINCT supporter_id)::int                                AS unique_donors,
            SUM(donation_count)::int                                         AS total_donations,
            ROUND(SUM(lifetime_value)::numeric, 2)                           AS total_php,
            ROUND(AVG(lifetime_value)::numeric, 2)                           AS avg_donor_ltv,
            ROUND(AVG(avg_donation)::numeric, 2)                             AS avg_donation_amount,
            ROUND(AVG(donation_count)::numeric, 2)                           AS avg_donations_per_donor,
            ROUND(100.0 * SUM(CASE WHEN has_recurring THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(*), 0), 1)                                  AS pct_recurring_donors
        FROM donor_channel
        GROUP BY COALESCE(channel_source, 'Unknown')
        ORDER BY total_php DESC
        """;

    private const string CampaignSql = """
        SELECT
            COALESCE(campaign_name, 'No Campaign')                            AS campaign_name,
            COUNT(*)::int                                                      AS donation_count,
            COUNT(DISTINCT supporter_id)::int                                  AS unique_donors,
            ROUND(SUM(amount)::numeric, 2)                                     AS total_php,
            ROUND(AVG(amount)::numeric, 2)                                     AS avg_amount,
            ROUND(100.0 * SUM(CASE WHEN is_recurring THEN 1 ELSE 0 END)::numeric
                  / NULLIF(COUNT(*), 0), 1)                                    AS recurring_pct
        FROM donations
        WHERE donation_type = 'Monetary'
          AND amount IS NOT NULL
          AND amount > 0
        GROUP BY COALESCE(campaign_name, 'No Campaign')
        ORDER BY total_php DESC
        LIMIT 5
        """;

    // ── Public entry point ────────────────────────────────────────────────────

    public async Task<SocialChatContextSnapshot> BuildContextAsync(CancellationToken cancellationToken)
    {
        var websiteSummary   = GetWebsiteSummary();
        var brandGuidelines  = GetBrandGuidelines();
        var socialMetrics    = await GetRecentSocialMetricsAsync(cancellationToken);
        var causalInsights   = await GetCausalInsightsAsync(cancellationToken);
        var postStrategyInsights = await GetPostStrategyInsightsAsync(cancellationToken);

        return new SocialChatContextSnapshot(
            websiteSummary,
            brandGuidelines,
            socialMetrics,
            causalInsights,
            postStrategyInsights);
    }

    // ── Website + brand (static) ───────────────────────────────────────────────

    private string GetWebsiteSummary()
    {
        var site = siteOptions.Value;
        return
            $"{site.Name} is a nonprofit serving women and girls in Ghana affected by trafficking, sexual violence, " +
            "abuse, and related exploitation. The organization emphasizes safe shelter, counseling, education, " +
            "health support, reintegration planning, transparency, and dignity-centered storytelling. " +
            $"Current site description: {site.Description ?? "No additional site description provided."}";
    }

    private static BrandGuidelinesSnapshot GetBrandGuidelines() => new(
        Voice: "Hopeful, respectful, practical, and empowerment-centered.",
        ToneDos:
        [
            "Center dignity, resilience, and agency.",
            "Use trauma-informed language that avoids sensationalism.",
            "Make asks specific, compassionate, and grounded in mission.",
            "Be clear when a recommendation is based on strong evidence versus informed judgment."
        ],
        ToneDonts:
        [
            "Do not use graphic details or shock-based framing.",
            "Do not imply survivors are defined by victimhood alone.",
            "Do not overclaim impact or certainty.",
            "Do not present speculative performance predictions as facts."
        ],
        SafetyRules:
        [
            "Never invent statistics, survivor stories, or sensitive facts.",
            "Never request or reveal personally identifying or case-level details.",
            "Do not include names, ages, exact locations, or identifying timelines.",
            "If context is missing, say that directly and recommend a safe next step."
        ]);

    // ── Live social metrics from DB ───────────────────────────────────────────

    private async Task<SocialMetricsSnapshot> GetRecentSocialMetricsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var conn = db.Database.GetDbConnection();
            if (conn.State == ConnectionState.Closed)
                await conn.OpenAsync(cancellationToken);

            var channels  = (await conn.QueryAsync<dynamic>(ChannelSql)).ToList();
            var campaigns = (await conn.QueryAsync<dynamic>(CampaignSql)).ToList();

            var highlights = new List<string>();
            var gaps       = new List<string>();

            // Channel breakdown
            if (channels.Count > 0)
            {
                var topChannel = channels[0];
                highlights.Add(
                    $"Top acquisition channel: {topChannel.channel_source} — " +
                    $"₱{topChannel.total_php:N0} raised from {topChannel.unique_donors} unique donors " +
                    $"(avg donation ₱{topChannel.avg_donation_amount:N0}, " +
                    $"{topChannel.pct_recurring_donors}% recurring).");

                var social = channels.FirstOrDefault(c => string.Equals(
                    (string?)c.channel_source, "SocialMedia", StringComparison.OrdinalIgnoreCase));

                if (social is not null)
                {
                    highlights.Add(
                        $"Social media channel: {social.unique_donors} unique donors, " +
                        $"₱{social.total_php:N0} total, ₱{social.avg_donation_amount:N0} avg donation, " +
                        $"avg LTV ₱{social.avg_donor_ltv:N0}, {social.pct_recurring_donors}% recurring.");
                }
                else
                {
                    gaps.Add("No donations tagged with 'SocialMedia' channel source yet.");
                }

                if (channels.Count > 1)
                {
                    var others = channels.Skip(1).Take(3)
                        .Select(c => $"{c.channel_source} (₱{c.total_php:N0})");
                    highlights.Add($"Other channels by revenue: {string.Join(", ", others)}.");
                }
            }
            else
            {
                gaps.Add("No channel attribution data in the database yet.");
            }

            // Campaign breakdown
            if (campaigns.Count > 0)
            {
                var topCampaign = campaigns[0];
                highlights.Add(
                    $"Top campaign: '{topCampaign.campaign_name}' — " +
                    $"₱{topCampaign.total_php:N0} from {topCampaign.donation_count} donations " +
                    $"({topCampaign.unique_donors} donors, {topCampaign.recurring_pct}% recurring).");

                if (campaigns.Count > 1)
                {
                    var others = campaigns.Skip(1).Take(3)
                        .Select(c => $"'{c.campaign_name}' ₱{c.total_php:N0}");
                    highlights.Add($"Other campaigns: {string.Join(", ", others)}.");
                }
            }
            else
            {
                gaps.Add("No campaign data in the database yet.");
            }

            return new SocialMetricsSnapshot(
                EvidenceStrength: "Live data from donation database.",
                Highlights: highlights.Count > 0 ? highlights : ["No donation data available yet."],
                Gaps: gaps.Count > 0 ? gaps : ["No known data gaps."]);
        }
        catch (Exception ex)
        {
            return new SocialMetricsSnapshot(
                EvidenceStrength: "Database unavailable — metrics could not be loaded.",
                Highlights: [],
                Gaps: [$"Database error: {ex.Message}"]);
        }
    }

    // ── Causal insights from ML pipeline ─────────────────────────────────────

    private async Task<CausalInsightsSnapshot> GetCausalInsightsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var client   = httpFactory.CreateClient("MlService");
            var response = await client.GetAsync("/marketing/campaign-analysis", cancellationToken);

            if (!response.IsSuccessStatusCode)
                return FallbackCausalInsights("ML pipeline returned a non-success status.");

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var insights   = new List<string>();
            var hypotheses = new List<string>();

            // Model fit summary
            if (root.TryGetProperty("n_observations", out var nObs) &&
                root.TryGetProperty("r_squared", out var rSq))
            {
                insights.Add(
                    $"Causal model trained on {nObs.GetInt32()} observations, R² = {rSq.GetDouble():F3}. " +
                    "Higher R² means better model fit.");
            }

            // Campaign lift
            if (root.TryGetProperty("campaign_lift", out var lift) &&
                lift.ValueKind == JsonValueKind.Object)
            {
                var pct  = lift.TryGetProperty("pct_effect", out var pe)   ? pe.GetDouble()  : 0;
                var sig  = lift.TryGetProperty("significant",  out var sv)  && sv.GetBoolean();
                var dir  = pct >= 0 ? "higher" : "lower";
                var note = sig ? "(statistically significant, p < 0.05)" : "(not yet statistically significant — more data may help)";
                (sig ? insights : hypotheses).Add(
                    $"Campaign participation is associated with {Math.Abs(pct):F1}% {dir} donation amounts {note}.");
            }

            // Per-channel causal effects
            if (root.TryGetProperty("channel_effects", out var channelEffects) &&
                channelEffects.ValueKind == JsonValueKind.Array)
            {
                foreach (var effect in channelEffects.EnumerateArray())
                {
                    var channel = effect.TryGetProperty("channel",     out var ch) ? ch.GetString() ?? "Unknown" : "Unknown";
                    var pct     = effect.TryGetProperty("pct_effect",  out var pe) ? pe.GetDouble()              : 0;
                    var sig     = effect.TryGetProperty("significant", out var sv) && sv.GetBoolean();
                    var dir     = pct >= 0 ? "higher" : "lower";

                    if (sig)
                        insights.Add($"{channel}: {Math.Abs(pct):F1}% {dir} donation amounts vs baseline (p < 0.05).");
                    else
                        hypotheses.Add($"{channel}: {(pct >= 0 ? "+" : "")}{pct:F1}% effect on donations — not yet significant, needs more data.");
                }
            }

            if (insights.Count == 0)
                insights.Add("Causal pipeline ran but found no statistically significant effects at current data volume.");

            if (hypotheses.Count == 0)
                hypotheses.Add("Continue collecting data to increase statistical power for channel-level causal estimates.");

            return new CausalInsightsSnapshot(
                EvidenceStrength: "Live causal estimates from ML pipeline.",
                Insights: insights,
                Hypotheses: hypotheses);
        }
        catch
        {
            return FallbackCausalInsights("ML pipeline is currently unavailable.");
        }
    }

    private static CausalInsightsSnapshot FallbackCausalInsights(string reason) => new(
        EvidenceStrength: $"Hypothesis-only — {reason}",
        Insights: ["No validated causal findings available at this time."],
        Hypotheses:
        [
            "Educational storytelling may outperform generic appeals when paired with a concrete next step.",
            "Mission-trust content may support future conversion more effectively than urgent donation asks alone."
        ]);

    // ── Post-strategy insights from ML pipeline ──────────────────────────────

    private async Task<PostStrategyInsightsSnapshot> GetPostStrategyInsightsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var client = httpFactory.CreateClient("MlService");
            var response = await client.GetAsync("/marketing/post-strategy-analysis", cancellationToken);

            if (!response.IsSuccessStatusCode)
                return FallbackPostStrategyInsights("Post-strategy pipeline returned a non-success status.");

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var evidenceStrength = root.TryGetProperty("evidence_strength", out var ev)
                ? ev.GetString() ?? "Live post-level analysis from ML pipeline."
                : "Live post-level analysis from ML pipeline.";

            var validated = ReadStringArray(root, "validated_findings");
            var directional = ReadStringArray(root, "directional_findings");
            var dataGaps = ReadStringArray(root, "data_gaps");

            var recommendations = new List<StrategyRecommendation>();
            if (root.TryGetProperty("recommendations", out var recs) &&
                recs.ValueKind == JsonValueKind.Array)
            {
                foreach (var rec in recs.EnumerateArray())
                {
                    if (rec.ValueKind != JsonValueKind.Object) continue;
                    var title = rec.TryGetProperty("title", out var titleProp)
                        ? titleProp.GetString() ?? "Recommendation"
                        : "Recommendation";
                    var detail = rec.TryGetProperty("detail", out var detailProp)
                        ? detailProp.GetString() ?? string.Empty
                        : string.Empty;
                    if (string.IsNullOrWhiteSpace(detail)) continue;
                    recommendations.Add(new StrategyRecommendation(title, detail));
                }
            }

            if (validated.Count == 0)
                validated.Add("No post-level findings are validated yet. Treat content guidance as directional until the pipeline is run on attributed post outcomes.");

            if (directional.Count == 0)
                directional.Add("Track platform, CTA, timing, and attributed revenue per post so the analysis can move from hypothesis to evidence.");

            if (recommendations.Count == 0)
            {
                recommendations.Add(new StrategyRecommendation(
                    "Improve attribution",
                    "Attach a campaign tag or tracked donation link to every published post so future runs can compare post characteristics against real revenue outcomes."
                ));
            }

            if (dataGaps.Count == 0)
                dataGaps.Add("No explicit data gaps were returned by the post-strategy pipeline.");

            return new PostStrategyInsightsSnapshot(
                EvidenceStrength: evidenceStrength,
                ValidatedFindings: validated,
                DirectionalFindings: directional,
                Recommendations: recommendations,
                DataGaps: dataGaps);
        }
        catch
        {
            return FallbackPostStrategyInsights("Post-strategy pipeline is currently unavailable.");
        }
    }

    private static List<string> ReadStringArray(JsonElement root, string propertyName)
    {
        var values = new List<string>();
        if (!root.TryGetProperty(propertyName, out var prop) || prop.ValueKind != JsonValueKind.Array)
            return values;

        foreach (var item in prop.EnumerateArray())
        {
            var value = item.GetString();
            if (!string.IsNullOrWhiteSpace(value))
                values.Add(value);
        }

        return values;
    }

    private static PostStrategyInsightsSnapshot FallbackPostStrategyInsights(string reason) => new(
        EvidenceStrength: $"Directional guidance only — {reason}",
        ValidatedFindings:
        [
            "No validated post-level findings available yet."
        ],
        DirectionalFindings:
        [
            "Social media already contributes meaningful donor revenue, so content should stay tied to donation outcomes instead of being optimized only for reach or likes.",
            "Structured campaign-style posting is directionally stronger than sporadic standalone content in the current marketing analysis."
        ],
        Recommendations:
        [
            new StrategyRecommendation(
                "Generate donor-focused campaign content",
                "Use clear fundraising asks, short campaign arcs, and trust-building mission language so the chatbot reflects what current channel and campaign data already suggest is working."
            )
        ],
        DataGaps:
        [
            "Current evidence is still broader than individual post-level attribution."
        ]);
}
