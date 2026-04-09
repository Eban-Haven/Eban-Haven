using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class InKindDonationItem
{
    [Column("item_id")] public int ItemId { get; set; }
    [Column("donation_id")] public int DonationId { get; set; }
    [Column("item_name")] public string ItemName { get; set; } = "";
    [Column("item_category")] public string? ItemCategory { get; set; }
    [Column("quantity")] public double? Quantity { get; set; }
    [Column("unit_of_measure")] public string? UnitOfMeasure { get; set; }
    [Column("estimated_unit_value")] public decimal? EstimatedUnitValue { get; set; }
    [Column("intended_use")] public string? IntendedUse { get; set; }
    [Column("received_condition")] public string? ReceivedCondition { get; set; }
}

