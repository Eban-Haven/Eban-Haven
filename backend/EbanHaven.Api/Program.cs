using EbanHaven.Api.Admin;
using EbanHaven.Api.Auth;
using EbanHaven.Api.Configuration;
using EbanHaven.Api.Lighthouse;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<SiteOptions>(builder.Configuration.GetSection(SiteOptions.SectionName));
builder.Services.Configure<StaffOptions>(builder.Configuration.GetSection(StaffOptions.SectionName));
builder.Services.Configure<CorsOptions>(builder.Configuration.GetSection(CorsOptions.SectionName));
builder.Services.AddSingleton<LighthouseDataStore>();

builder.Services.AddHavenAuthentication(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        var cors = builder.Configuration.GetSection(CorsOptions.SectionName).Get<CorsOptions>() ?? new CorsOptions();
        var origins = cors.Origins;
        if (origins.Length == 0)
            origins = ["http://localhost:5173", "http://127.0.0.1:5173"];
        policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials();
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
