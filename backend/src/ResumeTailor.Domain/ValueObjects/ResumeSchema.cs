using System.Globalization;
using System.Text.RegularExpressions;

namespace ResumeTailor.Domain.ValueObjects;

public class PersonalInfo
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string? Title { get; set; }
    public string? LinkedInUrl { get; set; }
    public string? GitHubUrl { get; set; }
    public string? PortfolioUrl { get; set; }
}

public class WorkExperienceItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Company { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty;
    public string EndDate { get; set; } = string.Empty;
    public bool IsCurrent { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class ProjectItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Technologies { get; set; }
    public string? Url { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class EducationItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Institution { get; set; } = string.Empty;
    public string Degree { get; set; } = string.Empty;
    public string FieldOfStudy { get; set; } = string.Empty;
    public string GraduationYear { get; set; } = string.Empty;
    public string? Gpa { get; set; }
    public string? Honors { get; set; }
}

public class SkillCategory
{
    public string CategoryName { get; set; } = string.Empty;
    public List<string> Skills { get; set; } = new();
}

public class CertificationItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string IssueDate { get; set; } = string.Empty;
    public string? ExpirationDate { get; set; }
    public string? CredentialId { get; set; }
    public string? Url { get; set; }
}

public class AchievementItem
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Date { get; set; }
}

public class ResumeSchema
{
    public PersonalInfo PersonalInfo { get; set; } = new();
    public string Summary { get; set; } = string.Empty;
    public List<WorkExperienceItem> Experience { get; set; } = new();
    public List<ProjectItem> Projects { get; set; } = new();
    public List<SkillCategory> Skills { get; set; } = new();
    public List<EducationItem> Education { get; set; } = new();
    public List<CertificationItem> Certifications { get; set; } = new();
    public List<AchievementItem> Achievements { get; set; } = new();

    public void NormalizeAndSortExperience()
    {
        if (Experience != null && Experience.Count > 0)
        {
            Experience = ExperienceChronologyHelper.SortChronologically(Experience);
        }
    }
}

public static class ExperienceChronologyHelper
{
    private static readonly Regex YearRegex = new(@"\b(19\d{2}|20\d{2})\b", RegexOptions.Compiled);

    private static readonly Dictionary<string, int> MonthMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "jan", 1 }, { "january", 1 },
        { "feb", 2 }, { "february", 2 },
        { "mar", 3 }, { "march", 3 },
        { "apr", 4 }, { "april", 4 },
        { "may", 5 },
        { "jun", 6 }, { "june", 6 },
        { "jul", 7 }, { "july", 7 },
        { "aug", 8 }, { "august", 8 },
        { "sep", 9 }, { "sept", 9 }, { "september", 9 },
        { "oct", 10 }, { "october", 10 },
        { "nov", 11 }, { "november", 11 },
        { "dec", 12 }, { "december", 12 }
    };

    public static bool IsPresentRole(WorkExperienceItem item)
    {
        if (item.IsCurrent) return true;
        if (!string.IsNullOrWhiteSpace(item.EndDate))
        {
            var end = item.EndDate.Trim();
            if (end.Equals("present", StringComparison.OrdinalIgnoreCase) ||
                end.Equals("current", StringComparison.OrdinalIgnoreCase) ||
                end.Equals("now", StringComparison.OrdinalIgnoreCase) ||
                end.Equals("ongoing", StringComparison.OrdinalIgnoreCase) ||
                end.Contains("present", StringComparison.OrdinalIgnoreCase) ||
                end.Contains("current", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }
        return false;
    }

    public static DateTime ParseDateSafe(string? dateStr, bool isEndDate = false)
    {
        if (string.IsNullOrWhiteSpace(dateStr))
            return isEndDate ? DateTime.MinValue : DateTime.MinValue;

        var trimmed = dateStr.Trim();

        if (trimmed.Equals("present", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("current", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("now", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Equals("ongoing", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Contains("present", StringComparison.OrdinalIgnoreCase) ||
            trimmed.Contains("current", StringComparison.OrdinalIgnoreCase))
        {
            return DateTime.MaxValue;
        }

        string[] formats =
        {
            "MMM yyyy", "MMMM yyyy", "MMM. yyyy", "MM/yyyy", "M/yyyy", "yyyy-MM", "yyyy/MM",
            "yyyy", "d MMM yyyy", "MMM d, yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy"
        };

        if (DateTime.TryParseExact(trimmed, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var exactDate))
        {
            return exactDate;
        }

        if (DateTime.TryParse(trimmed, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsedDate))
        {
            return parsedDate;
        }

        var match = YearRegex.Match(trimmed);
        if (match.Success && int.TryParse(match.Value, out var year))
        {
            int month = isEndDate ? 12 : 1;
            foreach (var kvp in MonthMap)
            {
                if (Regex.IsMatch(trimmed, $@"\b{kvp.Key}\b", RegexOptions.IgnoreCase))
                {
                    month = kvp.Value;
                    break;
                }
            }
            int day = isEndDate ? Math.Min(28, DateTime.DaysInMonth(year, month)) : 1;
            return new DateTime(year, month, day);
        }

        return isEndDate ? DateTime.MinValue : DateTime.MinValue;
    }

    public static List<WorkExperienceItem> SortChronologically(IEnumerable<WorkExperienceItem>? items)
    {
        if (items == null) return new List<WorkExperienceItem>();

        var list = items.ToList();
        foreach (var item in list)
        {
            if (IsPresentRole(item))
            {
                item.IsCurrent = true;
                if (string.IsNullOrWhiteSpace(item.EndDate))
                {
                    item.EndDate = "Present";
                }
            }
        }

        return list
            .OrderByDescending(x => IsPresentRole(x) ? 1 : 0)
            .ThenByDescending(x => IsPresentRole(x)
                ? ParseDateSafe(x.StartDate, isEndDate: false)
                : ParseDateSafe(x.EndDate, isEndDate: true))
            .ThenByDescending(x => ParseDateSafe(x.StartDate, isEndDate: false))
            .ToList();
    }
}
