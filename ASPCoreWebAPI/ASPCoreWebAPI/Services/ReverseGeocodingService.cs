using System.Collections.Concurrent;
using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ASPCoreWebAPI.Services
{
    public interface IReverseGeocodingService
    {
        Task<string?> ResolveAsync(double latitude, double longitude, CancellationToken cancellationToken = default);
    }

    public class ReverseGeocodingService : IReverseGeocodingService
    {
        private readonly HttpClient _httpClient;
        private static readonly ConcurrentDictionary<string, string> Cache = new();
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public ReverseGeocodingService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<string?> ResolveAsync(
            double latitude,
            double longitude,
            CancellationToken cancellationToken = default)
        {
            var cacheKey = string.Create(
                CultureInfo.InvariantCulture,
                $"{Math.Round(latitude, 5):F5},{Math.Round(longitude, 5):F5}");

            if (Cache.TryGetValue(cacheKey, out var cached))
                return string.IsNullOrEmpty(cached) ? null : cached;

            try
            {
                var lat = latitude.ToString("F6", CultureInfo.InvariantCulture);
                var lon = longitude.ToString("F6", CultureInfo.InvariantCulture);
                var path = $"reverse?format=jsonv2&lat={lat}&lon={lon}&zoom=18&addressdetails=1";

                using var response = await _httpClient.GetAsync(path, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    Cache[cacheKey] = string.Empty;
                    return null;
                }

                var payload = await response.Content.ReadFromJsonAsync<NominatimResponse>(
                    JsonOptions,
                    cancellationToken);

                var name = BuildName(payload?.Address, payload?.DisplayName);
                Cache[cacheKey] = name ?? string.Empty;
                return name;
            }
            catch
            {
                Cache[cacheKey] = string.Empty;
                return null;
            }
        }

        private static string? BuildName(NominatimAddress? address, string? displayName)
        {
            var displayParts = (displayName ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (address is not null)
            {
                var area = FirstNonEmpty(
                    address.Neighbourhood,
                    address.Suburb,
                    address.Hamlet,
                    address.CityDistrict,
                    address.Industrial,
                    address.Commercial,
                    address.Road,
                    address.Village,
                    address.Town);

                var city = FirstNonEmpty(
                    address.City,
                    address.Municipality,
                    address.Town,
                    address.Village,
                    address.County);

                var state = FirstNonEmpty(address.State, address.StateDistrict);

                if (area is null
                    && displayParts.Length > 0
                    && !IsOneOf(displayParts[0], city, state, address.County, address.Postcode, address.Country))
                {
                    area = displayParts[0];
                }

                var parts = new[] { area, city, state }
                    .Where(part => !string.IsNullOrWhiteSpace(part))
                    .Select(part => part!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                if (parts.Length > 0)
                    return string.Join(", ", parts);
            }

            if (displayParts.Length > 0)
                return string.Join(", ", displayParts.Take(3));

            return null;
        }

        private static string? FirstNonEmpty(params string?[] values) =>
            values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();

        private static bool IsOneOf(string value, params string?[] candidates) =>
            candidates.Any(candidate =>
                !string.IsNullOrWhiteSpace(candidate)
                && string.Equals(value, candidate!.Trim(), StringComparison.OrdinalIgnoreCase));

        public sealed class NominatimResponse
        {
            [JsonPropertyName("display_name")]
            public string? DisplayName { get; set; }

            [JsonPropertyName("address")]
            public NominatimAddress? Address { get; set; }
        }

        public sealed class NominatimAddress
        {
            [JsonPropertyName("neighbourhood")]
            public string? Neighbourhood { get; set; }

            [JsonPropertyName("suburb")]
            public string? Suburb { get; set; }

            [JsonPropertyName("village")]
            public string? Village { get; set; }

            [JsonPropertyName("town")]
            public string? Town { get; set; }

            [JsonPropertyName("hamlet")]
            public string? Hamlet { get; set; }

            [JsonPropertyName("city_district")]
            public string? CityDistrict { get; set; }

            [JsonPropertyName("city")]
            public string? City { get; set; }

            [JsonPropertyName("municipality")]
            public string? Municipality { get; set; }

            [JsonPropertyName("county")]
            public string? County { get; set; }

            [JsonPropertyName("state_district")]
            public string? StateDistrict { get; set; }

            [JsonPropertyName("state")]
            public string? State { get; set; }

            [JsonPropertyName("industrial")]
            public string? Industrial { get; set; }

            [JsonPropertyName("commercial")]
            public string? Commercial { get; set; }

            [JsonPropertyName("road")]
            public string? Road { get; set; }

            [JsonPropertyName("postcode")]
            public string? Postcode { get; set; }

            [JsonPropertyName("country")]
            public string? Country { get; set; }
        }
    }
}
