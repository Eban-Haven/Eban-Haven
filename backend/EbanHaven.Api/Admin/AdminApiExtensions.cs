using System.Globalization;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Mvc;

namespace EbanHaven.Api.Admin;

public static class AdminApiExtensions
{
    public static void MapAdminApi(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").RequireAuthorization();

        admin.MapGet("/dashboard", (LighthouseDataStore db) => Results.Ok(db.GetAdminDashboard()));

        admin.MapGet("/safehouses", (LighthouseDataStore db) => Results.Ok(db.ListSafehousesOptions()));

        admin.MapGet("/supporters", (LighthouseDataStore db) => Results.Ok(db.ListSupporters()));
        admin.MapPost("/supporters", (CreateSupporterRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.SupporterType))
                return Results.BadRequest(new { error = "SupporterType is required." });
            if (string.IsNullOrWhiteSpace(body.DisplayName))
                return Results.BadRequest(new { error = "DisplayName is required." });
            var status = string.IsNullOrWhiteSpace(body.Status) ? "Active" : body.Status.Trim();
            var created = db.CreateSupporter(
                body.SupporterType.Trim(),
                body.DisplayName.Trim(),
                body.Email?.Trim(),
                body.Region?.Trim(),
                status);
            return Results.Created($"/api/admin/supporters/{created.Id}", created);
        });
        admin.MapPatch("/supporters/{id:int}", (int id, PatchSupporterRequest body, LighthouseDataStore db) =>
        {
            var u = db.UpdateSupporter(id, body.Status, body.SupporterType);
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/donations", (int? supporterId, LighthouseDataStore db) =>
            Results.Ok(db.ListDonations(supporterId)));
        admin.MapPost("/donations", (CreateDonationRequest body, LighthouseDataStore db) =>
        {
            if (body.SupporterId <= 0)
                return Results.BadRequest(new { error = "SupporterId is required." });
            if (string.IsNullOrWhiteSpace(body.DonationType))
                return Results.BadRequest(new { error = "DonationType is required." });
            try
            {
                var dt = body.DonationDate ?? DateTime.UtcNow.Date;
                var created = db.CreateDonation(
                    body.SupporterId,
                    body.DonationType.Trim(),
                    dt,
                    body.Amount,
                    body.CurrencyCode,
                    body.Notes,
                    body.CampaignName);
                return Results.Created($"/api/admin/donations/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapGet("/donation-allocations", (int? donationId, int? safehouseId, LighthouseDataStore db) =>
            Results.Ok(db.ListAllocations(donationId, safehouseId)));

        admin.MapGet("/residents", (
            [FromQuery] string? status,
            [FromQuery] int? safehouseId,
            [FromQuery] string? category,
            [FromQuery] string? q,
            LighthouseDataStore db) => Results.Ok(db.ListResidents(status, safehouseId, category, q)));

        admin.MapGet("/residents/{id:int}", (int id, LighthouseDataStore db) =>
        {
            var r = db.GetResident(id);
            return r is null ? Results.NotFound() : Results.Ok(r);
        });

        admin.MapPatch("/residents/{id:int}", (int id, IReadOnlyDictionary<string, string?> body, LighthouseDataStore db) =>
        {
            var ok = db.UpdateResident(id, body);
            return ok ? Results.Ok(db.GetResident(id)) : Results.NotFound();
        });

        admin.MapPost("/residents", (CreateResidentRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.InternalCode))
                return Results.BadRequest(new { error = "InternalCode is required." });
            if (string.IsNullOrWhiteSpace(body.CaseStatus))
                return Results.BadRequest(new { error = "CaseStatus is required." });
            var created = db.CreateResident(body.InternalCode.Trim(), body.CaseStatus.Trim(), body.CaseCategory?.Trim());
            return Results.Created($"/api/admin/residents/{created.Id}", created);
        });

        admin.MapPatch("/residents/{id:int}/status", (int id, UpdateCaseStatusRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var u = db.UpdateResidentStatus(id, body.Status.Trim());
            return u is null ? Results.NotFound() : Results.Ok(u);
        });

        admin.MapGet("/process-recordings", (int? residentId, LighthouseDataStore db) =>
            Results.Ok(db.ListProcessRecordings(residentId)));

        admin.MapPost("/process-recordings", (CreateProcessRecordingRequest body, LighthouseDataStore db) =>
        {
            if (body.ResidentId <= 0)
                return Results.BadRequest(new { error = "ResidentId is required." });
            if (string.IsNullOrWhiteSpace(body.SocialWorker))
                return Results.BadRequest(new { error = "SocialWorker is required." });
            if (string.IsNullOrWhiteSpace(body.SessionType))
                return Results.BadRequest(new { error = "SessionType is required." });
            if (string.IsNullOrWhiteSpace(body.SessionNarrative))
                return Results.BadRequest(new { error = "SessionNarrative is required." });
            try
            {
                var at = body.SessionDate ?? DateTime.UtcNow;
                var created = db.CreateProcessRecording(
                    body.ResidentId,
                    at,
                    body.SocialWorker.Trim(),
                    body.SessionType.Trim(),
                    body.SessionDurationMinutes,
                    body.EmotionalStateObserved?.Trim(),
                    body.EmotionalStateEnd?.Trim(),
                    body.SessionNarrative.Trim(),
                    body.InterventionsApplied?.Trim(),
                    body.FollowUpActions?.Trim());
                return Results.Created($"/api/admin/process-recordings/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapGet("/home-visitations", (int? residentId, LighthouseDataStore db) =>
            Results.Ok(db.ListHomeVisitations(residentId)));

        admin.MapPost("/home-visitations", (CreateHomeVisitationRequest body, LighthouseDataStore db) =>
        {
            if (body.ResidentId <= 0)
                return Results.BadRequest(new { error = "ResidentId is required." });
            if (string.IsNullOrWhiteSpace(body.SocialWorker))
                return Results.BadRequest(new { error = "SocialWorker is required." });
            if (string.IsNullOrWhiteSpace(body.VisitType))
                return Results.BadRequest(new { error = "VisitType is required." });
            try
            {
                var at = body.VisitDate ?? DateTime.UtcNow;
                var created = db.CreateHomeVisitation(
                    body.ResidentId,
                    at,
                    body.SocialWorker.Trim(),
                    body.VisitType.Trim(),
                    body.LocationVisited?.Trim(),
                    body.Observations?.Trim(),
                    body.FamilyCooperationLevel?.Trim(),
                    body.SafetyConcernsNoted,
                    body.FollowUpNeeded,
                    body.FollowUpNotes?.Trim());
                return Results.Created($"/api/admin/home-visitations/{created.Id}", created);
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });

        admin.MapGet("/intervention-plans", (int? residentId, LighthouseDataStore db) =>
            Results.Ok(db.ListInterventionPlans(residentId)));

        admin.MapGet("/reports/summary", (LighthouseDataStore db) => Results.Ok(db.GetReportsSummary()));

        // Legacy aliases for older clients (map residents ↔ cases naming)
        admin.MapGet("/cases", (LighthouseDataStore db) =>
            Results.Ok(db.ListResidents(null, null, null, null).Select(LegacyCaseFromSummary).ToList()));
        admin.MapPost("/cases", (LegacyCreateCaseRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.ReferenceCode))
                return Results.BadRequest(new { error = "ReferenceCode is required." });
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var created = db.CreateResident(body.ReferenceCode.Trim(), body.Status.Trim(), null);
            return Results.Created($"/api/admin/cases/{created.Id}", LegacyCaseFromSummary(created));
        });
        admin.MapPatch("/cases/{id:int}/status", (int id, UpdateCaseStatusRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.Status))
                return Results.BadRequest(new { error = "Status is required." });
            var u = db.UpdateResidentStatus(id, body.Status.Trim());
            return u is null ? Results.NotFound() : Results.Ok(LegacyCaseFromSummary(u));
        });

        admin.MapGet("/visitations", (LighthouseDataStore db) => Results.Ok(db.ListHomeVisitations(null)));
        admin.MapPost("/visitations", (LegacyCreateVisitationRequest body, LighthouseDataStore db) =>
        {
            if (string.IsNullOrWhiteSpace(body.VisitorName))
                return Results.BadRequest(new { error = "VisitorName is required." });
            if (!body.CaseId.HasValue || body.CaseId <= 0)
                return Results.BadRequest(new { error = "CaseId (resident id) is required for legacy visitation create." });
            try
            {
                var at = body.ScheduledAt;
                var created = db.CreateHomeVisitation(
                    body.CaseId.Value,
                    at,
                    body.VisitorName.Trim(),
                    string.IsNullOrWhiteSpace(body.Status) ? "Routine Follow-Up" : body.Status.Trim(),
                    null,
                    null,
                    null,
                    false,
                    false,
                    null);
                return Results.Created($"/api/admin/visitations/{created.Id}", LegacyVisitationFromDto(created));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new { error = ex.Message });
            }
        });
    }

    private static object LegacyCaseFromSummary(ResidentSummaryDto r) => new
    {
        id = r.Id.ToString(CultureInfo.InvariantCulture),
        referenceCode = r.InternalCode,
        status = r.CaseStatus,
        opened = r.DateOfAdmission ?? string.Empty,
        summary = (string?)null,
    };

    private static object LegacyVisitationFromDto(HomeVisitationDto v) => new
    {
        id = v.Id.ToString(CultureInfo.InvariantCulture),
        caseId = v.ResidentId.ToString(CultureInfo.InvariantCulture),
        visitorName = v.SocialWorker,
        scheduledAt = v.VisitDate.ToString("o"),
        status = v.VisitType,
    };
}

