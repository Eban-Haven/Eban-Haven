using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class HealthWellbeingRecord
{
    [Column("health_record_id")] public int HealthRecordId { get; set; }
    [Column("resident_id")] public int ResidentId { get; set; }
    [Column("record_date")] public DateOnly RecordDate { get; set; }
    [Column("general_health_score")] public double? GeneralHealthScore { get; set; }
    [Column("nutrition_score")] public double? NutritionScore { get; set; }
    [Column("sleep_quality_score")] public double? SleepQualityScore { get; set; }
    [Column("energy_level_score")] public double? EnergyLevelScore { get; set; }
    [Column("height_cm")] public double? HeightCm { get; set; }
    [Column("weight_kg")] public double? WeightKg { get; set; }
    [Column("bmi")] public double? Bmi { get; set; }
    [Column("medical_checkup_done")] public bool? MedicalCheckupDone { get; set; }
    [Column("dental_checkup_done")] public bool? DentalCheckupDone { get; set; }
    [Column("psychological_checkup_done")] public bool? PsychologicalCheckupDone { get; set; }
    [Column("notes")] public string? Notes { get; set; }
    /// <summary>Optional JSON payload for extra fields; not present in baseline CSV.</summary>
    [Column("extended_json")] public string? ExtendedJson { get; set; }
}

