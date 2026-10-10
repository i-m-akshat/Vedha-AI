using AngleSharp;
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

    [Fact]
    public async Task SemanticDomFormMapper_ShouldMapFieldsUsingSemanticLabelsWithoutHardcodedSelectors()
    {
        var browsingContext = AngleSharp.BrowsingContext.New(AngleSharp.Configuration.Default);
        var html = @"
            <html>
                <body>
                    <form>
                        <div>
                            <label for='user_fname'>First Name</label>
                            <input id='user_fname' name='fname' type='text' required />
                        </div>
                        <div>
                            <label for='user_email'>Work Email</label>
                            <input id='user_email' name='email' type='email' />
                        </div>
                        <div>
                            <label for='user_salary'>Expected Compensation / Salary</label>
                            <input id='user_salary' name='compensation' type='text' />
                        </div>
                        <div>
                            <label for='user_cv'>Attach Resume / CV</label>
                            <input id='user_cv' name='cv_file' type='file' />
                        </div>
                    </form>
                </body>
            </html>";

        var document = await browsingContext.OpenAsync(req => req.Content(html));
        var mapper = new SemanticDomFormMapper(null!); // Mocked/null AI factory since standard profile matches apply

        var extractedFields = mapper.ExtractSemanticFields(document);

        extractedFields.Should().HaveCount(4);
        extractedFields.Should().Contain(f => f.Label == "First Name" && f.Type == "text");
        extractedFields.Should().Contain(f => f.Label == "Work Email" && f.Type == "email");
        extractedFields.Should().Contain(f => f.Label == "Expected Compensation / Salary");
        extractedFields.Should().Contain(f => f.Label == "Attach Resume / CV" && f.Type == "file");

        var profile = new CandidateProfile
        {
            ExpectedSalary = "$165,000 / year",
            NoticePeriodDays = 30
        };

        var resume = new ResumeSchema
        {
            PersonalInfo = new PersonalInfo { FullName = "Sarah Connor", Email = "sarah@skynet-defense.org" }
        };

        var mapped = await mapper.MapFieldsToCandidateAsync(extractedFields, profile, resume, new List<ScreeningQuestionMemory>());

        mapped.FirstOrDefault(f => f.Label == "First Name")?.InferredMappedValue.Should().Be("Sarah");
        mapped.FirstOrDefault(f => f.Label == "Work Email")?.InferredMappedValue.Should().Be("sarah@skynet-defense.org");
        mapped.FirstOrDefault(f => f.Label == "Expected Compensation / Salary")?.InferredMappedValue.Should().Be("$165,000 / year");
        mapped.FirstOrDefault(f => f.Label == "Attach Resume / CV")?.InferredMappedValue.Should().Be("[ATS-Tailored-Resume.pdf]");
    }

    [Theory]
    // Regression: the finalize check used to read queueItem.Status AFTER it had
    // been overwritten to RunningAutomation, so previously-paused items re-paused
    // instead of finalizing. wasPausedForReview is now captured pre-overwrite.
    [InlineData(true, true, true, false)]   // paused + copilot + review flag -> finalize, no pause
    [InlineData(true, false, true, false)]  // paused + explicit finalize -> finalize, no pause
    [InlineData(false, false, true, false)] // explicit finalize (copilot off) -> finalize, no pause
    [InlineData(false, true, true, true)]   // fresh copilot run, review demanded -> pause
    [InlineData(false, true, false, true)]  // fresh copilot run (copilotMode itself pauses) -> pause
    public void ResolveEffectiveReviewMode_Matrix(bool wasPausedForReview, bool copilotMode, bool requiresManualReview, bool expected)
    {
        JobApplicationOrchestrator.ResolveEffectiveReviewMode(wasPausedForReview, copilotMode, requiresManualReview)
            .Should().Be(expected);
    }

    [Fact]
    public void NormalizeResumeSchema_EliminatesNulls_FromAiShapedJson()
    {
        // Regression: explicit JSON nulls ("personalInfo": null) used to throw
        // NullReference 500s down the execute path (providers dereference unconditionally).
        var schema = System.Text.Json.JsonSerializer.Deserialize<ResumeSchema>(
            """{"personalInfo":null,"summary":null,"experience":null,"projects":null,"skills":null,"education":null,"certifications":null,"achievements":null}""");

        var normalized = JobApplicationOrchestrator.NormalizeResumeSchema(schema);

        normalized.PersonalInfo.Should().NotBeNull();
        normalized.PersonalInfo.FullName.Should().Be(string.Empty);
        normalized.Summary.Should().Be(string.Empty);
        normalized.Experience.Should().NotBeNull().And.BeEmpty();
        normalized.Projects.Should().NotBeNull();
        normalized.Skills.Should().NotBeNull();
        normalized.Education.Should().NotBeNull();
        normalized.Certifications.Should().NotBeNull();
        normalized.Achievements.Should().NotBeNull();
    }

    [Fact]
    public void NormalizeResumeSchema_HandlesNullRoot()
    {
        var normalized = JobApplicationOrchestrator.NormalizeResumeSchema(null);

        normalized.Should().NotBeNull();
        normalized.PersonalInfo.Should().NotBeNull();
        normalized.Skills.Should().NotBeNull();
    }
}
