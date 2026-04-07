using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EbanHaven.Api.Auth;
using EbanHaven.Api.DataAccess;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EbanHaven.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(HavenDbContext db, IConfiguration config) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest body)
    {
        if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
            return BadRequest(new { error = "Username and password are required." });

        var email = body.Username.Trim().ToLowerInvariant();
        var user = await db.Profiles.AsNoTracking()
            .FirstOrDefaultAsync(p =>
                p.Email != null &&
                p.Email.ToLower() == email &&
                p.IsActive &&
                (p.Role == "admin" || p.Role == "social_worker" || p.Role == "staff"));
        if (user is null)
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });
        if (string.IsNullOrWhiteSpace(user.PasswordHash))
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });

        var hasher = new PasswordHasher<object>();
        var ok = hasher.VerifyHashedPassword(new object(), user.PasswordHash!, body.Password) != PasswordVerificationResult.Failed;
        if (!ok)
            return StatusCode(StatusCodes.Status401Unauthorized, new { error = "Invalid username or password." });

        var token = IssueToken(user.Email ?? email, user.FullName);
        return Ok(new { token });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        return Ok(new { ok = true });
    }

    [HttpGet("me")]
    [Authorize]
    public IActionResult Me()
    {
        if (User.Identity?.IsAuthenticated != true)
            return Unauthorized();
        var display = User.Claims.FirstOrDefault(c => c.Type == "email")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.Identity.Name;
        return Ok(new { user = display });
    }

    private string IssueToken(string username, string? displayName)
    {
        var secret = config["Auth:JwtSecret"];
        var issuer = config["Auth:Issuer"] ?? "EbanHaven.Api";
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("Missing Auth:JwtSecret configuration.");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, username),
            new(ClaimTypes.Name, displayName?.Trim() ?? username),
            new(ClaimTypes.Role, "Staff"),
        };
        var jwt = new JwtSecurityToken(
            issuer: issuer,
            audience: null,
            claims: claims,
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}

