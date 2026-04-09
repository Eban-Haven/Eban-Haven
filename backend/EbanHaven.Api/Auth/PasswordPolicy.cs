using Microsoft.AspNetCore.Identity;

namespace EbanHaven.Api.Auth;

/// <summary>
/// Applies <see cref="PasswordOptions"/> from <c>Configure&lt;IdentityOptions&gt;</c> in <c>Program.cs</c>
/// (custom auth still uses <see cref="PasswordHasher{TUser}"/>; this mirrors Identity password validation).
/// </summary>
public static class PasswordPolicy
{
    public static string? Validate(string? password, PasswordOptions options)
    {
        if (string.IsNullOrWhiteSpace(password))
            return "Password is required.";

        if (password.Length < options.RequiredLength)
            return $"Passwords must be at least {options.RequiredLength} characters.";

        if (options.RequiredUniqueChars > 0)
        {
            var unique = password.Distinct().Count();
            if (unique < options.RequiredUniqueChars)
                return $"Passwords must use at least {options.RequiredUniqueChars} different characters.";
        }

        if (options.RequireDigit && !password.Any(char.IsDigit))
            return "Passwords must have at least one digit ('0'-'9').";

        if (options.RequireLowercase && !password.Any(char.IsLower))
            return "Passwords must have at least one lowercase ('a'-'z').";

        if (options.RequireUppercase && !password.Any(char.IsUpper))
            return "Passwords must have at least one uppercase ('A'-'Z').";

        if (options.RequireNonAlphanumeric && password.All(char.IsLetterOrDigit))
            return "Passwords must have at least one non-alphanumeric character.";

        return null;
    }
}
