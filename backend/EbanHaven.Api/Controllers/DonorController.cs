using System.Security.Claims;
using EbanHaven.Api.Auth;
using EbanHaven.Api.DataAccess;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/donor")]
[Authorize(Policy = DonorOnlyPolicy.Name)]
public sealed class DonorController(ILighthouseRepository repo, HavenDbContext db) : ControllerBase
{
    [HttpGet("dashboard")]
    public IActionResult Dashboard()
    {
        var email =
            User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? User.FindFirst("sub")?.Value;

        var designationOptions = repo.ListAllocations(null, null)
            .Select(a => a.ProgramArea?.Trim())
            .Where(a => !string.IsNullOrWhiteSpace(a))
            .Concat(
                repo.ListDonations(null)
                    .Select(d => d.CampaignName?.Trim())
                    .Where(c => !string.IsNullOrWhiteSpace(c)))
            .Append("General Fund")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value)
            .ToArray();

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var supporter = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        if (supporter is null)
        {
            return Ok(new
            {
                email,
                supporter = (object?)null,
                donations = Array.Empty<DonationDto>(),
                allocations = Array.Empty<DonationAllocationDto>(),
                designationOptions,
            });
        }

        var donations = repo.ListDonations(supporter.Id)
            .OrderByDescending(d => d.DonationDate)
            .ToArray();

        var donationIds = donations.Select(d => d.Id).ToHashSet();
        var allocations = repo.ListAllocations(null, null)
            .Where(a => donationIds.Contains(a.DonationId))
            .OrderByDescending(a => a.AllocationDate)
            .ToArray();

        return Ok(new
        {
            email,
            supporter,
            donations,
            allocations,
            designationOptions,
        });
    }

    [HttpPost("donations")]
    public IActionResult CreateDonation([FromBody] DonorCreateDonationRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.DonationType))
            return BadRequest(new { error = "DonationType is required." });

        var email =
            User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.FindFirst("email")?.Value
            ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var supporter = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        if (supporter is null)
            return BadRequest(new { error = "No supporter profile matches your email. Ask staff to add your email to your supporter record." });

        try
        {
            var dt = body.DonationDate ?? DateTime.UtcNow;
            var created = repo.CreateDonation(
                supporter.Id,
                body.DonationType.Trim(),
                dt,
                body.Amount,
                body.CurrencyCode,
                body.Notes,
                body.CampaignName);
            return Created($"/api/donor/donations/{created.Id}", created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("account")]
    public async Task<IActionResult> GetAccount(CancellationToken cancellationToken)
    {
        var email = GetDonorEmail();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var normalized = email.Trim().ToLowerInvariant();
        var profile = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Email != null && p.Email.ToLower() == normalized,
                cancellationToken);

        var supporter = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        return Ok(new
        {
            email = normalized,
            fullName = profile?.FullName,
            supporter,
        });
    }

    [HttpPatch("account")]
    public async Task<IActionResult> PatchAccount([FromBody] DonorPatchAccountRequest body, CancellationToken cancellationToken)
    {
        var email = GetDonorEmail();
        if (string.IsNullOrWhiteSpace(email))
            return Unauthorized(new { error = "A valid donor email claim is required." });

        var normalized = email.Trim().ToLowerInvariant();
        var profile = await db.Profiles.FirstOrDefaultAsync(
            p => p.Email != null && p.Email.ToLower() == normalized,
            cancellationToken);

        if (profile is null)
            return BadRequest(new { error = "No account profile was found for your login. Contact support." });

        if (body.FullName is not null)
            profile.FullName = string.IsNullOrWhiteSpace(body.FullName) ? null : body.FullName.Trim();

        var supporterDto = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        var fields = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (body.DisplayName is not null) fields["display_name"] = body.DisplayName;
        if (body.FirstName is not null) fields["first_name"] = body.FirstName;
        if (body.LastName is not null) fields["last_name"] = body.LastName;
        if (body.Phone is not null) fields["phone"] = body.Phone;
        if (body.Region is not null) fields["region"] = body.Region;
        if (body.Country is not null) fields["country"] = body.Country;
        if (body.OrganizationName is not null) fields["organization_name"] = body.OrganizationName;

        if (supporterDto is not null && fields.Count > 0)
            repo.PatchSupporterFields(supporterDto.Id, fields);
        else if (body.FullName is not null)
            await db.SaveChangesAsync(cancellationToken);

        var profileOut = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(
                p => p.Email != null && p.Email.ToLower() == normalized,
                cancellationToken);

        var supporterOut = repo.ListSupporters()
            .FirstOrDefault(s => string.Equals(s.Email, email, StringComparison.OrdinalIgnoreCase));

        return Ok(new
        {
            email = normalized,
            fullName = profileOut?.FullName,
            supporter = supporterOut,
        });
    }

    private string? GetDonorEmail() =>
        User.FindFirst(ClaimTypes.Email)?.Value
        ?? User.FindFirst("email")?.Value
        ?? User.FindFirst("sub")?.Value;
}

public sealed record DonorPatchAccountRequest(
    string? FullName,
    string? DisplayName,
    string? FirstName,
    string? LastName,
    string? Phone,
    string? Region,
    string? Country,
    string? OrganizationName);

public sealed record DonorCreateDonationRequest(
    string DonationType,
    DateTime? DonationDate,
    decimal? Amount,
    string? CurrencyCode,
    string? Notes,
    string? CampaignName);
