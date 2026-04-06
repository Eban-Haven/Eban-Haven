using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.Auth;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        app.MapPost("/api/auth/login", async Task<IResult> (
            HttpContext http,
            LoginRequest body,
            IOptions<StaffOptions> staffOptions) =>
        {
            if (string.IsNullOrWhiteSpace(body.Username) || string.IsNullOrWhiteSpace(body.Password))
                return Results.BadRequest(new { error = "Username and password are required." });

            var s = staffOptions.Value;
            if (!string.Equals(body.Username.Trim(), s.Username, StringComparison.Ordinal) ||
                !string.Equals(body.Password, s.Password, StringComparison.Ordinal))
                return Results.Json(new { error = "Invalid username or password." }, statusCode: StatusCodes.Status401Unauthorized);

            var claims = new List<Claim>
            {
                new(ClaimTypes.Name, body.Username.Trim()),
                new(ClaimTypes.Role, "Staff"),
            };
            var id = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await http.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(id),
                new AuthenticationProperties
                {
                    IsPersistent = body.RememberMe,
                    ExpiresUtc = body.RememberMe ? DateTimeOffset.UtcNow.AddDays(14) : DateTimeOffset.UtcNow.AddHours(8),
                });
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/auth/logout", async Task<IResult> (HttpContext http) =>
        {
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(new { ok = true });
        }).AllowAnonymous();

        app.MapGet("/api/auth/me", (ClaimsPrincipal user) =>
        {
            if (user.Identity?.IsAuthenticated != true)
                return Results.Unauthorized();
            return Results.Ok(new { user = user.Identity.Name });
        }).RequireAuthorization();
    }
}

public sealed record LoginRequest(string Username, string Password, bool RememberMe = false);
