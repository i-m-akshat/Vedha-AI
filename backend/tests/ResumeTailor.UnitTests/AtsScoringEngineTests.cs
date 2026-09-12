using FluentAssertions;
using ResumeTailor.Domain.ValueObjects;
using ResumeTailor.Infrastructure.AtsEngine;
using Xunit;

namespace ResumeTailor.UnitTests;

public class AtsScoringEngineTests
{
    private readonly AtsScoringEngine _engine = new();

    [Fact]
    public void ValidateTruthPreservation_WhenTailoredResumeContainsOnlyMasterCompanies_ShouldPass()
    {
        // Arrange
        var master = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Jane Doe" },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Google", Role = "Software Engineer", Highlights = new List<string> { "Built high throughput distributed services." } },
                new() { Company = "Stripe", Role = "Backend Engineer", Highlights = new List<string> { "Designed payment processing pipeline." } }
            }
        };

        var tailored = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Jane Doe" },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Google", Role = "Software Engineer", Highlights = new List<string> { "Architected distributed gRPC microservices reducing p99 latency by 35%." } }
            }
        };

        // Act
        var result = _engine.ValidateTruthPreservation(master, tailored);

        // Assert
        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void ValidateTruthPreservation_WhenTailoredResumeIntroducesFakeCompany_ShouldFail()
    {
        // Arrange
        var master = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Jane Doe" },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme Corp", Role = "Developer" }
            }
        };

        var tailored = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Jane Doe" },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme Corp", Role = "Developer" },
                new() { Company = "Netflix (Invented)", Role = "Principal Engineer" }
            }
        };

        // Act
        var result = _engine.ValidateTruthPreservation(master, tailored);

        // Assert
        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("unauthorized company");
    }

    [Fact]
    public void CalculateScore_ShouldComputeKeywordMatchesAndMissingSkills()
    {
        // Arrange
        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "John Smith" },
            Summary = "Senior .NET Engineer experienced with C#, ASP.NET Core, PostgreSQL, and Docker.",
            Skills = new List<SkillCategory>
            {
                new() { CategoryName = "Languages", Skills = new List<string> { "C#", "SQL", "TypeScript" } },
                new() { CategoryName = "Frameworks", Skills = new List<string> { "ASP.NET Core", "React" } }
            },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Tech Corp", Role = "Senior Engineer", Highlights = new List<string> { "Scaled backend API handling 10M daily requests with 99.99% uptime." } }
            }
        };

        var job = new JobDescriptionSchema
        {
            Title = "Senior Backend Engineer",
            Company = "SaaS Platform",
            MustHaveSkills = new List<string> { "C#", "ASP.NET Core", "PostgreSQL", "Kubernetes" },
            NiceToHaveSkills = new List<string> { "Redis", "TypeScript" },
            Keywords = new List<string> { "backend", "scalable", "API", "microservices" }
        };

        // Act
        var score = _engine.CalculateScore(resume, job);

        // Assert
        score.OverallScore.Should().BeInRange(60, 95);
        score.MatchingSkills.Should().Contain("C#");
        score.MatchingSkills.Should().Contain("ASP.NET Core");
        score.MissingSkills.Should().Contain("Kubernetes");
        score.RecruiterFeedback.Should().NotBeNullOrEmpty();
        score.SkillRoadmap.Should().NotBeEmpty();
    }
}
