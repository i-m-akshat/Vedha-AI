using System.Text.RegularExpressions;

namespace ResumeTailor.Infrastructure.WebScraping;

/// <summary>
/// Separates a real job title from career-page branding.
/// Company sites often publish the document title and first heading as
/// "Company | motto", which was previously stored as the target role.
/// </summary>
public static partial class JobPostingTitleParser
{
    public static (string? Title, string? Company) Resolve(
        string? rawTitle,
        string? body = null,
        IEnumerable<string>? headings = null)
    {
        var (title, company) = ParseTitleLine(rawTitle);

        if (headings != null)
        {
            foreach (var heading in headings)
            {
                AbsorbCandidate(heading, ref title, ref company);
            }
        }

        if (title == null || company == null)
        {
            AbsorbBody(body, ref title, ref company);
        }

        return (title, company);
    }

    public static (string? Title, string? Company) Refine(
        string? detectedTitle,
        string? detectedCompany,
        string? pageTitle,
        IEnumerable<string>? headings,
        string? body)
    {
        var fromDetected = Resolve(detectedTitle, body, headings);
        var fromPage = Resolve(pageTitle, body, headings);

        var title = LooksLikeJobTitle(detectedTitle)
            ? Clean(detectedTitle)
            : fromDetected.Title ?? fromPage.Title;

        var company = LooksLikeCompany(detectedCompany)
            ? Clean(detectedCompany)
            : fromDetected.Company ?? fromPage.Company;

        return (title, company);
    }

    public static bool LooksLikeJobTitle(string? value)
    {
        var text = Clean(value);
        if (text.Length is < 2 or > 120) return false;
        if (IsNoise(text) || IsSectionHeading(text) || LooksLikeMotto(text)) return false;

        var words = WordCount(text);
        if (words is < 1 or > 14) return false;
        if (HasStrongRole(text)) return true;
        return HasWeakRole(text) && words <= 8;
    }

    public static bool LooksLikeCompany(string? value)
    {
        var text = Clean(value);
        if (text.Length is < 2 or > 80) return false;
        if (IsNoise(text) || IsSectionHeading(text) || LooksLikeMotto(text) || LooksLikeLocation(text)) return false;
        if (LooksLikeJobTitle(text)) return false;
        var words = WordCount(text);
        return words is >= 1 and <= 6;
    }

    private static void AbsorbCandidate(string? candidate, ref string? title, ref string? company)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return;
        var (parsedTitle, parsedCompany) = ParseTitleLine(candidate);
        if (title == null && parsedTitle != null) title = parsedTitle;
        if (company == null && parsedCompany != null) company = parsedCompany;

