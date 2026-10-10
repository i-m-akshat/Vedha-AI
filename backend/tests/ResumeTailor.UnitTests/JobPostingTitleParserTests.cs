using FluentAssertions;
using ResumeTailor.Infrastructure.WebScraping;
using Xunit;

namespace ResumeTailor.UnitTests;

public class JobPostingTitleParserTests
{
    [Theory]
    [InlineData("Staff AI Infrastructure Engineer at Anthropic — San Francisco", "Staff AI Infrastructure Engineer", "Anthropic")]
    [InlineData("Software Engineer at Eurofins — Bengaluru, Karnataka, India", "Software Engineer", "Eurofins")]
    [InlineData("Senior Backend Engineer - Acme Corp", "Senior Backend Engineer", "Acme Corp")]
    [InlineData("Software Engineer | Acme Corp | LinkedIn", "Software Engineer", "Acme Corp")]
    public void ParseTitleLine_SplitsRoleCompanyAndDropsLocation(string raw, string title, string company)
    {
        var parsed = JobPostingTitleParser.Resolve(raw);

        parsed.Title.Should().Be(title);
        parsed.Company.Should().Be(company);
    }

    [Fact]
    public void Resolve_CompanyMottoPageTitle_DoesNotBecomeTheRole()
    {
        const string markdown = """
            # Stripe
            Financial infrastructure for the internet

            ## Software Engineer, Payments
            Build billing systems.
            """;

        var parsed = JobPostingTitleParser.Resolve(
            "Stripe | Financial infrastructure for the internet",
            markdown);

        parsed.Title.Should().Be("Software Engineer, Payments");
        parsed.Company.Should().Be("Stripe");
        JobPostingTitleParser.LooksLikeJobTitle("Stripe | Financial infrastructure for the internet").Should().BeFalse();
        JobPostingTitleParser.LooksLikeJobTitle("We help teams ship faster").Should().BeFalse();
    }

    [Fact]
    public void Resolve_KeepsHyphenatedRoleSuffix()
    {
        var parsed = JobPostingTitleParser.Resolve("Senior Software Engineer - Platform");

        parsed.Title.Should().Be("Senior Software Engineer - Platform");
        parsed.Company.Should().BeNull();
    }

    [Fact]
    public void LooksLikeJobTitle_AcceptsDirectorOfEngineering()
    {
        JobPostingTitleParser.LooksLikeJobTitle("Director of Engineering").Should().BeTrue();
    }
}
