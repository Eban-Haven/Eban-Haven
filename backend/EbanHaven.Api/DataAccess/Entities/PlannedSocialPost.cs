using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class PlannedSocialPost
{
    [Column("planned_social_post_id")] public int PlannedSocialPostId { get; set; }
    [Column("title")] public string Title { get; set; } = "";
    [Column("platform")] public string Platform { get; set; } = "";
    [Column("content_type")] public string ContentType { get; set; } = "";
    [Column("format")] public string Format { get; set; } = "";
    [Column("image_idea")] public string? ImageIdea { get; set; }
    [Column("caption")] public string Caption { get; set; } = "";
    [Column("hashtags")] public string? Hashtags { get; set; }
    [Column("cta")] public string? Cta { get; set; }
    [Column("suggested_time")] public string? SuggestedTime { get; set; }
    [Column("scheduled_for_utc")] public DateTime? ScheduledForUtc { get; set; }
    [Column("why_it_fits")] public string? WhyItFits { get; set; }
    [Column("notes")] public string? Notes { get; set; }
    [Column("source_prompt")] public string? SourcePrompt { get; set; }
    [Column("status")] public string Status { get; set; } = "Draft";
    [Column("facebook_page_id")] public string? FacebookPageId { get; set; }
    [Column("facebook_post_id")] public string? FacebookPostId { get; set; }
    [Column("facebook_media_url")] public string? FacebookMediaUrl { get; set; }
    [Column("scheduling_error")] public string? SchedulingError { get; set; }
    [Column("created_at_utc")] public DateTime CreatedAtUtc { get; set; }
    [Column("updated_at_utc")] public DateTime UpdatedAtUtc { get; set; }
}
