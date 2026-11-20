using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Hrms.Tests.Infrastructure;

public readonly record struct ApiResponse(int Status, string Text, JsonNode? Json)
{
    public bool IsSuccess => Status is >= 200 and < 300;
}

[Collection(HrmsCollection.Name)]
public abstract class ApiTestBase
{
    protected readonly TestHost Host;

    protected ApiTestBase(TestHost host) => Host = host;

    protected Task SeedAsync() => Host.SeedAsync();

    protected HttpClient Owner() => Host.Owner();
    protected HttpClient Hr() => Host.Hr();
    protected HttpClient Employee(int employeeId) => Host.Employee(employeeId);
    protected HttpClient Anonymous() => Host.Anonymous();

    protected static async Task<ApiResponse> SendAsync(
        HttpClient client,
        HttpMethod method,
        string url,
        object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);

        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();

        JsonNode? json = null;
        if (!string.IsNullOrWhiteSpace(text))
        {
            try { json = JsonNode.Parse(text); }
            catch { /* non-JSON body */ }
        }

        return new ApiResponse((int)response.StatusCode, text, json);
    }

    protected static Task<ApiResponse> GetAsync(HttpClient client, string url) =>
        SendAsync(client, HttpMethod.Get, url);

    protected static Task<ApiResponse> PostAsync(HttpClient client, string url, object? body = null) =>
        SendAsync(client, HttpMethod.Post, url, body);

    protected static Task<ApiResponse> PutAsync(HttpClient client, string url, object? body = null) =>
        SendAsync(client, HttpMethod.Put, url, body);

    protected static Task<ApiResponse> PatchAsync(HttpClient client, string url, object? body = null) =>
        SendAsync(client, HttpMethod.Patch, url, body);

    protected static Task<ApiResponse> DeleteAsync(HttpClient client, string url) =>
        SendAsync(client, HttpMethod.Delete, url);

    protected static int Count(JsonNode? array) => array is JsonArray list ? list.Count : -1;

    protected static int IdOf(ApiResponse response) =>
        response.Json?["id"]?.GetValue<int>() ?? -1;

    protected static async Task<long> ScalarAsync(string sql) => await TestDb.ScalarAsync(sql);
}
