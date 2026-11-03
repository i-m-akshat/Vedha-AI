using System.Text.RegularExpressions;

namespace ResumeTailor.Application.Features.Aksh;

/// <summary>
/// Deterministic turn understanding (zero tokens). Intent and URLs are extracted
/// with strict lexical rules to guide agent execution and prevent pipeline stalls.
/// </summary>
public static partial class AkshIntent
{
    [GeneratedRegex(@"https?://[^\s)>\]]+", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex UrlRegex();

    [GeneratedRegex(@"\b(apply|submit|send application|file application|finalize|auto-?apply)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex ApplyWordRegex();

    [GeneratedRegex(@"\bapply\s+(?:the\s+)?(?:xyz|star|formula|technique|method|rule|bullet)", RegexOptions.IgnoreCase | RegexOptions.Compiled)]
    private static partial Regex ApplyFormulaExclusionRegex();

    private static readonly string[] ContinueWords =
        ["continue", "proceed", "go ahead", "do it", "yes please", "yes, please", "go on", "keep going", "next step"];

    private static readonly string[] GenerateWords =
        ["generate", "create", "make", "build", "tailor", "prepare", "draft", "write", "new resume", "cover letter", "package"];

    /// <summary>Extracts http(s) URLs, trimming trailing punctuation chat clients add.</summary>
    public static List<string> ExtractJobUrls(string? text)
    {
        var urls = new List<string>();
        if (string.IsNullOrWhiteSpace(text))
        {
            return urls;
        }

        foreach (Match match in UrlRegex().Matches(text))
        {
            var url = match.Value.Trim().TrimEnd('.', ',', ';', '!', '?', ')', ']', '"', '\'');
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri)
                && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                && !urls.Contains(url, StringComparer.OrdinalIgnoreCase))
            {
                urls.Add(url);
            }
        }

        return urls;
    }

    private static readonly string[] GreetingWords =
    [
        "hi", "hello", "hey", "hola", "greetings", "good morning", "good afternoon", "good evening",
        "sup", "yo", "namaste", "who are you", "what can you do", "help", "how are you", "what is this",
        "thanks", "thank you", "ok", "okay", "cool", "got it", "nice", "awesome", "great", "who made you"
    ];

    public static bool HasContinueIntent(string? text) => ContainsAny(text, ContinueWords);

    /// <summary>True when the candidate explicitly asks for package generation or tailoring.</summary>
    public static bool HasGenerateIntent(string? text) => ContainsAny(text, GenerateWords);

    /// <summary>True when the candidate explicitly asks to apply/submit for a job.</summary>
    public static bool HasApplyIntent(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        return ApplyWordRegex().IsMatch(text) && !ApplyFormulaExclusionRegex().IsMatch(text);
    }

    /// <summary>True when the turn is a conversational greeting, acknowledgement, or general inquiry requiring no tool calls.</summary>
    public static bool IsGreetingOrGeneralChat(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return false;
        var trimmed = text.Trim().TrimEnd('.', '!', '?', ',', ';', ' ').ToLowerInvariant();
        return GreetingWords.Any(w => trimmed == w || trimmed.StartsWith(w + " ") || trimmed.EndsWith(" " + w));
    }

    /// <summary>First plan step not yet done (skips nulls safely).</summary>
    public static AkshTodoItemDto? NextPendingStep(IEnumerable<AkshTodoItemDto>? todos)
        => todos?.FirstOrDefault(t => !string.Equals(t.State, "done", StringComparison.OrdinalIgnoreCase));

    /// <summary>Returns a copy of the plan with every matching tool step marked to the given state.</summary>
    public static List<AkshTodoItemDto> MarkSteps(IEnumerable<AkshTodoItemDto>? todos, string state, params string[] tools)
    {
        var plan = todos?.ToList() ?? new List<AkshTodoItemDto>();
        var toolSet = new HashSet<string>(tools, StringComparer.OrdinalIgnoreCase);
        foreach (var step in plan)
        {
            if (step.Tool != null && toolSet.Contains(step.Tool))
            {
                step.State = state;
            }
        }

        return plan;
    }

    private static bool ContainsAny(string? text, string[] words)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        var lower = text.ToLowerInvariant();
        return words.Any(lower.Contains);
    }
}
