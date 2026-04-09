using EbanHaven.Api.DataAccess;
using EbanHaven.Api.DataAccess.Entities;
using Microsoft.EntityFrameworkCore;

namespace EbanHaven.Api.SocialChat;

public sealed record PlannedSocialPostDto(
    int Id,
    string Title,
    string Platform,
    string ContentType,
    string Format,
    string? ImageIdea,
    string Caption,
    IReadOnlyList<string> Hashtags,
    string? Cta,
    string? SuggestedTime,
    DateTimeOffset? ScheduledForUtc,
    string? WhyItFits,
    string? Notes,
    string? SourcePrompt,
    string Status,
    string? FacebookPageId,
    string? FacebookPostId,
    string? FacebookMediaUrl,
    string? SchedulingError,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public sealed record CreatePlannedSocialPostCommand(
    string Title,
    string Platform,
    string ContentType,
    string Format,
    string? ImageIdea,
    string Caption,
    IReadOnlyList<string>? Hashtags,
    string? Cta,
    string? SuggestedTime,
    DateTimeOffset? ScheduledForUtc,
    string? WhyItFits,
    string? Notes,
    string? SourcePrompt);

public sealed record UpdatePlannedSocialPostCommand(
    string? Title,
    string? Caption,
    string? Hashtags,
    string? Notes,
    string? ImageIdea,
    string? Cta,
    string? SuggestedTime);

public interface IPlannedSocialPostStore
{
    Task<IReadOnlyList<PlannedSocialPostDto>> ListAsync(CancellationToken cancellationToken);
    Task<PlannedSocialPostDto?> GetAsync(int id, CancellationToken cancellationToken);
    Task<IReadOnlyList<PlannedSocialPostDto>> CreateAsync(
        IReadOnlyList<CreatePlannedSocialPostCommand> posts,
        CancellationToken cancellationToken);
    Task<PlannedSocialPostDto?> UpdateStatusAsync(int id, string status, CancellationToken cancellationToken);
    Task<PlannedSocialPostDto?> UpdateAsync(int id, UpdatePlannedSocialPostCommand command, CancellationToken cancellationToken);
    Task<PlannedSocialPostDto?> UpdateSchedulingAsync(
        int id,
        MetaScheduleResult result,
        CancellationToken cancellationToken);
    Task<bool> DeleteAsync(int id, CancellationToken cancellationToken);
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

    public async Task<PlannedSocialPostDto?> GetAsync(int id, CancellationToken cancellationToken)
    {
        var row = await db.PlannedSocialPosts
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlannedSocialPostId == id, cancellationToken);
        return row is null ? null : Map(row);
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
                Platform = NormalizePlatform(post.Platform),
                ContentType = NormalizeContentType(post.ContentType),
                Format = post.Format.Trim(),
                ImageIdea = NullIfWhiteSpace(post.ImageIdea),
                Caption = post.Caption.Trim(),
                Hashtags = JoinHashtags(post.Hashtags),
                Cta = NullIfWhiteSpace(post.Cta),
                SuggestedTime = NullIfWhiteSpace(post.SuggestedTime),
                ScheduledForUtc = post.ScheduledForUtc?.UtcDateTime,
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

    public async Task<PlannedSocialPostDto?> UpdateAsync(int id, UpdatePlannedSocialPostCommand command, CancellationToken cancellationToken)
    {
        var row = await db.PlannedSocialPosts.FirstOrDefaultAsync(x => x.PlannedSocialPostId == id, cancellationToken);
        if (row is null) return null;

        if (command.Title is not null) row.Title = command.Title.Trim();
        if (command.Caption is not null) row.Caption = command.Caption.Trim();
        if (command.Hashtags is not null) row.Hashtags = NullIfWhiteSpace(command.Hashtags);
        if (command.Notes is not null) row.Notes = NullIfWhiteSpace(command.Notes);
        if (command.ImageIdea is not null) row.ImageIdea = NullIfWhiteSpace(command.ImageIdea);
        if (command.Cta is not null) row.Cta = NullIfWhiteSpace(command.Cta);
        if (command.SuggestedTime is not null) row.SuggestedTime = NullIfWhiteSpace(command.SuggestedTime);
        row.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var row = await db.PlannedSocialPosts.FirstOrDefaultAsync(x => x.PlannedSocialPostId == id, cancellationToken);
        if (row is null) return false;
        db.PlannedSocialPosts.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PlannedSocialPostDto?> UpdateSchedulingAsync(
        int id,
        MetaScheduleResult result,
        CancellationToken cancellationToken)
    {
        var row = await db.PlannedSocialPosts.FirstOrDefaultAsync(x => x.PlannedSocialPostId == id, cancellationToken);
        if (row is null)
            return null;

        row.Status = result.Status;
        row.FacebookPostId = result.FacebookPostId;
        row.FacebookPageId = result.FacebookPageId;
        row.FacebookMediaUrl = result.FacebookMediaUrl ?? row.FacebookMediaUrl;
        row.SchedulingError = result.SchedulingError;
        row.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return Map(row);
    }

    private static PlannedSocialPostDto Map(PlannedSocialPost post) => new(
        Id: post.PlannedSocialPostId,
        Title: post.Title,
        Platform: post.Platform,
        ContentType: post.ContentType,
        Format: post.Format,
        ImageIdea: post.ImageIdea,
        Caption: post.Caption,
        Hashtags: SplitHashtags(post.Hashtags),
        Cta: post.Cta,
        SuggestedTime: post.SuggestedTime,
        ScheduledForUtc: post.ScheduledForUtc is null
            ? null
            : new DateTimeOffset(DateTime.SpecifyKind(post.ScheduledForUtc.Value, DateTimeKind.Utc)),
        WhyItFits: post.WhyItFits,
        Notes: post.Notes,
        SourcePrompt: post.SourcePrompt,
        Status: post.Status,
        FacebookPageId: post.FacebookPageId,
        FacebookPostId: post.FacebookPostId,
        FacebookMediaUrl: post.FacebookMediaUrl,
        SchedulingError: post.SchedulingError,
        CreatedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(post.CreatedAtUtc, DateTimeKind.Utc)),
        UpdatedAtUtc: new DateTimeOffset(DateTime.SpecifyKind(post.UpdatedAtUtc, DateTimeKind.Utc)));

    private static string NormalizePlatform(string? value)
    {
        var v = value?.Trim() ?? "";
        if (v.Contains("Instagram", StringComparison.OrdinalIgnoreCase)) return "Instagram";
        return "Facebook"; // default
    }

    private static string NormalizeContentType(string? value)
    {
        var v = value?.Trim() ?? "";
        if (v.Contains("Story", StringComparison.OrdinalIgnoreCase) || v.Contains("Stories", StringComparison.OrdinalIgnoreCase)) return "Story";
        if (v.Contains("Video", StringComparison.OrdinalIgnoreCase) || v.Contains("Reel", StringComparison.OrdinalIgnoreCase)) return "Video";
        return "Post"; // default covers "Post", "Static Image", "Carousel", etc.
    }

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

    public Task<PlannedSocialPostDto?> GetAsync(int id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            return Task.FromResult<PlannedSocialPostDto?>(_posts.FirstOrDefault(x => x.Id == id));
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
                    ContentType: post.ContentType.Trim(),
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
                    ScheduledForUtc: post.ScheduledForUtc,
                    WhyItFits: string.IsNullOrWhiteSpace(post.WhyItFits) ? null : post.WhyItFits.Trim(),
                    Notes: string.IsNullOrWhiteSpace(post.Notes) ? null : post.Notes.Trim(),
                    SourcePrompt: string.IsNullOrWhiteSpace(post.SourcePrompt) ? null : post.SourcePrompt.Trim(),
                    Status: "Draft",
                    FacebookPageId: null,
                    FacebookPostId: null,
                    FacebookMediaUrl: null,
                    SchedulingError: null,
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

    public Task<PlannedSocialPostDto?> UpdateAsync(int id, UpdatePlannedSocialPostCommand command, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            var index = _posts.FindIndex(x => x.Id == id);
            if (index < 0) return Task.FromResult<PlannedSocialPostDto?>(null);

            var c = _posts[index];
            var updated = c with
            {
                Title = command.Title?.Trim() ?? c.Title,
                Caption = command.Caption?.Trim() ?? c.Caption,
                Hashtags = command.Hashtags is not null
                    ? (string.IsNullOrWhiteSpace(command.Hashtags) ? [] : command.Hashtags.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries))
                    : c.Hashtags,
                Notes = command.Notes is not null ? (string.IsNullOrWhiteSpace(command.Notes) ? null : command.Notes.Trim()) : c.Notes,
                ImageIdea = command.ImageIdea is not null ? (string.IsNullOrWhiteSpace(command.ImageIdea) ? null : command.ImageIdea.Trim()) : c.ImageIdea,
                Cta = command.Cta is not null ? (string.IsNullOrWhiteSpace(command.Cta) ? null : command.Cta.Trim()) : c.Cta,
                SuggestedTime = command.SuggestedTime is not null ? (string.IsNullOrWhiteSpace(command.SuggestedTime) ? null : command.SuggestedTime.Trim()) : c.SuggestedTime,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            };
            _posts[index] = updated;
            return Task.FromResult<PlannedSocialPostDto?>(updated);
        }
    }

    public Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        lock (_lock)
        {
            var index = _posts.FindIndex(x => x.Id == id);
            if (index < 0) return Task.FromResult(false);
            _posts.RemoveAt(index);
            return Task.FromResult(true);
        }
    }

    public Task<PlannedSocialPostDto?> UpdateSchedulingAsync(
        int id,
        MetaScheduleResult result,
        CancellationToken cancellationToken)
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
                Status = result.Status,
                FacebookPageId = result.FacebookPageId,
                FacebookPostId = result.FacebookPostId,
                FacebookMediaUrl = result.FacebookMediaUrl ?? current.FacebookMediaUrl,
                SchedulingError = result.SchedulingError,
                UpdatedAtUtc = DateTimeOffset.UtcNow,
            };
            _posts[index] = updated;
            return Task.FromResult<PlannedSocialPostDto?>(updated);
        }
    }
}
