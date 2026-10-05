using System.Text.Json;
using System.Text.Json.Serialization;
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

public class FlexibleStringConverter : JsonConverter<string>
{
    public override string Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
            return reader.GetString() ?? string.Empty;

        if (reader.TokenType == JsonTokenType.StartObject)
        {
            using var doc = JsonDocument.ParseValue(ref reader);
            var parts = new List<string>();
            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var val = prop.Value.ValueKind == JsonValueKind.String ? prop.Value.GetString() : prop.Value.GetRawText();
                parts.Add($"{prop.Name}: {val}");
            }
            return string.Join(" | ", parts);
        }

        return string.Empty;
    }

    public override void Write(Utf8JsonWriter writer, string value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(value);
    }
}

public class FlexibleStringListConverter : JsonConverter<List<string>>
{
    public override List<string> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var list = new List<string>();
        if (reader.TokenType != JsonTokenType.StartArray)
            return list;

        while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
        {
            if (reader.TokenType == JsonTokenType.String)
            {
                var s = reader.GetString();
                if (!string.IsNullOrWhiteSpace(s)) list.Add(s);
            }
            else if (reader.TokenType == JsonTokenType.StartObject)
            {
                using var doc = JsonDocument.ParseValue(ref reader);
                if (doc.RootElement.TryGetProperty("question", out var q) && q.ValueKind == JsonValueKind.String)
                {
                    var qStr = q.GetString();
                    if (doc.RootElement.TryGetProperty("category", out var c) && c.ValueKind == JsonValueKind.String)
                    {
                        list.Add($"[{c.GetString()}] {qStr}");
                    }
                    else
                    {
                        list.Add(qStr ?? string.Empty);
                    }
                }
                else
                {
                    list.Add(doc.RootElement.GetRawText());
                }
            }
            else
            {
                reader.Skip();
            }
        }
        return list;
    }

    public override void Write(Utf8JsonWriter writer, List<string> value, JsonSerializerOptions options)
    {
        writer.WriteStartArray();
        foreach (var item in value)
        {
            writer.WriteStringValue(item);
        }
        writer.WriteEndArray();
    }
}

public record InterviewPrepDto(
    string Company,
    string Role,
    List<InterviewQuestionItem> BehavioralQuestions,
    List<InterviewQuestionItem> TechnicalQuestions,
    List<InterviewQuestionItem> GapProbeQuestions,
    [property: JsonConverter(typeof(FlexibleStringListConverter))] List<string> QuestionsToAskEmployer
);

public class InterviewQuestionItem
{
    public string Question { get; set; } = string.Empty;
    public string ContextWhyAsked { get; set; } = string.Empty;
    [JsonConverter(typeof(FlexibleStringConverter))]
    public string SuggestedStarApproach { get; set; } = string.Empty;
    [JsonConverter(typeof(FlexibleStringConverter))]
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

        var company = !string.IsNullOrWhiteSpace(resume.TargetCompany) && resume.TargetCompany != "Company" && resume.TargetCompany != "Target Company"
            ? resume.TargetCompany
            : (!string.IsNullOrWhiteSpace(jobSchema.Company) ? jobSchema.Company : "[Company Name]");

        var role = !string.IsNullOrWhiteSpace(resume.TargetRole) && resume.TargetRole != "Role" && resume.TargetRole != "Target Position"
            ? resume.TargetRole
            : (!string.IsNullOrWhiteSpace(jobSchema.Title) ? jobSchema.Title : resumeSchema.PersonalInfo.Title ?? "Software Engineer");

        var skills = jobSchema.MustHaveSkills.Count > 0
            ? string.Join(", ", jobSchema.MustHaveSkills)
            : (jobSchema.Keywords.Count > 0 
                ? string.Join(", ", jobSchema.Keywords) 
                : (resume.JobDescription?.CleanedText != null && resume.JobDescription.CleanedText.Length > 20
                    ? resume.JobDescription.CleanedText.Substring(0, Math.Min(600, resume.JobDescription.CleanedText.Length))
                    : "Key engineering responsibilities and problem-solving skills"));

