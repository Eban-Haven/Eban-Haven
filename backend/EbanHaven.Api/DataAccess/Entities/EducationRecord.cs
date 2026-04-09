using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class EducationRecord
{
    [Column("education_record_id")] public int EducationRecordId { get; set; }
    [Column("resident_id")] public int ResidentId { get; set; }
    [Column("record_date")] public DateOnly RecordDate { get; set; }
    [Column("education_level")] public string? EducationLevel { get; set; }
    [Column("school_name")] public string? SchoolName { get; set; }
    [Column("enrollment_status")] public string? EnrollmentStatus { get; set; }
    [Column("attendance_rate")] public double? AttendanceRate { get; set; }
    [Column("progress_percent")] public double? ProgressPercent { get; set; }
    [Column("completion_status")] public string? CompletionStatus { get; set; }
    [Column("notes")] public string? Notes { get; set; }
    /// <summary>Optional JSON payload for extra fields; not present in baseline CSV.</summary>
    [Column("extended_json")] public string? ExtendedJson { get; set; }
}

