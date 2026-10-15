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
        // Registered in evaluation priority order:
        // High-specificity domain skills first, with general career strategist as default fallback.
        _skills = new List<IAkshSkill>
        {
            new JobApplicationCopilotSkill(),
            new PlatformNavigatorSkill(),
            new ResumeOptimizerSkill(),
            new InterviewCoachSkill(),
            new SalaryNegotiatorSkill(),
            new ProfileAndQueueAuditSkill(),
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
