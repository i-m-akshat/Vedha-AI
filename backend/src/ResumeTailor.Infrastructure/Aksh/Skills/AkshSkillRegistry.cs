using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Infrastructure.Aksh.Skills;

public interface IAkshSkillRegistry
{
    IReadOnlyList<IAkshSkill> GetAllSkills();
    IAkshSkill ResolveSkill(string message, AkshSession session);
    IAkshSkill? GetSkill(string id);
}

public class AkshSkillRegistry : IAkshSkillRegistry
{
    private readonly List<IAkshSkill> _skills;

    public AkshSkillRegistry()
    {
        // Registered in specificity evaluation order:
        // Highly targeted domain skills evaluate first;
        // JobApplicationCopilot evaluates when explicit application directives or URLs are present;
        // CareerStrategist acts as the conversational fallback.
        _skills = new List<IAkshSkill>
        {
            new ProfileAndQueueAuditSkill(),
            new PlatformNavigatorSkill(),
            new InterviewCoachSkill(),
            new SalaryNegotiatorSkill(),
            new ResumeOptimizerSkill(),
            new JobApplicationCopilotSkill(),
            new CareerStrategistSkill(),
        };
    }

    public IReadOnlyList<IAkshSkill> GetAllSkills() => _skills.AsReadOnly();

    public IAkshSkill? GetSkill(string id) =>
        _skills.FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));

    public IAkshSkill ResolveSkill(string message, AkshSession session)
    {
        foreach (var skill in _skills)
        {
            if (skill.CanHandle(message, session))
            {
                return skill;
            }
        }

        return _skills.Last(); // CareerStrategistSkill fallback
    }
}
