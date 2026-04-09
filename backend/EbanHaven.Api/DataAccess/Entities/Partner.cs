using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Partner
{
    [Column("partner_id")] public int PartnerId { get; set; }
    [Column("partner_name")] public string PartnerName { get; set; } = "";
    [Column("partner_type")] public string PartnerType { get; set; } = "";
    [Column("role_type")] public string? RoleType { get; set; }
    [Column("contact_name")] public string? ContactName { get; set; }
    [Column("email")] public string? Email { get; set; }
    [Column("phone")] public string? Phone { get; set; }
    [Column("region")] public string? Region { get; set; }
    [Column("status")] public string Status { get; set; } = "";
    [Column("start_date")] public DateOnly? StartDate { get; set; }
    [Column("end_date")] public DateOnly? EndDate { get; set; }
    [Column("notes")] public string? Notes { get; set; }
}

