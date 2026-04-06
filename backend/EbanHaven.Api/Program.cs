using EbanHaven.Api.Admin;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Lighthouse;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection(SiteOptions.SectionName));
builder.Services.Configure<StaffOptions>(builder.Configuration.GetSection(StaffOptions.SectionName));
builder.Services.AddSingleton<LighthouseDataStore>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "haven_staff";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/site", (IOptions<SiteOptions> options) =>
{
    var o = options.Value;
    return Results.Ok(new SiteInfo(o.Name, o.Description));
}).AllowAnonymous();

app.MapAuthEndpoints();
app.MapImpactApi();
app.MapAdminApi();

app.Run();

internal sealed class SiteOptions
{
    public const string SectionName = "Site";
    public string Name { get; set; } = "Haven of Hope";
    public string? Description { get; set; }
}

internal sealed record SiteInfo(string Name, string? Description);
