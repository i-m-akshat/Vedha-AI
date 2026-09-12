using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.Analytics;

public record GetDashboardAnalyticsQuery : IRequest<Result<DashboardAnalyticsDto>>;

public record DashboardAnalyticsDto(
    int TotalApplications,
    int ResumesGenerated,
    double AverageAtsScore,
    int InterviewsScheduled,
    int OffersReceived,
    List<ApplicationStatusCountDto> StatusBreakdown,
    List<ScoreTrendDto> RecentScoreTrends,
    List<SkillFrequencyDto> TopMissingSkills
);

public record ApplicationStatusCountDto(ApplicationStatus Status, int Count);
public record ScoreTrendDto(string Company, string Role, int Score, DateTime CreatedAtUtc);
public record SkillFrequencyDto(string Skill, int Frequency);

public class AnalyticsQueryHandler : IRequestHandler<GetDashboardAnalyticsQuery, Result<DashboardAnalyticsDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public AnalyticsQueryHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<DashboardAnalyticsDto>> Handle(GetDashboardAnalyticsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();

        var applications = await _context.Applications
            .Where(a => a.UserId == userId)
            .ToListAsync(cancellationToken);

        var generatedResumes = await _context.GeneratedResumes
            .Include(g => g.AtsAnalysis)
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var totalApps = applications.Count;
        var totalGenerated = generatedResumes.Count;
        var avgScore = generatedResumes.Any(g => g.AtsAnalysis != null)
            ? generatedResumes.Where(g => g.AtsAnalysis != null).Average(g => g.AtsAnalysis!.MatchScore)
            : 0;

        var interviews = applications.Count(a => a.Status == ApplicationStatus.Interviewing);
        var offers = applications.Count(a => a.Status == ApplicationStatus.Offered);

        var statusBreakdown = Enum.GetValues<ApplicationStatus>()
            .Select(s => new ApplicationStatusCountDto(s, applications.Count(a => a.Status == s)))
            .ToList();

        var trends = generatedResumes.Take(10).Select(g => new ScoreTrendDto(
            g.TargetCompany,
            g.TargetRole,
            g.AtsAnalysis?.MatchScore ?? 0,
            g.CreatedAtUtc
        )).ToList();

        // Extract top missing skills across recent ATS analyses
        var missingSkillsDict = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var g in generatedResumes.Take(20))
        {
            if (g.AtsAnalysis?.AnalysisDataJson != null)
            {
                var analysis = JsonSerializer.Deserialize<AtsScoreBreakdown>(g.AtsAnalysis.AnalysisDataJson, JsonOptions);
                if (analysis?.MissingSkills != null)
                {
                    foreach (var s in analysis.MissingSkills)
                    {
                        if (missingSkillsDict.ContainsKey(s)) missingSkillsDict[s]++;
                        else missingSkillsDict[s] = 1;
                    }
                }
            }
        }

        var topMissing = missingSkillsDict
            .OrderByDescending(kvp => kvp.Value)
            .Take(8)
            .Select(kvp => new SkillFrequencyDto(kvp.Key, kvp.Value))
            .ToList();

        return Result<DashboardAnalyticsDto>.Success(new DashboardAnalyticsDto(
            totalApps,
            totalGenerated,
            Math.Round(avgScore, 1),
            interviews,
            offers,
            statusBreakdown,
            trends,
            topMissing
        ));
    }
}
