using EbanHaven.Api.DataAccess;
using EbanHaven.Api.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.SocialChat;

public sealed record PlannedSocialPostDto(
    int Id,
    string Title,
    string Platform,
    string Format,
    string? ImageIdea,
    string Caption,
    IReadOnlyList<string> Hashtags,
    string? Cta,
    string? SuggestedTime,
    string? WhyItFits,
    string? Notes,
    string? SourcePrompt,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record CreatePlannedSocialPostCommand(
    string Title,
    string Platform,
    string Format,
    string? ImageIdea,
    string Caption,
    IReadOnlyList<string>? Hashtags,
    string? Cta,
    string? SuggestedTime,
    string? WhyItFits,
    string? Notes,
    string? SourcePrompt);

public interface IPlannedSocialPostStore
{
    Task<IReadOnlyList<PlannedSocialPostDto>> ListAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<PlannedSocialPostDto>> CreateAsync(
        IReadOnlyList<CreatePlannedSocialPostCommand> posts,
        CancellationToken cancellationToken);
    Task<PlannedSocialPostDto?> UpdateStatusAsync(int id, string status, CancellationToken cancellationToken);
}

public sealed class DbPlannedSocialPostStore(HavenDbContext db) : IPlannedSocialPostStore
{
    public async Task<IReadOnlyList<PlannedSocialPostDto>> ListAsync(CancellationToken cancellationToken)
    {
        var rows = await db.PlannedSocialPosts
            .AsNoTracking()
            .OrderByDescending(x => x.UpdatedAtUtc)
            .ThenByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return rows.Select(Map).ToArray();
    }

    public async Task<IReadOnlyList<PlannedSocialPostDto>> CreateAsync(
        IReadOnlyList<CreatePlannedSocialPostCommand> posts,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var rows = posts
            .Where(static post =>
                !string.IsNullOrWhiteSpace(post.Title) &&
                !string.IsNullOrWhiteSpace(post.Platform) &&
                !string.IsNullOrWhiteSpace(post.Format) &&
                !string.IsNullOrWhiteSpace(post.Caption))
            .Select(post => new PlannedSocialPost
            {
                Title = post.Title.Trim(),
                Platform = post.Platform.Trim(),
                Format = post.Format.Trim(),
                ImageIdea = NullIfWhiteSpace(post.ImageIdea),
                Caption = post.Caption.Trim(),
                Hashtags = JoinHashtags(post.Hashtags),
                Cta = NullIfWhiteSpace(post.Cta),
                SuggestedTime = NullIfWhiteSpace(post.SuggestedTime),
                WhyItFits = NullIfWhiteSpace(post.WhyItFits),
                Notes = NullIfWhiteSpace(post.Notes),
                SourcePrompt = NullIfWhiteSpace(post.SourcePrompt),
                Status = "Draft",
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
            })
            .ToList();

        if (rows.Count == 0)
            return [];

        await db.PlannedSocialPosts.AddRangeAsync(rows, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return rows.Select(Map).ToArray();
    }

    public async Task<PlannedSocialPostDto?> UpdateStatusAsync(int id, string status, CancellationToken cancellationToken)
    {
        var row = await db.PlannedSocialPosts.FirstOrDefaultAsync(x => x.PlannedSocialPostId == id, cancellationToken);
        if (row is null)
            return null;

        row.Status = string.IsNullOrWhiteSpace(status) ? row.Status : status.Trim();
        row.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    private static PlannedSocialPostDto Map(PlannedSocialPost post) => new(
        Id: post.PlannedSocialPostId,
        Title: post.Title,
        Platform: post.Platform,
        Format: post.Format,
        ImageIdea: post.ImageIdea,
        Caption: post.Caption,
        Hashtags: SplitHashtags(post.Hashtags),
        Cta: post.Cta,
        SuggestedTime: post.SuggestedTime,
        WhyItFits: post.WhyItFits,
        Notes: post.Notes,
        SourcePrompt: post.SourcePrompt,
        Status: post.Status,
        CreatedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(post.CreatedAtUtc, DateTimeKind.Utc)),
        UpdatedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(post.UpdatedAtUtc, DateTimeKind.Utc)));

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? JoinHashtags(IReadOnlyList<string>? hashtags)
    {
        if (hashtags is null || hashtags.Count == 0)
            return null;

        var cleaned = hashtags
            .Select(static tag => tag?.Trim())
            .Where(static tag => !string.IsNullOrWhiteSpace(tag))
            .Select(static tag => tag!.StartsWith('#') ? tag : $"#{tag}")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return cleaned.Length == 0 ? null : string.Join(' ', cleaned);
    }

    private static IReadOnlyList<string> SplitHashtags(string? hashtags) =>
        string.IsNullOrWhiteSpace(hashtags)
            ? []
            : hashtags.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

public sealed class InMemoryPlannedSocialPostStore : IPlannedSocialPostStore
{
    private readonly Lock _lock = new();
    private readonly List<PlannedSocialPostDto> _posts = [];
    private int _nextId = 1;

    public Task<IReadOnlyList<PlannedSocialPostDto>> ListAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            return Task.FromResult<IReadOnlyList<PlannedSocialPostDto>>(
                _posts
                    .OrderByDescending(x => x.UpdatedAtUtc)
                    .ThenByDescending(x => x.CreatedAtUtc)
                    .ToArray());
        }
    }

    public Task<IReadOnlyList<PlannedSocialPostDto>> CreateAsync(
        IReadOnlyList<CreatePlannedSocialPostCommand> posts,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var now = DateTimeOffset.UtcNow;

        lock (_lock)
        {
            var created = posts
                .Where(static post =>
                    !string.IsNullOrWhiteSpace(post.Title) &&
                    !string.IsNullOrWhiteSpace(post.Platform) &&
                    !string.IsNullOrWhiteSpace(post.Format) &&
                    !string.IsNullOrWhiteSpace(post.Caption))
                .Select(post => new PlannedSocialPostDto(
                    Id: _nextId++,
                    Title: post.Title.Trim(),
                    Platform: post.Platform.Trim(),
                    Format: post.Format.Trim(),
                    ImageIdea: string.IsNullOrWhiteSpace(post.ImageIdea) ? null : post.ImageIdea.Trim(),
                    Caption: post.Caption.Trim(),
                    Hashtags: post.Hashtags?
                        .Select(static tag => tag?.Trim())
                        .Where(static tag => !string.IsNullOrWhiteSpace(tag))
                        .Select(static tag => tag!.StartsWith('#') ? tag : $"#{tag}")
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToArray() ?? [],
                    Cta: string.IsNullOrWhiteSpace(post.Cta) ? null : post.Cta.Trim(),
                    SuggestedTime: string.IsNullOrWhiteSpace(post.SuggestedTime) ? null : post.SuggestedTime.Trim(),
                    WhyItFits: string.IsNullOrWhiteSpace(post.WhyItFits) ? null : post.WhyItFits.Trim(),
                    Notes: string.IsNullOrWhiteSpace(post.Notes) ? null : post.Notes.Trim(),
                    SourcePrompt: string.IsNullOrWhiteSpace(post.SourcePrompt) ? null : post.SourcePrompt.Trim(),
                    Status: "Draft",
                    CreatedAtUtc: now,
                    UpdatedAtUtc: now))
                .ToArray();

            _posts.AddRange(created);
            return Task.FromResult<IReadOnlyList<PlannedSocialPostDto>>(created);
        }
    }

    public Task<PlannedSocialPostDto?> UpdateStatusAsync(int id, string status, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            var index = _posts.FindIndex(x => x.Id == id);
            if (index < 0)
                return Task.FromResult<PlannedSocialPostDto?>(null);

            var current = _posts[index];
            var updated = current with
            {
                Status = string.IsNullOrWhiteSpace(status) ? current.Status : status.Trim(),
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            };
            _posts[index] = updated;
            return Task.FromResult<PlannedSocialPostDto?>(updated);
        }
    }
}
