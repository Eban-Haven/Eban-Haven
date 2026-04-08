using System.Net.Http.Json;
using System.Text.Json.Serialization;
using EbanHaven.Api.Configuration;
using Microsoft.Extensions.Options;

namespace EbanHaven.Api.SocialChat;

public sealed record MetaScheduleResult(
    string Status,
    string? FacebookPostId,
    string? FacebookPageId,
    string? FacebookMediaUrl,
    string? SchedulingError);

public interface IMetaSchedulingService
{
    Task<MetaScheduleResult> ScheduleAsync(PlannedSocialPostDto post, CancellationToken cancellationToken);
}

public sealed class MetaSchedulingService(
    IHttpClientFactory httpClientFactory,
    IOptions<MetaOptions> options) : IMetaSchedulingService
{
    private readonly MetaOptions _options = options.Value;

    public async Task<MetaScheduleResult> ScheduleAsync(PlannedSocialPostDto post, CancellationToken cancellationToken)
    {
        if (!string.Equals(post.Platform, "Facebook", StringComparison.OrdinalIgnoreCase))
        {
            return new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: post.FacebookPageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: "Only Facebook scheduling is supported by this integration.");
        }

        if (string.IsNullOrWhiteSpace(_options.PageId) || string.IsNullOrWhiteSpace(_options.PageAccessToken))
        {
            return new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: "Meta PageId or PageAccessToken is not configured on the API host.");
        }

        if (!post.ScheduledForUtc.HasValue)
        {
            return new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: "scheduled_for_utc is required before sending a post to Facebook.");
        }

        return post.ContentType.Trim().ToLowerInvariant() switch
        {
            "post" => await ScheduleFeedPostAsync(post, cancellationToken),
            "video" => await ScheduleVideoPostAsync(post, cancellationToken),
            "story" => new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: "Facebook Story scheduling is not implemented in this MVP."),
            _ => new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: $"Unsupported Facebook content type '{post.ContentType}'."),
        };
    }

    private async Task<MetaScheduleResult> ScheduleFeedPostAsync(PlannedSocialPostDto post, CancellationToken cancellationToken)
    {
        var endpoint = BuildEndpoint("feed");
        var payload = new Dictionary<string, string?>
        {
            ["message"] = BuildMessage(post),
            ["published"] = "false",
            ["scheduled_publish_time"] = ToUnixSeconds(post.ScheduledForUtc!.Value).ToString(),
            ["access_token"] = _options.PageAccessToken,
        };

        return await SendScheduleRequestAsync(endpoint, payload, post, cancellationToken);
    }

    private async Task<MetaScheduleResult> ScheduleVideoPostAsync(PlannedSocialPostDto post, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(post.FacebookMediaUrl))
        {
            return new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: "facebook_media_url is required for Facebook video scheduling.");
        }

        var endpoint = BuildEndpoint("videos");
        var payload = new Dictionary<string, string?>
        {
            ["description"] = BuildMessage(post),
            ["published"] = "false",
            ["scheduled_publish_time"] = ToUnixSeconds(post.ScheduledForUtc!.Value).ToString(),
            ["file_url"] = post.FacebookMediaUrl,
            ["access_token"] = _options.PageAccessToken,
        };

        return await SendScheduleRequestAsync(endpoint, payload, post, cancellationToken);
    }

    private async Task<MetaScheduleResult> SendScheduleRequestAsync(
        string endpoint,
        Dictionary<string, string?> payload,
        PlannedSocialPostDto post,
        CancellationToken cancellationToken)
    {
        using var content = new FormUrlEncodedContent(
            payload
                .Where(static pair => !string.IsNullOrWhiteSpace(pair.Value))
                .Select(pair => new KeyValuePair<string, string>(pair.Key, pair.Value!)));

        var client = httpClientFactory.CreateClient("MetaGraph");
        using var response = await client.PostAsync(endpoint, content, cancellationToken);
        var body = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            return new MetaScheduleResult(
                Status: "Failed",
                FacebookPostId: null,
                FacebookPageId: _options.PageId,
                FacebookMediaUrl: post.FacebookMediaUrl,
                SchedulingError: $"Meta API error {(int)response.StatusCode}: {body}");
        }

        var parsed = await response.Content.ReadFromJsonAsync<MetaGraphIdResponse>(cancellationToken: cancellationToken);
        return new MetaScheduleResult(
            Status: "Scheduled",
            FacebookPostId: parsed?.Id,
            FacebookPageId: _options.PageId,
            FacebookMediaUrl: post.FacebookMediaUrl,
            SchedulingError: null);
    }

    private string BuildEndpoint(string edge)
    {
        var baseUrl = _options.GraphApiBaseUrl.TrimEnd('/');
        var version = _options.GraphApiVersion.Trim('/');
        return $"{baseUrl}/{version}/{_options.PageId}/{edge}";
    }

    private static long ToUnixSeconds(DateTimeOffset value) => value.ToUnixTimeSeconds();

    private static string BuildMessage(PlannedSocialPostDto post)
    {
        var hashtags = post.Hashtags.Count > 0 ? $"\n\n{string.Join(' ', post.Hashtags)}" : string.Empty;
        return $"{post.Caption}{hashtags}";
    }

    private sealed record MetaGraphIdResponse([property: JsonPropertyName("id")] string? Id);
}
