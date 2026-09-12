using FluentAssertions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;
using ResumeTailor.Infrastructure.Orchestrator;
using Xunit;

namespace ResumeTailor.UnitTests;

public class OrchestratorTests
{
    [Theory]
    [InlineData("https://boards.greenhouse.io/airbnb/jobs/12345", typeof(GreenhouseProvider), JobSource.Greenhouse)]
    [InlineData("https://jobs.lever.co/netflix/67890", typeof(LeverProvider), JobSource.Lever)]
    [InlineData("https://jobs.ashbyhq.com/openai/11223", typeof(AshbyProvider), JobSource.Ashby)]
    [InlineData("https://www.linkedin.com/jobs/view/445566", typeof(LinkedInCopilotProvider), JobSource.LinkedIn)]
    [InlineData("https://www.naukri.com/job-listings-lead-engineer-9988", typeof(NaukriProvider), JobSource.Naukri)]
    [InlineData("https://microsoft.wd5.myworkdayjobs.com/en-US/Careers/job/1001", typeof(WorkdayProvider), JobSource.Workday)]
    public void ProviderMatching_ShouldIdentifyCorrectProvider(string url, Type expectedProviderType, JobSource expectedSource)
    {
        var providers = new IJobApplicationProvider[]
        {
            new GreenhouseProvider(),
            new LeverProvider(),
            new AshbyProvider(),
            new LinkedInCopilotProvider(),
            new NaukriProvider(),
            new WorkdayProvider(),
            new GenericBrowserProvider()
        };

        var matched = providers.FirstOrDefault(p => p.SupportedSource != JobSource.CompanyCareers && p.CanHandle(url));

        matched.Should().NotBeNull();
        matched.GetType().Should().Be(expectedProviderType);
        matched!.SupportedSource.Should().Be(expectedSource);
    }

    [Fact]
    public void GenericBrowserProvider_ShouldHandleUnknownCompanyUrls()
    {
        var provider = new GenericBrowserProvider();
        var canHandle = provider.CanHandle("https://careers.spacex.com/jobs/starship-software-lead");

        canHandle.Should().BeTrue();
        provider.SupportedSource.Should().Be(JobSource.CompanyCareers);
    }

    [Fact]
    public async Task LinkedInCopilotProvider_ShouldAlwaysPauseAtReviewGateway()
    {
        var provider = new LinkedInCopilotProvider();
        var profile = new CandidateProfile
        {
            PhoneNumber = "+1 555 123 4567",
            CurrentCity = "San Francisco",
            CurrentCountry = "USA",
            NoticePeriodDays = 15,
            WorkAuthorizationStatus = "US Citizen",
            RequiresVisaSponsorship = false
        };

        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Alex Mercer", Email = "alex@example.com" }
        };

        var answers = new List<ScreeningAnswerPayload>
        {
            new() { QuestionText = "Are you authorized to work in the US?", AnswerText = "Yes", FieldType = "radio" }
        };

        var dummyPdf = new byte[1024];

        var result = await provider.ExecuteFlowAsync(
            "https://www.linkedin.com/jobs/view/123",
            profile,
            resume,
            dummyPdf,
            "Cover letter text",
            answers,
            copilotReviewMode: true);

        result.Success.Should().BeTrue();
        result.PausedForUserReview.Should().BeTrue();
        result.ExecutionLogs.Should().Contain(log => log.Contains("Review Gateway Activated"));
    }
}