public sealed record CreateSupporterRequest(
    string SupporterType,
    string DisplayName,
    string? Email,
    string? Region,
    string? Status);

public sealed record PatchSupporterRequest(string? Status, string? SupporterType);

public sealed record CreateDonationRequest(
    int SupporterId,
    string DonationType,
    DateTime? DonationDate,
    decimal? Amount,
    string? CurrencyCode,
    string? Notes,
    string? CampaignName);

public sealed record CreateResidentRequest(string InternalCode, string CaseStatus, string? CaseCategory);

public sealed record UpdateCaseStatusRequest(string Status);

public sealed record CreateProcessRecordingRequest(
    int ResidentId,
    DateTime? SessionDate,
    string SocialWorker,
    string SessionType,
    int? SessionDurationMinutes,
    string? EmotionalStateObserved,
    string? EmotionalStateEnd,
    string SessionNarrative,
    string? InterventionsApplied,
    string? FollowUpActions);

public sealed record CreateHomeVisitationRequest(
    int ResidentId,
    DateTime? VisitDate,
    string SocialWorker,
    string VisitType,
    string? LocationVisited,
    string? Observations,
    string? FamilyCooperationLevel,
    bool SafetyConcernsNoted,
    bool FollowUpNeeded,
    string? FollowUpNotes);

public sealed record LegacyCreateCaseRequest(string ReferenceCode, string Status, string? Summary);

public sealed record LegacyCreateVisitationRequest(int? CaseId, string VisitorName, DateTime ScheduledAt, string Status);
