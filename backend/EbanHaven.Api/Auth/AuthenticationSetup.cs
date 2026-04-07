using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace EbanHaven.Api.Auth;

internal static class AuthenticationSetup
{
    public static void AddHavenAuthentication(this IServiceCollection services, IConfiguration config)
    {
        var jwtSecret = config["Auth:JwtSecret"];
        var issuer = config["Auth:Issuer"] ?? "EbanHaven.Api";

        if (string.IsNullOrWhiteSpace(jwtSecret))
            throw new InvalidOperationException("Missing Auth:JwtSecret configuration.");

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(2),
                };
                o.Events = new JwtBearerEvents
                {
                    OnChallenge = context =>
                    {
                        context.HandleResponse();
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return Task.CompletedTask;
                    },
                };
            });

        services.AddAuthorization();
    }
}
