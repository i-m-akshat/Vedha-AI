using FluentAssertions;
using ResumeTailor.Domain.ValueObjects;
using Xunit;

namespace ResumeTailor.UnitTests;

public class ExperienceChronologyTests
{
    [Fact]
    public void SortChronologically_PresentRoleMustAlwaysComeFirst_AboveOlderCompletedRoles()
    {
        // Arrange: User left Company B in Jan 2026, joined Company A in Jan 2026 (current).
        // Older company (Jan 2024 - Jan 2026) was previously sorting ahead of Current company.
        var experiences = new List<WorkExperienceItem>
        {
            new()
            {
                Company = "Past Company Beta",
                Role = "Software Engineer",
                StartDate = "Jan 2024",
                EndDate = "Jan 2026",
                IsCurrent = false,
                Highlights = new List<string> { "Built APIs." }
            },
            new()
            {
                Company = "Current Company Alpha",
                Role = "Senior Engineer",
                StartDate = "Jan 2026",
                EndDate = "Present",
                IsCurrent = true,
                Highlights = new List<string> { "Lead engineering team." }
            }
        };

        // Act
        var sorted = ExperienceChronologyHelper.SortChronologically(experiences);

        // Assert: Current company MUST be first!
        sorted.Should().HaveCount(2);
        sorted[0].Company.Should().Be("Current Company Alpha");
        sorted[0].IsCurrent.Should().BeTrue();
        sorted[1].Company.Should().Be("Past Company Beta");
        sorted[1].IsCurrent.Should().BeFalse();
    }

    [Fact]
    public void SortChronologically_WhenEndDateContainsPresent_NormalizesIsCurrentTrueAndSortsFirst()
    {
        // Arrange: isCurrent was false (e.g. from LLM or UI omission), but EndDate is "Present"
        var experiences = new List<WorkExperienceItem>
        {
            new()
            {
                Company = "Company 2023",
                Role = "Engineer",
                StartDate = "2023",
                EndDate = "2025",
                IsCurrent = false
            },
            new()
            {
                Company = "Current Tech",
                Role = "Lead Architect",
                StartDate = "Feb 2025",
                EndDate = "Present",
                IsCurrent = false // unpopulated
            }
        };

        // Act
        var sorted = ExperienceChronologyHelper.SortChronologically(experiences);

        // Assert
        sorted[0].Company.Should().Be("Current Tech");
        sorted[0].IsCurrent.Should().BeTrue();
        sorted[0].EndDate.Should().Be("Present");
        sorted[1].Company.Should().Be("Company 2023");
    }

    [Fact]
    public void SortChronologically_WhenIsCurrentIsTrueAndEndDateEmpty_SetsEndDateToPresentAndSortsFirst()
    {
        // Arrange
        var experiences = new List<WorkExperienceItem>
        {
            new()
            {
                Company = "Old Job",
                Role = "Junior Developer",
                StartDate = "2020",
                EndDate = "2022",
                IsCurrent = false
            },
            new()
            {
                Company = "Now Job",
                Role = "Staff Developer",
                StartDate = "Jan 2025",
                EndDate = "",
                IsCurrent = true
            }
        };

        // Act
        var sorted = ExperienceChronologyHelper.SortChronologically(experiences);

        // Assert
        sorted[0].Company.Should().Be("Now Job");
        sorted[0].EndDate.Should().Be("Present");
        sorted[1].Company.Should().Be("Old Job");
    }

    [Fact]
    public void SortChronologically_MultiplePresentRoles_SortedByStartDateDescending()
    {
        // Arrange
        var experiences = new List<WorkExperienceItem>
        {
            new()
            {
                Company = "Advisory Role (Ongoing)",
                Role = "Advisor",
                StartDate = "Jun 2024",
                EndDate = "Present",
                IsCurrent = true
            },
            new()
            {
                Company = "Primary Full-Time Role",
                Role = "Principal Engineer",
                StartDate = "Jan 2026",
                EndDate = "Present",
                IsCurrent = true
            },
            new()
            {
                Company = "Previous Role",
                Role = "Lead Engineer",
                StartDate = "2021",
                EndDate = "2024",
                IsCurrent = false
            }
        };

        // Act
        var sorted = ExperienceChronologyHelper.SortChronologically(experiences);

        // Assert: Both present roles come first; the more recently started one (Jan 2026) comes before Jun 2024
        sorted[0].Company.Should().Be("Primary Full-Time Role");
        sorted[1].Company.Should().Be("Advisory Role (Ongoing)");
        sorted[2].Company.Should().Be("Previous Role");
    }

    [Fact]
    public void SortChronologically_MultiplePastRoles_SortedByEndDateDescending()
    {
        // Arrange
        var experiences = new List<WorkExperienceItem>
        {
            new()
            {
                Company = "Company 2018-2020",
                StartDate = "2018",
                EndDate = "2020",
                IsCurrent = false
            },
            new()
            {
                Company = "Company 2024-2025",
                StartDate = "Jan 2024",
                EndDate = "Dec 2025",
                IsCurrent = false
            },
            new()
            {
                Company = "Company 2021-2023",
                StartDate = "03/2021",
                EndDate = "11/2023",
                IsCurrent = false
            }
        };

        // Act
        var sorted = ExperienceChronologyHelper.SortChronologically(experiences);

        // Assert
        sorted[0].Company.Should().Be("Company 2024-2025");
        sorted[1].Company.Should().Be("Company 2021-2023");
        sorted[2].Company.Should().Be("Company 2018-2020");
    }

    [Fact]
    public void NormalizeAndSortExperience_DirectlyOnResumeSchema_MutatesListCorrectly()
    {
        // Arrange
        var schema = new ResumeSchema
        {
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Past", StartDate = "2021", EndDate = "2023", IsCurrent = false },
                new() { Company = "Present", StartDate = "Jan 2026", EndDate = "Current", IsCurrent = false }
            }
        };

        // Act
        schema.NormalizeAndSortExperience();

        // Assert
        schema.Experience[0].Company.Should().Be("Present");
        schema.Experience[0].IsCurrent.Should().BeTrue();
        schema.Experience[1].Company.Should().Be("Past");
    }
}