        var candidateHighlights = resumeSchema.Experience.SelectMany(e => e.Highlights).Take(5).ToList();
        if (candidateHighlights.Count == 0 && resumeSchema.Projects.Count > 0)
        {
            candidateHighlights = resumeSchema.Projects.SelectMany(p => p.Highlights).Take(5).ToList();
        }

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var systemPrompt = $@"You are an executive career advisor. Write an exceptional, compelling, ATS-aligned cover letter for the candidate applying to {company} for the {role} position.
Tone: {request.Tone}.
Guidelines:
- Output a clean, ready-to-send business letter formatted with clear paragraph breaks.
- Do NOT output markdown code fences (like ```markdown), hashtags (#), or bullet points. Use standard formal letter paragraphs.
- Start with date, candidate contact header, and salutation ('Dear Hiring Team at {company},').
- Include an impactful opening paragraph, 1-2 evidence-backed body paragraphs connecting candidate's past metrics to the role requirements, and a confident closing.
- End with professional sign-off ('Sincerely,') and candidate's full name.
- Keep it concise (under 350 words).";

        var userPrompt = $@"
Candidate Name: {resumeSchema.PersonalInfo.FullName}
Candidate Email: {resumeSchema.PersonalInfo.Email}
Candidate Phone: {resumeSchema.PersonalInfo.Phone}
Target Role: {role}
Target Company: {company}
Additional Focus Points: {request.SpecificPoints ?? "None"}

Candidate Experience Highlights:
{string.Join("\n", candidateHighlights)}

Job Requirements & Stack:
{skills}";

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

        if (textResult.IsFailure)
        {
            return Result<CoverLetterDto>.Failure($"Failed to generate cover letter: {textResult.Error}");
        }

        var cleanContent = textResult.Value.Trim();
        if (cleanContent.StartsWith("```markdown", StringComparison.OrdinalIgnoreCase))
            cleanContent = cleanContent.Substring("```markdown".Length);
        else if (cleanContent.StartsWith("```", StringComparison.OrdinalIgnoreCase))
            cleanContent = cleanContent.Substring(3);
        if (cleanContent.EndsWith("```", StringComparison.OrdinalIgnoreCase))
            cleanContent = cleanContent.Substring(0, cleanContent.Length - 3);
        cleanContent = cleanContent.Trim();

        return Result<CoverLetterDto>.Success(new CoverLetterDto(company, role, cleanContent, DateTime.UtcNow));
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
Output ONLY a valid JSON object with this EXACT structure (no markdown fences, no extra fields):
{
  ""company"": ""Company Name"",
  ""role"": ""Role Title"",
  ""behavioralQuestions"": [
    {
      ""question"": ""Behavioral interview question"",
      ""contextWhyAsked"": ""Why the hiring manager asks this question"",
      ""suggestedStarApproach"": ""Recommended Situation, Task, Action, Result response guidance"",
      ""exampleTalkingPoint"": ""Key highlight or story from candidate's experience to share""
    }
  ],
  ""technicalQuestions"": [
    {
      ""question"": ""Technical deep-dive question assessing required competencies"",
      ""contextWhyAsked"": ""Why this technical concept is critical for this job"",
      ""suggestedStarApproach"": ""Technical approach, trade-offs, and architecture best practices"",
      ""exampleTalkingPoint"": ""Real-world project example from candidate's background""
    }
  ],
  ""gapProbeQuestions"": [
    {
      ""question"": ""Probe regarding missing or adjacent skills"",
      ""contextWhyAsked"": ""Addresses potential gap identified in resume match"",
      ""suggestedStarApproach"": ""How to frame fast learning agility and transferable skills"",
      ""exampleTalkingPoint"": ""Adjacent technology candidate has mastered successfully""
    }
  ],
  ""questionsToAskEmployer"": [
    ""Strategic question 1 candidate should ask interviewer"",
    ""Strategic question 2 candidate should ask interviewer"",
    ""Strategic question 3 candidate should ask interviewer""
  ]
}";


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

        if (result.IsFailure)
        {
            return Result<InterviewPrepDto>.Failure($"Failed to generate interview preparation guide: {result.Error}");
        }

        return Result<InterviewPrepDto>.Success(result.Value);
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
