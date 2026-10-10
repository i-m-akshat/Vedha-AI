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
                new() { Company = "Google", Role = "Software Engineer", Highlights = new List<string> { "Built high throughput distributed services reducing p99 latency by 35%." } },
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
    public void ValidateTruthPreservation_JdStyleTitleRewrite_WithSharedTokens_ShouldPass()
    {
        var master = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "Senior Software Engineer" }
            }
        };

        var tailored = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "Senior Full-Stack .NET Developer" }
            }
        };

        _engine.ValidateTruthPreservation(master, tailored).IsSuccess.Should().BeTrue();
    }

    [Fact]
    public void ValidateTruthPreservation_InventedTitle_WithZeroOverlap_ShouldFail()
    {
        var master = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "QA Analyst" }
            }
        };

        var tailored = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "Vice President of Engineering" }
            }
        };

        var result = _engine.ValidateTruthPreservation(master, tailored);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("unauthorized role title");
    }

    [Fact]
    public void ValidateTruthPreservation_AlteredDates_ShouldFail()
    {
        var master = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "Developer", StartDate = "Jan 2020", EndDate = "Dec 2022" }
            }
        };

        var tailored = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Acme", Role = "Developer", StartDate = "Jan 2018", EndDate = "Dec 2022" }
            }
        };

        var result = _engine.ValidateTruthPreservation(master, tailored);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("employment dates");
    }

    [Fact]
    public void ValidateTruthPreservation_InventedSkill_Project_Degree_ShouldFail()
    {
        var master = new ResumeSchema
        {
            Skills = new List<SkillCategory> { new() { CategoryName = "Languages", Skills = new List<string> { "C#" } } },
            Projects = new List<ProjectItem> { new() { Title = "Billing Service" } },
            Education = new List<EducationItem> { new() { Institution = "State Uni", Degree = "BSc", FieldOfStudy = "CS", GraduationYear = "2020" } },
        };

        var tailored = new ResumeSchema
        {
            Skills = new List<SkillCategory> { new() { CategoryName = "Languages", Skills = new List<string> { "C#", "Quantum Cobol" } } },
            Projects = new List<ProjectItem> { new() { Title = "Billing Service" }, new() { Title = "Moon Lander" } },
            Education = new List<EducationItem> { new() { Institution = "State Uni", Degree = "PhD", FieldOfStudy = "CS", GraduationYear = "2020" } },
        };

        var result = _engine.ValidateTruthPreservation(master, tailored);

        result.IsFailure.Should().BeTrue();
        result.Error.Should().Contain("unauthorized skill");
        result.Error.Should().Contain("unauthorized project");
        result.Error.Should().Contain("unauthorized degree");
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

    [Fact]
    public void CalculateScore_WhenJobLacksSkillsAndKeywords_ShouldNotDefaultToEightyPercentAndReportWeakness()
    {
        // Arrange
        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "John Smith" },
            Summary = "Senior .NET Engineer.",
            Skills = new List<SkillCategory>
            {
                new() { CategoryName = "Languages", Skills = new List<string> { "C#", "SQL" } }
            },
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Tech Corp", Role = "Senior Engineer", Highlights = new List<string> { "Built services with 99.99% uptime." } }
            }
        };

        var emptyJob = new JobDescriptionSchema
        {
            Title = "",
            Company = "",
            MustHaveSkills = new List<string>(),
            NiceToHaveSkills = new List<string>(),
            Keywords = new List<string>()
        };

        // Act
        var score = _engine.CalculateScore(resume, emptyJob);

        // Assert - Should NOT artificially report a high match (80%) when requirements are completely absent
        score.OverallScore.Should().BeLessThan(50);
        score.Weaknesses.Should().Contain(w => w.Contains("Could not extract technical competencies"));
    }

    [Fact]
    public void CalculateScore_PunctuationKeywordsAndSynonyms_ShouldMatchCorrectly()
    {
        // Arrange - Candidate has C#, .NET, CI/CD, Postgres, and AWS
        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Alex Dev", Title = "Senior .NET Core Engineer" },
            Summary = "Experienced .NET Engineer specializing in C#, CI/CD pipelines, and cloud native architectures on AWS.",
            Skills = new List<SkillCategory>
            {
                new() { CategoryName = "Languages", Skills = new List<string> { "C#", "SQL", "C++" } },
                new() { CategoryName = "Backend & Cloud", Skills = new List<string> { ".NET Core", "Postgres", "AWS", "CI/CD", "Docker" } }
            },
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Enterprise Cloud",
                    Role = "Backend Engineer",
                    Highlights = new List<string>
                    {
                        "Architected microservices using C# and .NET with 99.99% reliability.",
                        "Configured automated CI/CD deployment pipelines on AWS reducing deployment time by 45%."
                    }
                }
            }
        };

        var job = new JobDescriptionSchema
        {
            Title = "Senior .NET Engineer",
            Company = "Tech Innovators",
            MustHaveSkills = new List<string> { "C#", ".NET", "PostgreSQL", "CI/CD" },
            NiceToHaveSkills = new List<string> { "Amazon Web Services", "Docker", "C++" },
            Keywords = new List<string> { "microservices", "pipelines", "reliability", "cloud" }
        };

        // Act
        var score = _engine.CalculateScore(resume, job);

        // Assert
        score.MatchingSkills.Should().Contain("C#");
        score.MatchingSkills.Should().Contain(".NET");
        score.MatchingSkills.Should().Contain("PostgreSQL"); // Matched via "Postgres" synonym
        score.MatchingSkills.Should().Contain("Amazon Web Services"); // Matched via "AWS" synonym
        score.MatchingSkills.Should().Contain("CI/CD");
        score.MissingSkills.Should().BeEmpty();
    }

    [Fact]
    public void CalculateScore_WhenResumeIsStronglyTailoredWithMetricsAndSkills_ShouldAchieveNinetyPercentOrHigher()
    {
        // Arrange - Fully tailored candidate resume matching 100% of Must-Have and Nice-To-Have skills with 80%+ metric bullets
        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Sarah Connor", Title = "Lead Backend Systems Engineer" },
            Summary = "Lead Backend Systems Engineer with 8+ years architecting scalable distributed systems using C#, ASP.NET Core, PostgreSQL, and Kubernetes on AWS. Track record of optimizing high-throughput APIs handling 50k+ req/sec.",
            Skills = new List<SkillCategory>
            {
                new() { CategoryName = "Core Stack", Skills = new List<string> { "C#", ".NET Core", "ASP.NET Core", "PostgreSQL", "Kubernetes", "Docker" } },
                new() { CategoryName = "Cloud & Architecture", Skills = new List<string> { "AWS", "Redis", "Kafka", "Microservices", "RESTful APIs", "CI/CD" } }
            },
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "FinTech Global",
                    Role = "Lead Backend Engineer",
                    Highlights = new List<string>
                    {
                        "Designed and deployed 15+ microservices in C# and ASP.NET Core, scaling transaction volume by 3x.",
                        "Optimized PostgreSQL queries and Redis caching, cutting p99 query latency by 42%.",
                        "Implemented automated CI/CD pipelines in GitHub Actions, slashing release cycle time by 65%.",
                        "Led containerization migration to Kubernetes on AWS achieving 99.999% system availability.",
                        "Built event-driven data streaming engine using Kafka handling 20M events per day."
                    }
                }
            }
        };

        var job = new JobDescriptionSchema
        {
            Title = "Lead Backend Systems Engineer",
            Company = "Stripe",
            MustHaveSkills = new List<string> { "C#", "ASP.NET Core", "PostgreSQL", "Kubernetes", "Microservices" },
            NiceToHaveSkills = new List<string> { "AWS", "Redis", "Kafka", "Docker", "CI/CD" },
            Keywords = new List<string> { "scalable", "distributed", "throughput", "latency", "streaming", "caching" }
        };

        // Act
        var score = _engine.CalculateScore(resume, job);

        // Assert - Highly aligned truthful profile should hit >= 90%
        score.OverallScore.Should().BeGreaterThanOrEqualTo(90);
        score.KeywordMatchScore.Should().BeGreaterThanOrEqualTo(85);
        score.SkillsMatchScore.Should().Be(100);
        score.ExperienceRelevanceScore.Should().BeGreaterThanOrEqualTo(90);
    }

    [Fact]
    public void EnsureKeywordsPopulated_WhenGivenRawJobPostingText_ShouldExtractIndustryKeywords()
    {
        // Arrange
        var rawJd = @"
Role: Dot Net Developer
Experience: 3-5 Years
Job Description:
We are looking for a Senior .NET Developer with strong hands-on experience in C#, .NET Core, ASP.NET MVC, Web API, and SQL Server.
Must understand OOP, SOLID principles, Entity Framework, LINQ, and RESTful APIs.
Experience with Docker, Kubernetes, CI/CD, Azure, Angular, and TypeScript is a plus.
Responsible for microservices architecture, performance tuning, and database optimization.
";
        var schema = new JobDescriptionSchema
        {
            Title = "Dot Net Developer",
            Company = "BoostTech",
            MustHaveSkills = new List<string>(), // Empty, as if AI omitted them
            Keywords = new List<string>()
        };

        // Act
        schema.EnsureKeywordsPopulated(rawJd);

        // Assert
        schema.MustHaveSkills.Should().Contain("C#");
        schema.MustHaveSkills.Should().Contain(".NET Core");
        schema.MustHaveSkills.Should().Contain("ASP.NET MVC");
        schema.MustHaveSkills.Should().Contain("Web API");
        schema.MustHaveSkills.Should().Contain("SQL Server");
        schema.MustHaveSkills.Should().Contain("SOLID");
        schema.Keywords.Should().Contain(".NET Core");
        schema.Keywords.Should().Contain("Docker");
        schema.Keywords.Should().Contain("Microservices");
        schema.Keywords.Count.Should().BeGreaterThanOrEqualTo(10);
    }

    [Fact]
    public void CalculateScore_WhenJobKeywordsPopulatedViaTaxonomy_ShouldMatchProperly()
    {
        // Arrange
        var rawJd = "Looking for a C# and .NET Core developer with SQL Server and Microservices experience.";
        var job = new JobDescriptionSchema
        {
            Title = "Dot Net Developer",
            Company = "Tech Corp"
        };
        job.EnsureKeywordsPopulated(rawJd);

        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Alex Dev", Title = "Senior .NET Core Engineer" },
            Summary = "Senior .NET Core Engineer with 5 years experience in C#, SQL Server, and Microservices.",
            Skills = new List<SkillCategory>
            {
                new() { CategoryName = "Backend", Skills = new List<string> { "C#", ".NET Core", "SQL Server", "Microservices" } }
            },
            Experience = new List<WorkExperienceItem>
            {
                new()
                {
                    Company = "Enterprise Cloud",
                    Role = "Backend Engineer",
                    Highlights = new List<string>
                    {
                        "Architected microservices using C# and .NET Core with SQL Server databases achieving 99.9% uptime."
                    }
                }
            }
        };

        // Act
        var score = _engine.CalculateScore(resume, job);

        // Assert
        score.OverallScore.Should().BeGreaterThanOrEqualTo(75);
        score.MatchingSkills.Should().Contain("C#");
        score.MatchingSkills.Should().Contain(".NET Core");
        score.MatchingSkills.Should().Contain("SQL Server");
        score.MatchingSkills.Should().Contain("Microservices");
        score.KeywordMatchScore.Should().BeGreaterThanOrEqualTo(70);
    }
}

