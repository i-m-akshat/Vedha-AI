using FluentAssertions;
using ResumeTailor.Application.Features.Aksh;
using Xunit;

namespace ResumeTailor.UnitTests;

/// <summary>
/// Deterministic turn understanding must never depend on model discipline:
/// URLs, continue/generate/apply intents, and plan stepping are pure rules.
/// </summary>
public class AkshIntentTests
{
    [Fact]
    public void ExtractJobUrls_Finds_Trims_And_Dedupes()
    {
        var text = "yeah continue (https://www.naukri.com/job-listings-x-12345?src=a&sid=1). Also https://www.naukri.com/job-listings-x-12345?src=a&sid=1!";
        var urls = AkshIntent.ExtractJobUrls(text);

        urls.Should().HaveCount(1);
        urls[0].Should().Be("https://www.naukri.com/job-listings-x-12345?src=a&sid=1");
    }

    [Fact]
    public void ExtractJobUrls_Rejects_NonHttp_And_Empty()
    {
        AkshIntent.ExtractJobUrls("call me at ftp://files.local/x").Should().BeEmpty();
        AkshIntent.ExtractJobUrls("no links here").Should().BeEmpty();
        AkshIntent.ExtractJobUrls(null).Should().BeEmpty();
    }

    [Theory]
    [InlineData("yeah continue", true, false, false)]
    [InlineData("go ahead and do it", true, false, false)]
    [InlineData("generate a new resume for this job url", false, true, false)]
    [InlineData("please tailor my resume", false, true, false)]
    [InlineData("yes, apply now", false, false, true)]
    [InlineData("finalize the submit", false, false, true)]
    [InlineData("hello there", false, false, false)]
    public void Intents_Classify_Candidate_Phrasing(string text, bool cont, bool gen, bool apply)
    {
        AkshIntent.HasContinueIntent(text).Should().Be(cont);
        AkshIntent.HasGenerateIntent(text).Should().Be(gen);
        AkshIntent.HasApplyIntent(text).Should().Be(apply);
    }

    [Fact]
    public void NextPendingStep_Skips_Done_Steps()
    {
        var todos = new List<AkshTodoItemDto>
        {
            new() { Step = "Scrape", Tool = "scrape_job", State = "done" },
            new() { Step = "Package", Tool = "prepare_package", State = "pending" },
        };

        AkshIntent.NextPendingStep(todos)!.Tool.Should().Be("prepare_package");
        AkshIntent.NextPendingStep(null).Should().BeNull();
    }

    [Fact]
    public void MarkSteps_Only_Touches_Matching_Tools()
    {
        var todos = new List<AkshTodoItemDto>
        {
            new() { Step = "Scrape", Tool = "scrape_job", State = "pending" },
            new() { Step = "Package", Tool = "prepare_package", State = "pending" },
        };

        var marked = AkshIntent.MarkSteps(todos, "done", "prepare_package");

        marked.First(t => t.Tool == "prepare_package").State.Should().Be("done");
        marked.First(t => t.Tool == "scrape_job").State.Should().Be("pending");
    }
}
