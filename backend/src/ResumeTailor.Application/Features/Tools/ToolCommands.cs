using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.Tools;

public record GenerateCoverLetterCommand(
    Guid GeneratedResumeId,
    string? Tone = "Professional", // Professional, Enthusiastic, Confident, Minimalist
    string? SpecificPoints = null
) : IRequest<Result<CoverLetterDto>>;

public record GenerateInterviewPrepCommand(
    Guid GeneratedResumeId
) : IRequest<Result<InterviewPrepDto>>;

public record GenerateSkillRoadmapCommand(
    Guid GeneratedResumeId
) : IRequest<Result<List<SkillRoadmapItem>>>;

public record CoverLetterDto(string Company, string Role, string Content, DateTime CreatedAtUtc);

public record InterviewPrepDto(
    string Company,
    string Role,
    List<InterviewQuestionItem> BehavioralQuestions,
    List<InterviewQuestionItem> TechnicalQuestions,
    List<InterviewQuestionItem> GapProbeQuestions,
    List<string> QuestionsToAskEmployer
);

public class InterviewQuestionItem
{
    public string Question { get; set; } = string.Empty;
    public string ContextWhyAsked { get; set; } = string.Empty;
    public string SuggestedStarApproach { get; set; } = string.Empty;
    public string ExampleTalkingPoint { get; set; } = string.Empty;
}

