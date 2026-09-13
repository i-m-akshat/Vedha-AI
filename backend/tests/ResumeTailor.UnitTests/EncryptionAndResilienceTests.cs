using Microsoft.Extensions.Configuration;
using ResumeTailor.Domain.ValueObjects;
using ResumeTailor.Infrastructure.AtsEngine;
using ResumeTailor.Infrastructure.Security;
using Xunit;

namespace ResumeTailor.UnitTests;

public class EncryptionAndResilienceTests
{
    [Fact]
    public void AesGcmEncryptionService_ShouldEncryptAndDecryptCorrectly()
    {
        // Arrange
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"SecuritySettings:DataProtectionKey", "Test_Secret_Key_For_Unit_Testing_32BytesLong!"}
        };

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        var service = new AesGcmEncryptionService(config);
        var originalText = "test-sensitive-sample-payload-123456789";

        // Act
        var encrypted = service.Encrypt(originalText);
        var decrypted = service.Decrypt(encrypted);

        // Assert
        Assert.NotNull(encrypted);
        Assert.NotEqual(originalText, encrypted);
        Assert.Equal(originalText, decrypted);
    }

    [Fact]
    public void AesGcmEncryptionService_Mask_ShouldMaskSecret()
    {
        // Arrange
        var config = new ConfigurationBuilder().Build();
        var service = new AesGcmEncryptionService(config);
        var secret = "test-provider-sample-secret-value-987654";

        // Act
        var masked = service.Mask(secret);

        // Assert
        Assert.Contains("••••••••", masked);
        Assert.EndsWith(secret[^4..], masked);
    }

    [Fact]
    public void AtsScoringEngine_ShouldPassWhenMetricsMatchMaster()
    {
        // Arrange
        var engine = new AtsScoringEngine();

        var master = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Microsoft",
                    Role = "Senior Engineer",
                    Highlights = new List<string>
                    {
                        "Increased API throughput by 40% and reduced p99 latency to 15ms.",
                        "Managed a cloud budget of $500k across 3 regions."
                    }
                }
            }
        };

        var tailored = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Microsoft",
                    Role = "Senior Engineer",
                    Highlights = new List<string>
                    {
                        "Engineered microservices that boosted throughput by 40% while stewarding $500k cloud infrastructure."
                    }
                }
            }
        };

        // Act
        var result = engine.ValidateTruthPreservation(master, tailored);

        // Assert
        Assert.True(result.IsSuccess);
    }

    [Fact]
    public void AtsScoringEngine_ShouldFailWhenTailoredResumeExaggeratesMetrics()
    {
        // Arrange
        var engine = new AtsScoringEngine();

        var master = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Google",
                    Role = "Software Engineer",
                    Highlights = new List<string>
                    {
                        "Improved system query latency by 15% using Redis caching."
                    }
                }
            }
        };

        var tailored = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Google",
                    Role = "Software Engineer",
                    Highlights = new List<string>
                    {
                        "Architected caching layers that slashed system latency by 85%." // Metric exaggerated from 15% to 85%!
                    }
                }
            }
        };

        // Act
        var result = engine.ValidateTruthPreservation(master, tailored);

        // Assert
        Assert.False(result.IsSuccess);
        Assert.Contains("unauthorized quantitative metric", result.Error);
        Assert.Contains("85%", result.Error);
    }
}
