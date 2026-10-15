using FluentAssertions;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Infrastructure.Aksh.Skills;
using Xunit;

namespace ResumeTailor.UnitTests;

public class AkshSkillRegistryTests
{
    private readonly AkshSkillRegistry _registry = new();
    private readonly AkshSession _session = new() { Id = Guid.NewGuid(), Goal = "General inquiry" };

    [Fact]
    public void Registry_RegistersAllDefaultSkills()
    {
        var skills = _registry.GetAllSkills().ToList();

        skills.Should().HaveCount(7);
        skills.Select(s => s.Id).Should().BeEquivalentTo(new[]
        {
            "platform-navigator",
            "resume-optimizer",
            "interview-coach",
            "salary-negotiator",
            "profile-queue-audit",
            "job-application-copilot",
            "career-strategist"
        });
    }

    [Theory]
    [InlineData("How do I use the Chrome extension on LinkedIn?", "platform-navigator")]
    [InlineData("Where can I upload my master resume in the studio?", "platform-navigator")]
    [InlineData("How do I configure my Gemini API key in settings?", "platform-navigator")]
    [InlineData("What are the features of Vedha AI?", "platform-navigator")]
    public void ResolveSkill_PlatformQueries_MatchesPlatformNavigator(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("Can you optimize my resume bullets using the Google XYZ formula?", "resume-optimizer")]
    [InlineData("Review my cv for ATS keyword gaps in backend engineering", "resume-optimizer")]
    [InlineData("Rewrite this bullet point: built microservices in go", "resume-optimizer")]
    [InlineData("I want my resume to be tailored", "resume-optimizer")]
    [InlineData("Tailor my resume for a backend engineer role", "resume-optimizer")]
    public void ResolveSkill_ResumeOptimizationQueries_MatchesResumeOptimizer(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("Can we do a mock interview for senior distributed systems?", "interview-coach")]
    [InlineData("Give me behavioral questions using the STAR method", "interview-coach")]
    [InlineData("How do I answer tell me about yourself for an engineering manager role?", "interview-coach")]
    public void ResolveSkill_InterviewQueries_MatchesInterviewCoach(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("How should I negotiate my salary counter offer?", "salary-negotiator")]
    [InlineData("Is 180k base compensation competitive with 50k equity?", "salary-negotiator")]
    [InlineData("Draft an email counter-offer for sign-on bonus", "salary-negotiator")]
    public void ResolveSkill_CompensationQueries_MatchesSalaryNegotiator(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("What is the status of my application queue?", "profile-queue-audit")]
    [InlineData("Show me my candidate profile and work authorization", "profile-queue-audit")]
    [InlineData("Check recent applications in my queue", "profile-queue-audit")]
    public void ResolveSkill_QueueQueries_MatchesProfileAndQueueAudit(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("Please apply to this job: https://www.linkedin.com/jobs/view/123456", "job-application-copilot")]
    [InlineData("Submit application for https://boards.greenhouse.io/stripe/jobs/99", "job-application-copilot")]
    [InlineData("Auto apply to https://jobs.lever.co/company/abc", "job-application-copilot")]
    public void ResolveSkill_ApplicationQueries_MatchesJobApplicationCopilot(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Theory]
    [InlineData("Should I transition from frontend to fullstack or platform engineering?", "career-strategist")]
    [InlineData("Hello, what can you help me with today?", "career-strategist")]
    [InlineData("How do I build a personal brand on GitHub and LinkedIn?", "career-strategist")]
    public void ResolveSkill_GeneralQueries_FallsBackToCareerStrategist(string prompt, string expectedId)
    {
        var skill = _registry.ResolveSkill(prompt, _session);
        skill.Id.Should().Be(expectedId);
    }

    [Fact]
    public void GetSkill_ExistingId_ReturnsSkill()
    {
        var skill = _registry.GetSkill("resume-optimizer");
        skill.Should().NotBeNull();
        skill!.DisplayName.Should().Be("Resume & ATS Bullet Optimizer");
    }

    [Fact]
    public void GetSkill_UnknownId_ReturnsNull()
    {
        var skill = _registry.GetSkill("unknown-skill");
        skill.Should().BeNull();
    }
}
