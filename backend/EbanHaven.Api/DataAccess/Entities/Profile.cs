using System.ComponentModel.DataAnnotations.Schema;

namespace EbanHaven.Api.DataAccess.Entities;

public sealed class Profile
{
    // Supabase uses UUIDs for profile IDs (FK to auth.users).
    [Column("id")] public Guid Id { get; set; }
    [Column("email")] public string? Email { get; set; }
    [Column("full_name")] public string? FullName { get; set; }
    // `role` is a Postgres enum (public.app_role). We treat it as a string in the app.
    [Column("role")] public string Role { get; set; } = "";

    // Username may exist in your schema, but Option 2 login uses Email (Choice B).
    [Column("username")] public string? Username { get; set; }
    [Column("password_hash")] public string? PasswordHash { get; set; }
    [Column("is_active")] public bool IsActive { get; set; } = true;
}