public class ToolCommandHandler :
    IRequestHandler<GenerateCoverLetterCommand, Result<CoverLetterDto>>,
    IRequestHandler<GenerateInterviewPrepCommand, Result<InterviewPrepDto>>,
    IRequestHandler<GenerateSkillRoadmapCommand, Result<List<SkillRoadmapItem>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiServiceFactory _aiServiceFactory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public ToolCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IAiServiceFactory aiServiceFactory)
    {
        _context = context;
        _currentUserService = currentUserService;
        _aiServiceFactory = aiServiceFactory;
    }

    public async Task<Result<CoverLetterDto>> Handle(GenerateCoverLetterCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var resume = await _context.GeneratedResumes
            .Include(g => g.JobDescription)
            .FirstOrDefaultAsync(g => g.Id == request.GeneratedResumeId && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.GeneratedResumeId);

        var resumeSchema = JsonSerializer.Deserialize<ResumeSchema>(resume.TailoredStructuredJson, JsonOptions) ?? new ResumeSchema();
        var jobSchema = JsonSerializer.Deserialize<JobDescriptionSchema>(resume.JobDescription?.ExtractedSchemaJson ?? "{}", JsonOptions) ?? new JobDescriptionSchema();

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var systemPrompt = $@"You are an executive career advisor. Write an exceptional, compelling, ATS-aligned cover letter for the candidate applying to {resume.TargetCompany} for the {resume.TargetRole} position.
Tone: {request.Tone}.
Guidelines:
- Highlight true achievements from the candidate's tailored resume.
- Connect candidate's past technical impact to company responsibilities.
- Avoid clichés. Keep it concise (under 400 words).
- Format in professional markdown.";

        var userPrompt = $@"
Candidate Name: {resumeSchema.PersonalInfo.FullName}
Target Role: {resume.TargetRole}
Target Company: {resume.TargetCompany}
Additional Focus Points: {request.SpecificPoints ?? "None"}

Candidate Experience Highlights:
{string.Join("\n", resumeSchema.Experience.SelectMany(e => e.Highlights).Take(5))}

Job Requirements:
{string.Join(", ", jobSchema.MustHaveSkills)}";

        var textResult = await aiProvider.GenerateTextAsync(
            systemPrompt,
            userPrompt,
            user.PreferredAiProvider switch
            {
                AiProviderType.OpenAi => user.CustomOpenAiKey,
                AiProviderType.Claude => user.CustomClaudeKey,
                AiProviderType.Gemini => user.CustomGeminiKey,
                _ => null
            },
            user.PreferredModel,
            cancellationToken
        );

        var content = textResult.IsSuccess ? textResult.Value : $"Dear Hiring Team at {resume.TargetCompany},\n\nI am excited to submit my application for the {resume.TargetRole} position...";

        return Result<CoverLetterDto>.Success(new CoverLetterDto(resume.TargetCompany, resume.TargetRole, content, DateTime.UtcNow));
    }

    public async Task<Result<InterviewPrepDto>> Handle(GenerateInterviewPrepCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var resume = await _context.GeneratedResumes
            .Include(g => g.JobDescription)
            .Include(g => g.AtsAnalysis)
            .FirstOrDefaultAsync(g => g.Id == request.GeneratedResumeId && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.GeneratedResumeId);

        var resumeSchema = JsonSerializer.Deserialize<ResumeSchema>(resume.TailoredStructuredJson, JsonOptions) ?? new ResumeSchema();
        var jobSchema = JsonSerializer.Deserialize<JobDescriptionSchema>(resume.JobDescription?.ExtractedSchemaJson ?? "{}", JsonOptions) ?? new JobDescriptionSchema();
        var atsAnalysis = JsonSerializer.Deserialize<AtsScoreBreakdown>(resume.AtsAnalysis?.AnalysisDataJson ?? "{}", JsonOptions) ?? new AtsScoreBreakdown();

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var systemPrompt = @"You are a Senior Technical Hiring Manager and Career Coach. Generate a comprehensive interview preparation guide tailored to the exact role and candidate profile.
Return a structured JSON object matching InterviewPrepDto with BehavioralQuestions, TechnicalQuestions, GapProbeQuestions, and QuestionsToAskEmployer.
Include STAR method guidance and talking points.";

        var userPrompt = $@"
Role: {resume.TargetRole} at {resume.TargetCompany}
Required Skills: {string.Join(", ", jobSchema.MustHaveSkills)}
Missing Skills: {string.Join(", ", atsAnalysis.MissingSkills)}
Candidate Background:
{JsonSerializer.Serialize(resumeSchema.Experience.Take(2), JsonOptions)}";

        var result = await aiProvider.GenerateStructuredJsonAsync<InterviewPrepDto>(
            systemPrompt,
            userPrompt,
            user.PreferredAiProvider switch
            {
                AiProviderType.OpenAi => user.CustomOpenAiKey,
                AiProviderType.Claude => user.CustomClaudeKey,
                AiProviderType.Gemini => user.CustomGeminiKey,
                _ => null
            },
            user.PreferredModel,
            cancellationToken
        );

        if (result.IsSuccess)
        {
            return Result<InterviewPrepDto>.Success(result.Value);
        }

        return Result<InterviewPrepDto>.Success(new InterviewPrepDto(
            resume.TargetCompany,
            resume.TargetRole,
            new List<InterviewQuestionItem>
            {
                new() { Question = "Describe a high-impact project you led and how you handled technical tradeoffs.", ContextWhyAsked = "Evaluates architectural leadership and execution.", SuggestedStarApproach = "Situation: Legacy scale bottleneck. Task: Redesign. Action: Decoupled services. Result: 40% latency reduction.", ExampleTalkingPoint = "Mention your recent architecture refactoring." }
            },
            new List<InterviewQuestionItem>
            {
                new() { Question = $"How do you design scalable systems using {string.Join(", ", jobSchema.Tools.Take(2))}?", ContextWhyAsked = "Verifies technical depth for key JD stack.", SuggestedStarApproach = "Discuss caching, consistency patterns, and concurrency.", ExampleTalkingPoint = "Reference your backend scaling achievements." }
            },
            new List<InterviewQuestionItem>
            {
                new() { Question = $"We see you have extensive backend experience, but how would you ramp up on {atsAnalysis.MissingSkills.FirstOrDefault() ?? "new cloud stacks"}?", ContextWhyAsked = "Probes potential skill gap identified in ATS scan.", SuggestedStarApproach = "Demonstrate fast learning agility and prior transferable patterns.", ExampleTalkingPoint = "Emphasize how quickly you mastered new frameworks previously." }
            },
            new List<string>
            {
                "What does the engineering team's current deployment cadence look like?",
                "What is the biggest architectural bottleneck the team is looking to solve this quarter?"
            }
        ));
    }

    public async Task<Result<List<SkillRoadmapItem>>> Handle(GenerateSkillRoadmapCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var resume = await _context.GeneratedResumes
            .Include(g => g.AtsAnalysis)
            .FirstOrDefaultAsync(g => g.Id == request.GeneratedResumeId && g.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(GeneratedResume), request.GeneratedResumeId);

        var atsAnalysis = JsonSerializer.Deserialize<AtsScoreBreakdown>(resume.AtsAnalysis?.AnalysisDataJson ?? "{}", JsonOptions) ?? new AtsScoreBreakdown();
        return Result<List<SkillRoadmapItem>>.Success(atsAnalysis.SkillRoadmap);
    }
}
