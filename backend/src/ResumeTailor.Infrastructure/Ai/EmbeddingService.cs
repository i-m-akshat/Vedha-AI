using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Ai;

public class EmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmbeddingService> _logger;
    private const int EmbeddingDimension = 1536;

    public EmbeddingService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<EmbeddingService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<float[]> GenerateEmbeddingAsync(string text, string? customApiKey = null, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
            return new float[EmbeddingDimension];

        // 1. Try Gemini Embeddings if Gemini Key is available
        var geminiKey = customApiKey ?? _configuration["AiSettings:GeminiApiKey"] ?? _configuration["GEMINI_API_KEY"];
        if (!string.IsNullOrWhiteSpace(geminiKey))
        {
            try
            {
                var geminiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={geminiKey}";
                var payload = new
                {
                    model = "models/text-embedding-004",
                    content = new
                    {
                        parts = new[] { new { text } }
                    }
                };

                using var request = new HttpRequestMessage(HttpMethod.Post, geminiUrl)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };

                var response = await _httpClient.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(responseJson);
                    if (doc.RootElement.TryGetProperty("embedding", out var emb) &&
                        emb.TryGetProperty("values", out var vals))
                    {
                        var list = new List<float>();
                        foreach (var val in vals.EnumerateArray())
                        {
                            list.Add(val.GetSingle());
                        }

                        // Pad or truncate to standard 1536 dimension for pgvector
                        return StandardizeDimension(list.ToArray(), EmbeddingDimension);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini embedding generation failed. Falling back to deterministic vectorizer.");
            }
        }

        // 2. Try OpenAI text-embedding-3-small if OpenAI key is available
        var openAiKey = customApiKey ?? _configuration["AiSettings:OpenAiApiKey"] ?? _configuration["OPENAI_API_KEY"];
        if (!string.IsNullOrWhiteSpace(openAiKey))
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/embeddings");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", openAiKey);
                var payload = new
                {
                    input = text,
                    model = "text-embedding-3-small",
                    dimensions = EmbeddingDimension
                };
                request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

                var response = await _httpClient.SendAsync(request, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    var responseJson = await response.Content.ReadAsStringAsync(cancellationToken);
                    using var doc = JsonDocument.Parse(responseJson);
                    if (doc.RootElement.TryGetProperty("data", out var dataArr) && dataArr.GetArrayLength() > 0)
                    {
                        var embeddingArr = dataArr[0].GetProperty("embedding");
                        var list = new List<float>();
                        foreach (var val in embeddingArr.EnumerateArray())
                        {
                            list.Add(val.GetSingle());
                        }
                        return list.ToArray();
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "OpenAI embedding generation failed. Falling back to deterministic vectorizer.");
            }
        }

        // 3. Resilient Deterministic Semantic Token Vectorizer (Fallback)
        return GenerateDeterministicVector(text, EmbeddingDimension);
    }

    public double CalculateCosineSimilarity(float[] vectorA, float[] vectorB)
    {
        if (vectorA == null || vectorB == null || vectorA.Length == 0 || vectorB.Length == 0)
            return 0.0;

        int minLen = Math.Min(vectorA.Length, vectorB.Length);
        double dotProduct = 0.0;
        double normA = 0.0;
        double normB = 0.0;

        for (int i = 0; i < minLen; i++)
        {
            dotProduct += vectorA[i] * vectorB[i];
            normA += vectorA[i] * vectorA[i];
            normB += vectorB[i] * vectorB[i];
        }

        if (normA == 0.0 || normB == 0.0)
            return 0.0;

        return dotProduct / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }

    private static float[] StandardizeDimension(float[] source, int targetDimension)
    {
        if (source.Length == targetDimension) return source;
        var result = new float[targetDimension];
        int copyLen = Math.Min(source.Length, targetDimension);
        Array.Copy(source, result, copyLen);
        return result;
    }

    private static readonly HashSet<string> StopWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "the", "and", "with", "for", "are", "you", "from", "that", "this", "all", "was", "has", "have"
    };

    private static uint ComputeFnv1a(string str)
    {
        uint hash = 2166136261;
        foreach (char c in str)
        {
            hash = (hash ^ c) * 16777619;
        }
        return hash;
    }

    private static float[] GenerateDeterministicVector(string text, int dimension)
    {
        var vector = new float[dimension];
        var tokens = text.ToLowerInvariant()
            .Split(new[] { ' ', '\r', '\n', '\t', ',', '.', ';', ':', '-', '(', ')', '[', ']', '/', '"', '\'' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(t => t.Length > 2 && !StopWords.Contains(t))
            .ToArray();

        if (tokens.Length == 0) return vector;

        for (int i = 0; i < tokens.Length; i++)
        {
            var token = tokens[i];
            uint hash = ComputeFnv1a(token);
            int bucket = (int)(hash % (uint)dimension);
            vector[bucket] += 1.0f;

            if (i < tokens.Length - 1)
            {
                var bigram = token + "_" + tokens[i + 1];
                uint bHash = ComputeFnv1a(bigram);
                int bBucket = (int)(bHash % (uint)dimension);
                vector[bBucket] += 1.5f;
            }
        }

        // L2 Normalize
        float sumSquares = 0.0f;
        for (int i = 0; i < dimension; i++)
        {
            sumSquares += vector[i] * vector[i];
        }

        if (sumSquares > 0.0f)
        {
            float norm = MathF.Sqrt(sumSquares);
            for (int i = 0; i < dimension; i++)
            {
                vector[i] /= norm;
            }
        }

        return vector;
    }
}
