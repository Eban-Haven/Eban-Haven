namespace EbanHaven.Api.SocialChat;

public sealed record SocialChatRequest(IReadOnlyList<SocialChatMessageDto>? Messages);

public sealed record SocialChatMessageDto(string Role, string Content);

public sealed record SocialChatResponse(
    string Message,
    SocialChatStructuredReply Structured,
    SocialChatContextSnapshot Context,
    string Model,
    DateTimeOffset GeneratedAtUtc);

public sealed record SocialChatStructuredReply(
    IReadOnlyList<string> ClarifyingQuestions,
    string PlanningSummary,
    IReadOnlyList<SocialChatSuggestion> PostIdeas,
    IReadOnlyList<string> Captions,
    IReadOnlyList<RecommendationItem> TimingRecommendations,
    IReadOnlyList<RecommendationItem> CtaRecommendations,
    IReadOnlyList<ConfidenceNote> ConfidenceNotes,
    IReadOnlyList<string> Reasoning);

public sealed record SocialChatSuggestion(
    string Title,
    string Platform,
    string ContentType,
    string Format,
    string ImageIdea,
    string Caption,
    IReadOnlyList<string> Hashtags,
    string Cta,
    string BestTime,
    string WhyItFits,
    string Notes);

public sealed record RecommendationItem(string Recommendation, string Rationale);

public sealed record ConfidenceNote(string Label, string Detail);

public sealed record SocialChatContextSnapshot(
    string WebsiteSummary,
    BrandGuidelinesSnapshot BrandGuidelines,
    SocialMetricsSnapshot RecentSocialMetrics,
    CausalInsightsSnapshot CausalInsights,
    PostStrategyInsightsSnapshot PostStrategyInsights);

public sealed record BrandGuidelinesSnapshot(
    string Voice,
    IReadOnlyList<string> ToneDos,
    IReadOnlyList<string> ToneDonts,
    IReadOnlyList<string> SafetyRules);

public sealed record SocialMetricsSnapshot(
    string EvidenceStrength,
    IReadOnlyList<string> Highlights,
    IReadOnlyList<string> Gaps);

public sealed record CausalInsightsSnapshot(
    string EvidenceStrength,
    IReadOnlyList<string> Insights,
    IReadOnlyList<string> Hypotheses);

public sealed record StrategyRecommendation(
    string Title,
    string Detail);

public sealed record PostStrategyInsightsSnapshot(
    string EvidenceStrength,
    IReadOnlyList<string> ValidatedFindings,
    IReadOnlyList<string> DirectionalFindings,
    IReadOnlyList<StrategyRecommendation> Recommendations,
    IReadOnlyList<string> DataGaps);
