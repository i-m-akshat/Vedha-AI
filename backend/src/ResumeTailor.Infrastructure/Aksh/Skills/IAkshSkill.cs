using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

/// <summary>
/// Defines a discrete capability/skill that Aksh can dynamically load and execute.
/// Each skill bundles specialized domain instructions, trigger conditions,
/// the specific tool catalog required for that domain, and contextual prompt chips.
/// </summary>
public interface IAkshSkill
{
    /// <summary>Unique identifier for the skill (e.g. "resume-optimizer").</summary>
    string Id { get; }

    /// <summary>Human-readable display name (e.g. "Resume & ATS Bullet Optimizer").</summary>
    string DisplayName { get; }

    /// <summary>Brief summary of what this skill does.</summary>
    string Description { get; }

    /// <summary>Tools required/recommended for this skill.</summary>
    IReadOnlyList<string> RequiredTools { get; }

    /// <summary>Recommended prompt chips/starters for this domain skill.</summary>
    IReadOnlyList<string> SuggestedChips => Array.Empty<string>();

    /// <summary>Determines if this skill should be activated for the candidate's turn.</summary>
    bool CanHandle(string message, AkshSession session);

    /// <summary>Generates specialized prompt instructions for this skill.</summary>
    string GetInstructions(AkshSession session);
}
