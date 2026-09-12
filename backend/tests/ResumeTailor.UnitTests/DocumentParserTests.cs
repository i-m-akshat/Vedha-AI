using System.Text;
using FluentAssertions;
using ResumeTailor.Infrastructure.Parsing;
using Xunit;

namespace ResumeTailor.UnitTests;

public class DocumentParserTests
{
    private readonly MarkdownDocumentParser _mdParser = new();

    [Fact]
    public async Task MarkdownParser_ShouldExtractStructuredPlainText()
    {
        // Arrange
        var sampleMarkdown = @"# Alex Morgan
alex@resumate.ai | (555) 019-2834 | San Francisco, CA

## Summary
Principal Software Engineer with 8+ years building cloud-native distributed systems.

## Experience
### Senior Backend Engineer - CloudTech
*2021 - Present | Remote*
- Designed and built microservices in C# and Go handling 50k RPS.
- Reduced PostgreSQL query latency by 45% using Redis caching and index optimization.
";

        using var stream = new MemoryStream(Encoding.UTF8.GetBytes(sampleMarkdown));

        // Act
        var result = await _mdParser.ExtractTextAsync(stream, "resume.md");

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Contain("Alex Morgan");
        result.Value.Should().Contain("Principal Software Engineer");
        result.Value.Should().Contain("CloudTech");
    }
}
