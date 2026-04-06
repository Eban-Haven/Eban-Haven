using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;

namespace EbanHaven.Api.Lighthouse;

internal static class CsvTableReader
{
    public static List<Dictionary<string, string>> ReadTable(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException("Missing dataset file: " + path, path);

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HeaderValidated = null,
            MissingFieldFound = null,
            BadDataFound = null,
        };

        using var reader = new StreamReader(path);
        using var csv = new CsvReader(reader, config);
        if (!csv.Read())
            return [];
        csv.ReadHeader();
        var headers = csv.HeaderRecord ?? [];
        var rows = new List<Dictionary<string, string>>();
        while (csv.Read())
        {
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var h in headers)
            {
                if (string.IsNullOrEmpty(h))
                    continue;
                row[h] = csv.GetField(h) ?? string.Empty;
            }
            rows.Add(row);
        }
        return rows;
    }
}
