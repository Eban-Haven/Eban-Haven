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

    private const string TopPlatformTacticalSql = """
        SELECT
            COALESCE(platform, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals
        FROM social_media_posts
        GROUP BY COALESCE(platform, 'Unknown')
        HAVING COUNT(*) >= 5
        ORDER BY median_revenue_per_post_php DESC, median_donation_referrals DESC, post_count DESC
        LIMIT 1
        """;

    private const string TopDayOfWeekTacticalSql = """
        SELECT
            COALESCE(day_of_week, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals
        FROM social_media_posts
        GROUP BY COALESCE(day_of_week, 'Unknown')
        HAVING COUNT(*) >= 5
        ORDER BY median_revenue_per_post_php DESC, median_donation_referrals DESC, post_count DESC
        LIMIT 1
        """;

    private const string TopTimeBucketTacticalSql = """
        SELECT
            CASE
                WHEN COALESCE(post_hour, 0) BETWEEN 5 AND 10 THEN 'Morning (5am–11am)'
                WHEN COALESCE(post_hour, 0) BETWEEN 11 AND 15 THEN 'Midday (11am–4pm)'
                WHEN COALESCE(post_hour, 0) BETWEEN 16 AND 20 THEN 'Evening (4pm–9pm)'
                ELSE 'Late night / early morning'
            END AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals
        FROM social_media_posts
        GROUP BY 1
        HAVING COUNT(*) >= 5
        ORDER BY median_revenue_per_post_php DESC, median_donation_referrals DESC, post_count DESC
        LIMIT 1
        """;

    private const string TopContentTopicTacticalSql = """
        SELECT
            COALESCE(content_topic, 'Unknown') AS label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(estimated_donation_value_php, 0))::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(donation_referrals, 0))::numeric, 2) AS median_donation_referrals
        FROM social_media_posts
        GROUP BY COALESCE(content_topic, 'Unknown')
        HAVING COUNT(*) >= 5
        ORDER BY median_revenue_per_post_php DESC, median_donation_referrals DESC, post_count DESC
        LIMIT 1
        """;

    private const string TopRecurringHashtagsTacticalSql = """
        WITH exploded AS (
            SELECT
                LOWER(TRIM(tag)) AS label,
                COALESCE(estimated_donation_value_php, 0) AS estimated_donation_value_php,
                COALESCE(donation_referrals, 0) AS donation_referrals
            FROM social_media_posts
            CROSS JOIN LATERAL regexp_split_to_table(COALESCE(hashtags, ''), '\s*,\s*') AS tag
            WHERE NULLIF(TRIM(tag), '') IS NOT NULL
              AND NULLIF(TRIM(COALESCE(campaign_name, '')), '') IS NULL
        )
        SELECT
            label,
            COUNT(*)::int AS post_count,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY estimated_donation_value_php)::numeric, 2) AS median_revenue_per_post_php,
            ROUND(percentile_cont(0.5) WITHIN GROUP (ORDER BY donation_referrals)::numeric, 2) AS median_donation_referrals
        FROM exploded
        GROUP BY label
        HAVING COUNT(*) >= 20
        ORDER BY median_revenue_per_post_php DESC, median_donation_referrals DESC, post_count DESC
        LIMIT 4
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
        var evidenceStrength = "Directional guidance only — live social-post rankings plus any available ML analysis.";
        var validated = new List<string>();
        var directional = new List<string>();
        var dataGaps = new List<string>();
        var tacticalInsights = new List<SocialTacticalInsight>();
        var recommendedHashtags = new List<string>();
        var recommendations = new List<StrategyRecommendation>();
        var mlUnavailableReason = string.Empty;

        try
        {
            var client = httpFactory.CreateClient("MlService");
            var response = await client.GetAsync("/marketing/post-strategy-analysis", cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                evidenceStrength = root.TryGetProperty("evidence_strength", out var ev)
                    ? ev.GetString() ?? "Live post-level analysis from ML pipeline."
                    : "Live post-level analysis from ML pipeline.";

                validated.AddRange(ReadStringArray(root, "validated_findings"));
                directional.AddRange(ReadStringArray(root, "directional_findings"));
                dataGaps.AddRange(ReadStringArray(root, "data_gaps"));

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
            }
            else
            {
                mlUnavailableReason = "Post-strategy ML metadata is currently unavailable, so the chatbot is using live social rankings plus broader directional guidance.";
            }
        }
        catch
        {
            mlUnavailableReason = "Post-strategy ML pipeline is currently unavailable, so the chatbot is using live social rankings plus broader directional guidance.";
        }

        var liveSocialInsights = await GetLiveSocialTacticalInsightsAsync(cancellationToken);
        tacticalInsights.AddRange(liveSocialInsights.Insights);
        recommendedHashtags.AddRange(liveSocialInsights.RecommendedHashtags);
        dataGaps.AddRange(liveSocialInsights.DataGaps);

        if (!string.IsNullOrWhiteSpace(mlUnavailableReason))
            dataGaps.Add(mlUnavailableReason);

        if (validated.Count == 0)
            validated.Add("No post-level findings are statistically validated yet. Use the current social rankings as directional operational guidance, not causal proof.");

        if (directional.Count == 0)
            directional.Add("Track platform, CTA, timing, and attributed revenue per post so the analysis can move from hypothesis to evidence.");

        if (tacticalInsights.Count > 0)
        {
            directional.AddRange(tacticalInsights.Select(insight =>
                $"{insight.Title}: {insight.Value}. {insight.Detail}"));
        }

        if (recommendations.Count == 0)
        {
            recommendations.Add(new StrategyRecommendation(
                "Improve attribution",
                "Attach a campaign tag or tracked donation link to every published post so future runs can compare post characteristics against real revenue outcomes."
            ));
        }

        if (dataGaps.Count == 0)
            dataGaps.Add("No explicit data gaps were returned by the post-strategy pipeline.");

        if (recommendedHashtags.Count == 0)
            recommendedHashtags.AddRange(FallbackRecommendedHashtags());

        if (tacticalInsights.Count == 0 &&
            validated.Count == 1 &&
            recommendations.Count == 1 &&
            recommendedHashtags.Count == FallbackRecommendedHashtags().Count)
        {
            return FallbackPostStrategyInsights(string.IsNullOrWhiteSpace(mlUnavailableReason)
                ? "Post-strategy pipeline is currently unavailable."
                : mlUnavailableReason);
        }

        return new PostStrategyInsightsSnapshot(
            EvidenceStrength: evidenceStrength,
            ValidatedFindings: validated,
            DirectionalFindings: directional
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray(),
            TacticalInsights: tacticalInsights,
            RecommendedHashtags: recommendedHashtags
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray(),
            Recommendations: recommendations,
            DataGaps: dataGaps
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private async Task<(IReadOnlyList<SocialTacticalInsight> Insights, IReadOnlyList<string> RecommendedHashtags, IReadOnlyList<string> DataGaps)>
        GetLiveSocialTacticalInsightsAsync(CancellationToken cancellationToken)
    {
        try
        {
            var conn = db.Database.GetDbConnection();
            if (conn.State == ConnectionState.Closed)
                await conn.OpenAsync(cancellationToken);

            var insights = new List<SocialTacticalInsight>();
            var recommendedHashtags = new List<string>();
            var dataGaps = new List<string>();

            var topPlatform = await conn.QuerySingleOrDefaultAsync<dynamic>(TopPlatformTacticalSql);
            if (topPlatform is not null)
            {
                insights.Add(new SocialTacticalInsight(
                    Key: "best-platform",
                    Title: "Best platform",
                    Value: (string)(topPlatform.label ?? "Unknown"),
                    Detail: $"Typical post revenue is ₱{topPlatform.median_revenue_per_post_php:N0} with {topPlatform.median_donation_referrals:N1} donation referrals across {topPlatform.post_count} posts."));
            }

            var topDay = await conn.QuerySingleOrDefaultAsync<dynamic>(TopDayOfWeekTacticalSql);
            if (topDay is not null)
            {
                insights.Add(new SocialTacticalInsight(
                    Key: "best-day",
                    Title: "Best day of week",
                    Value: (string)(topDay.label ?? "Unknown"),
                    Detail: $"Typical post revenue is ₱{topDay.median_revenue_per_post_php:N0} with {topDay.median_donation_referrals:N1} donation referrals across {topDay.post_count} posts."));
            }

            var topTime = await conn.QuerySingleOrDefaultAsync<dynamic>(TopTimeBucketTacticalSql);
            if (topTime is not null)
            {
                insights.Add(new SocialTacticalInsight(
                    Key: "best-time-bucket",
                    Title: "Best posting window",
                    Value: (string)(topTime.label ?? "Unknown"),
                    Detail: $"Typical post revenue is ₱{topTime.median_revenue_per_post_php:N0} with {topTime.median_donation_referrals:N1} donation referrals across {topTime.post_count} posts."));
            }

            var topTopic = await conn.QuerySingleOrDefaultAsync<dynamic>(TopContentTopicTacticalSql);
            if (topTopic is not null)
            {
                insights.Add(new SocialTacticalInsight(
                    Key: "best-content-topic",
                    Title: "Best content topic",
                    Value: (string)(topTopic.label ?? "Unknown"),
                    Detail: $"Typical post revenue is ₱{topTopic.median_revenue_per_post_php:N0} with {topTopic.median_donation_referrals:N1} donation referrals across {topTopic.post_count} posts."));
            }

            var hashtagRows = (await conn.QueryAsync<dynamic>(TopRecurringHashtagsTacticalSql)).ToList();
            if (hashtagRows.Count > 0)
            {
                recommendedHashtags.AddRange(hashtagRows
                    .Select(row => NormalizeHashtagForPrompt((string?)row.label))
                    .Where(static tag => !string.IsNullOrWhiteSpace(tag)));

                var hashtagSummary = string.Join(", ", hashtagRows.Select(row =>
                {
                    var label = NormalizeHashtagForPrompt((string?)row.label);
                    var medianRevenue = Convert.ToDecimal(row.median_revenue_per_post_php ?? 0m);
                    var postCount = Convert.ToInt32(row.post_count ?? 0);
                    return $"{label} (₱{medianRevenue:N0}, n={postCount})";
                }));

                insights.Add(new SocialTacticalInsight(
                    Key: "best-recurring-hashtags",
                    Title: "Best recurring hashtags",
                    Value: string.Join(' ', recommendedHashtags),
                    Detail: $"Current recurring leaders are {hashtagSummary}."));
            }
            else
            {
                dataGaps.Add("No recurring hashtags currently meet the minimum post-count threshold for reliable ranking.");
            }

            return (insights, recommendedHashtags, dataGaps);
        }
        catch (Exception ex)
        {
            return ([], [], [$"Live social-post rankings unavailable: {ex.Message}"]);
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

    private static string NormalizeHashtagForPrompt(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var trimmed = value.Trim();
        return trimmed.StartsWith('#') ? trimmed : $"#{trimmed}";
    }

    private static IReadOnlyList<string> FallbackRecommendedHashtags() =>
    [
        "#ebanhaven",
        "#hopeforgirls",
        "#traumainformedcare"
    ];

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
        TacticalInsights:
        [
            new SocialTacticalInsight(
                "best-posting-window",
                "Best posting window",
                "No live timing ranking available",
                "Use this as a planning conversation starter only until live social-post rankings are available.")
        ],
        RecommendedHashtags: FallbackRecommendedHashtags(),
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
