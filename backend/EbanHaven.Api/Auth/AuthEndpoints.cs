namespace EbanHaven.Api.Auth;

// Controllers are used for routing now; keep LoginRequest here for reuse.
public sealed record LoginRequest(string Username, string Password, bool RememberMe = false);
