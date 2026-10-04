using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Infrastructure.Ai;
using Xunit;

namespace ResumeTailor.UnitTests;

public class RagAndVectorSearchTests
{
    private readonly EmbeddingService _embeddingService;

    public RagAndVectorSearchTests()
    {
        var config = new ConfigurationBuilder().Build();
        _embeddingService = new EmbeddingService(new HttpClient(), config, NullLogger<EmbeddingService>.Instance);
    }

    [Fact]
    public async Task EmbeddingService_ShouldGenerateNormalizedVector()
    {
        var text = "Architected high-throughput microservices handling 50k RPS with Kubernetes and Go.";
        var vector = await _embeddingService.GenerateEmbeddingAsync(text);

        vector.Should().NotBeNull();
        vector.Length.Should().Be(1536);

        // Vector should be unit normalized
        float sumSquares = 0.0f;
        foreach (var v in vector) sumSquares += v * v;
        sumSquares.Should().BeInRange(0.95f, 1.05f);
    }

    [Fact]
    public async Task CosineSimilarity_IdenticalText_ShouldBeOne()
    {
        var text = "Expert in PostgreSQL, pgvector, and distributed systems.";
        var vectorA = await _embeddingService.GenerateEmbeddingAsync(text);
        var vectorB = await _embeddingService.GenerateEmbeddingAsync(text);

        var similarity = _embeddingService.CalculateCosineSimilarity(vectorA, vectorB);
        similarity.Should().BeApproximately(1.0, 0.001);
    }

    [Fact]
    public async Task VectorSearch_ShouldRankRelevantAchievementsHigher()
    {
        var jobDescription = "Looking for a Senior Backend Engineer with deep expertise in Kubernetes, Docker, and Microservices.";

        var achievementA = "Engineered automated container orchestration on AWS EKS Kubernetes clusters scaling 100+ microservices.";
        var achievementB = "Designed graphic UI banners and created color palettes using Adobe Photoshop and Illustrator.";

        var jobVector = await _embeddingService.GenerateEmbeddingAsync(jobDescription);
        var vectorA = await _embeddingService.GenerateEmbeddingAsync(achievementA);
        var vectorB = await _embeddingService.GenerateEmbeddingAsync(achievementB);

        var simA = _embeddingService.CalculateCosineSimilarity(jobVector, vectorA);
        var simB = _embeddingService.CalculateCosineSimilarity(jobVector, vectorB);

        simA.Should().BeGreaterThan(simB, "Technical containerization experience should match senior backend job better than graphic design");
    }

    [Fact]
    public void CareerAchievement_EmbeddingSerialization_ShouldPreserveVector()
    {
        var achievement = new CareerAchievement
        {
            Content = "Led migration of database to PostgreSQL 16 with pgvector."
        };

        var originalVector = new float[] { 0.123f, 0.456f, 0.789f };
        achievement.SetEmbedding(originalVector);

        var retrieved = achievement.GetEmbedding();
        retrieved.Should().BeEquivalentTo(originalVector);
    }
}