        var cleaned = Clean(candidate);
        if (title == null && LooksLikeJobTitle(cleaned)) title = cleaned;
        if (company == null && LooksLikeCompany(cleaned)) company = cleaned;
    }

    private static void AbsorbBody(string? body, ref string? title, ref string? company)
    {
        if (string.IsNullOrWhiteSpace(body)) return;

        foreach (Match match in MarkdownHeadingRegex().Matches(body))
        {
            AbsorbCandidate(match.Groups[1].Value, ref title, ref company);
        }

        foreach (Match match in LabeledTitleRegex().Matches(body))
        {
            if (title == null)
            {
                var labeled = Clean(match.Groups[1].Value);
                if (LooksLikeJobTitle(labeled)) title = labeled;
            }
        }

        if (company == null)
        {
            var companyMatch = LabeledCompanyRegex().Match(body);
            if (companyMatch.Success)
            {
                var labeled = Clean(companyMatch.Groups[1].Value);
                var (parsedTitle, parsedCompany) = ParseTitleLine(labeled);
                company = parsedCompany ?? (LooksLikeCompany(labeled) ? labeled : null);
                if (title == null) title = parsedTitle;
            }
        }

        if (title != null && company != null) return;

        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var scanned = 0;
        foreach (var line in lines)
        {
            if (scanned++ > 40) break;
            var cleaned = Clean(line.TrimStart('#', '*', ' ', '-', '•'));
            if (cleaned.Length < 2) continue;
            AbsorbCandidate(cleaned, ref title, ref company);
            if (title != null && company != null) return;
        }
    }

    private static (string? Title, string? Company) ParseTitleLine(string? raw)
    {
        var text = Clean(raw);
        if (text.Length == 0) return (null, null);

        var parts = SeparatorRegex().Split(text)
            .Select(Clean)
            .Where(part => part.Length > 0)
            .ToList();

        if (parts.Count == 2
            && LooksLikeJobTitle(parts[0])
            && IsTitleSuffix(parts[1])
            && LooksLikeJobTitle(parts[0] + " " + parts[1]))
        {
            return (parts[0] + " - " + parts[1], null);
        }

        string? title = null;
        string? company = null;
        foreach (var part in parts)
        {
            var atMatch = AtRegex().Match(part);
            if (atMatch.Success)
            {
                var left = Clean(atMatch.Groups["left"].Value);
                var right = Clean(atMatch.Groups["right"].Value);
                if (title == null && LooksLikeJobTitle(left) && !IsNoise(left)) title = left;
                if (company == null && LooksLikeCompany(right)) company = right;
                continue;
            }

            if (title == null && LooksLikeJobTitle(part)) title = part;
            else if (company == null && LooksLikeCompany(part)) company = part;
        }

        return (title, company);
    }

    private static bool LooksLikeMotto(string text)
    {
        if (HasStrongRole(text) && WordCount(text) <= 12) return false;
        if (MottoCueRegex().IsMatch(text) && WordCount(text) >= 4) return true;
        if (MottoLeadRegex().IsMatch(text) && !HasStrongRole(text)) return true;
        return WordCount(text) >= 8 && !HasStrongRole(text) && !HasWeakRole(text);
    }

    private static bool LooksLikeLocation(string text)
    {
        if (HasStrongRole(text)) return false;
        return LocationRegex().IsMatch(text);
    }

    private static bool HasStrongRole(string text) => StrongRoleRegex().IsMatch(text);

    private static bool HasWeakRole(string text) => WeakRoleRegex().IsMatch(text);

    private static bool IsTitleSuffix(string text)
    {
        var key = text.Trim().ToLowerInvariant();
        return key is "platform" or "infrastructure" or "backend" or "frontend" or "fullstack"
            or "full-stack" or "full stack" or "growth" or "data" or "mobile" or "cloud"
            or "security" or "payments" or "billing" or "reliability" or "ml" or "ai"
            or "ops" or "systems" or "services" or "applications";
    }

    private static bool IsNoise(string text)
    {
        var key = text.Trim().ToLowerInvariant();
        return key is "linkedin" or "indeed" or "naukri" or "glassdoor" or "wellfound"
            or "jobs" or "job" or "careers" or "career" or "apply" or "application"
            or "job application" or "linkedin jobs";
    }

    private static bool IsSectionHeading(string text)
    {
        var key = text.Trim().ToLowerInvariant();
        return key is "about" or "about the role" or "about the job" or "about us" or "about the company"
            or "responsibilities" or "requirements" or "qualifications" or "benefits" or "description"
            or "overview" or "what you'll do" or "what you will do" or "who we are" or "the team"
            or "company" or "location" or "job description" or "the opportunity" or "why join"
            or "our mission" or "perks" or "who you are";
    }

    private static int WordCount(string text) =>
        text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;

    private static string Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;
        var text = WhitespaceRegex().Replace(value, " ").Trim();
        return text.Trim(' ', '"', '\'', '“', '”', '-', '–', '—', '|', '·', '•');
    }

    [GeneratedRegex(@"\s*(?:\||—|–|·|•)\s*|\s+-\s+|\s+::\s+", RegexOptions.CultureInvariant)]
    private static partial Regex SeparatorRegex();

    [GeneratedRegex(@"^(?<left>.+?)\s+at\s+(?<right>.+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex AtRegex();

    [GeneratedRegex(@"(?m)^#{1,3}\s+(.+?)\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex MarkdownHeadingRegex();

    [GeneratedRegex(@"(?im)^(?:job title|position|role)\s*[:\-]\s*(.+)$", RegexOptions.CultureInvariant)]
    private static partial Regex LabeledTitleRegex();

    [GeneratedRegex(@"(?im)^(?:company|employer|posted by)\s*[:\-]\s*\[?([^\]\r\n\(]+)", RegexOptions.CultureInvariant)]
    private static partial Regex LabeledCompanyRegex();

    [GeneratedRegex(@"\b(engineer|developer|programmer|architect|scientist|analyst|designer|manager|recruiter|internship|intern|consultant|specialist|coordinator|administrator|accountant|counsel|attorney|nurse|teacher|researcher|devops|sre|technician|strategist|scrum|tester|marketer|copywriter|editor|salesperson|representative|sde|swe|mts|tpm)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex StrongRoleRegex();

    [GeneratedRegex(@"\b(lead|head|director|principal|staff|associate|executive|officer|partner|president|vp|vice president)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex WeakRoleRegex();

    [GeneratedRegex(@"\b(we|our|your|the future|building|mission|empower\w*|helping|help teams|world|better|platform for|infrastructure for|infrastructure to|join us|welcome|gdp|delight|ship faster|for the internet|increase the)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MottoCueRegex();

    [GeneratedRegex(@"^(we|our|welcome|join|building|empowering|financial|the)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex MottoLeadRegex();

    [GeneratedRegex(@"\b(remote|hybrid|on-?site|onsite|india|usa|united states|united kingdom|canada|australia|germany|singapore|ireland|london|seattle|austin|boston|chicago|toronto|berlin|paris|amsterdam|dublin|sydney|bengaluru|bangalore|hyderabad|pune|mumbai|chennai|delhi|noida|gurgaon|gurugram|san francisco|new york|los angeles|mountain view|california|karnataka|washington)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex LocationRegex();

    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant)]
    private static partial Regex WhitespaceRegex();
}
