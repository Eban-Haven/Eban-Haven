namespace EbanHaven.Api.Configuration;

public sealed class MetaOptions
{
    public const string SectionName = "Meta";

    public string GraphApiBaseUrl { get; set; } = "https://graph.facebook.com";
    public string GraphApiVersion { get; set; } = "v23.0";
    public string? PageId { get; set; }
    public string? PageAccessToken { get; set; }
}
