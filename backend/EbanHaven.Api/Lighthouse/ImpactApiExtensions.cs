namespace EbanHaven.Api.Lighthouse;

public static class ImpactApiExtensions
{
    public static void MapImpactApi(this WebApplication app)
    {
        var g = app.MapGroup("/api/impact");
        g.MapGet("/summary", (LighthouseDataStore db) => Results.Ok(db.GetPublicImpactSummary()));
        g.MapGet("/snapshots", (LighthouseDataStore db) => Results.Ok(db.GetPublishedSnapshots()));
    }
}
