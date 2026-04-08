using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Donation
{
    [Column("donation_id")] public int DonationId { get; set; }
    [Column("supporter_id")] public int SupporterId { get; set; }
    [Column("donation_type")] public string DonationType { get; set; } = "";
    /// <summary>Stored in Postgres as <c>timestamptz</c> (UTC). Requires DB column type migration from <c>date</c>.</summary>
    [Column("donation_date")] public DateTime DonationDate { get; set; }
    [Column("is_recurring")] public bool IsRecurring { get; set; }
    [Column("campaign_name")] public string? CampaignName { get; set; }
    [Column("channel_source")] public string? ChannelSource { get; set; }
    [Column("currency_code")] public string? CurrencyCode { get; set; }
    [Column("amount")] public decimal? Amount { get; set; }
    [Column("estimated_value")] public decimal? EstimatedValue { get; set; }
    [Column("impact_unit")] public string? ImpactUnit { get; set; }
    [Column("notes")] public string? Notes { get; set; }
}

