using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.JobDescriptionFeatures;

public record ScrapeJobUrlCommand(string Url) : IRequest<Result<JobDescriptionDto>>;

public record ParseRawJobDescriptionCommand(
    string RawText,
    string? Company = null,
    string? Title = null
) : IRequest<Result<JobDescriptionDto>>;

public record GetJobDescriptionsQuery : IRequest<Result<List<JobDescriptionDto>>>;

public record JobDescriptionDto(
    Guid Id,
    JobSource Source,
    string? SourceUrl,
    string TargetCompany,
    string TargetRole,
    string CleanedText,
    JobDescriptionSchema ExtractedSchema,
    DateTime CreatedAtUtc
);

public class JobDescriptionCommandHandler :
    IRequestHandler<ScrapeJobUrlCommand, Result<JobDescriptionDto>>,
    IRequestHandler<ParseRawJobDescriptionCommand, Result<JobDescriptionDto>>,
    IRequestHandler<GetJobDescriptionsQuery, Result<List<JobDescriptionDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IJobScraperService _scraperService;
    private readonly IAiServiceFactory _aiServiceFactory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public JobDescriptionCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IJobScraperService scraperService,
        IAiServiceFactory aiServiceFactory)
    {
        _context = context;
        _currentUserService = currentUserService;
        _scraperService = scraperService;
        _aiServiceFactory = aiServiceFactory;
    }

    public async Task<Result<JobDescriptionDto>> Handle(ScrapeJobUrlCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var scrapeResult = await _scraperService.ScrapeAsync(request.Url, cancellationToken);
        if (scrapeResult.IsFailure)
            return Result<JobDescriptionDto>.Failure(scrapeResult.Error!);

        var (cleanedText, company, title, source) = scrapeResult.Value;

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var schemaResult = await ExtractSchemaWithAiAsync(aiProvider, user, cleanedText, cancellationToken);
        if (schemaResult.IsFailure)
            return Result<JobDescriptionDto>.Failure(schemaResult.Error!);

        var schema = schemaResult.Value;

        if (!string.IsNullOrEmpty(company)) schema.Company = company;
        if (!string.IsNullOrEmpty(title)) schema.Title = title;

        var jobDescription = new JobDescription
        {
            UserId = userId,
            Source = source,
            SourceUrl = request.Url,
            TargetCompany = !string.IsNullOrWhiteSpace(schema.Company) ? schema.Company : "Target Company",
            TargetRole = !string.IsNullOrWhiteSpace(schema.Title) ? schema.Title : "Target Position",
            RawText = cleanedText,
            CleanedText = cleanedText,
            ExtractedSchemaJson = JsonSerializer.Serialize(schema, JsonOptions)
        };

        _context.JobDescriptions.Add(jobDescription);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<JobDescriptionDto>.Success(new JobDescriptionDto(
            jobDescription.Id,
            jobDescription.Source,
            jobDescription.SourceUrl,
            jobDescription.TargetCompany,
            jobDescription.TargetRole,
            jobDescription.CleanedText,
            schema,
            jobDescription.CreatedAtUtc
        ));
    }

    public async Task<Result<JobDescriptionDto>> Handle(ParseRawJobDescriptionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var schemaResult = await ExtractSchemaWithAiAsync(aiProvider, user, request.RawText, cancellationToken);
        if (schemaResult.IsFailure)
            return Result<JobDescriptionDto>.Failure(schemaResult.Error!);

        var schema = schemaResult.Value;

        if (!string.IsNullOrEmpty(request.Company)) schema.Company = request.Company;
        if (!string.IsNullOrEmpty(request.Title)) schema.Title = request.Title;

        var jobDescription = new JobDescription
        {
            UserId = userId,
            Source = JobSource.DirectText,
            SourceUrl = null,
            TargetCompany = !string.IsNullOrWhiteSpace(schema.Company) ? schema.Company : (request.Company ?? "Target Company"),
            TargetRole = !string.IsNullOrWhiteSpace(schema.Title) ? schema.Title : (request.Title ?? "Target Position"),
            RawText = request.RawText,
            CleanedText = request.RawText,
            ExtractedSchemaJson = JsonSerializer.Serialize(schema, JsonOptions)
        };

        _context.JobDescriptions.Add(jobDescription);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<JobDescriptionDto>.Success(new JobDescriptionDto(
            jobDescription.Id,
            jobDescription.Source,
            jobDescription.SourceUrl,
            jobDescription.TargetCompany,
            jobDescription.TargetRole,
            jobDescription.CleanedText,
            schema,
            jobDescription.CreatedAtUtc
        ));
    }

    public async Task<Result<List<JobDescriptionDto>>> Handle(GetJobDescriptionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var items = await _context.JobDescriptions
            .Where(j => j.UserId == userId)
            .OrderByDescending(j => j.CreatedAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(j =>
        {
            var schema = JsonSerializer.Deserialize<JobDescriptionSchema>(j.ExtractedSchemaJson, JsonOptions) ?? new JobDescriptionSchema();
            return new JobDescriptionDto(
                j.Id,
                j.Source,
                j.SourceUrl,
                j.TargetCompany,
                j.TargetRole,
                j.CleanedText,
                schema,
                j.CreatedAtUtc
            );
        }).ToList();

        return Result<List<JobDescriptionDto>>.Success(dtos);
    }

    private static async Task<Result<JobDescriptionSchema>> ExtractSchemaWithAiAsync(
        IAiProvider aiProvider,
        User user,
        string rawText,
        CancellationToken cancellationToken)
    {
        var systemPrompt = @"You are an expert Job Description Analyzer. Parse the raw job posting text and extract a structured JSON representation matching this exact schema:
{
  ""title"": ""Exact Job Title"",
  ""company"": ""Company Name"",
  ""location"": ""Location"",
  ""seniority"": ""Junior, Mid, Senior, Lead, Principal, etc."",
  ""experienceRequired"": ""e.g. 4-6 years"",
  ""salary"": ""Compensation if mentioned, else null"",
  ""mustHaveSkills"": [""Required core technical skills, programming languages, and critical competencies""],
  ""niceToHaveSkills"": [""Preferred skills, pluses, secondary competencies""],
  ""tools"": [""Developer tools, IDEs, version control, ticketing, e.g. Git, Postman, Docker""],
  ""frameworks"": [""Frameworks and libraries, e.g. .NET Core, ASP.NET Web API, React, Angular, Spring Boot""],
  ""databases"": [""Databases, e.g. SQL Server, PostgreSQL, MongoDB, Redis""],
  ""cloud"": [""Cloud platforms, e.g. AWS, Azure, GCP""],
  ""certifications"": [""Certifications if required""],
  ""softSkills"": [""Soft skills, e.g. Agile, Code Reviews, Communication, Problem Solving""],
  ""keywords"": [""Comprehensive list of technical keywords, role keywords, and domain search terms""],
  ""responsibilities"": [""Core duties and responsibilities""]
}
CRITICAL REQUIREMENT: You MUST extract all technical skills, programming languages, and competencies into mustHaveSkills, frameworks, tools, databases, and keywords. DO NOT leave mustHaveSkills or keywords empty if any technical requirements exist in the posting.";

        var userPrompt = $"Analyze the following job description and return the structured JSON schema:\n\n{rawText}";

        var result = await aiProvider.GenerateStructuredJsonAsync<JobDescriptionSchema>(
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

        JobDescriptionSchema schema;
        if (result.IsSuccess)
        {
            schema = result.Value;
        }
        else
        {
            var lines = rawText.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var inferredTitle = lines.FirstOrDefault(l => l.Length > 3 && l.Length < 60 && !l.StartsWith("http", StringComparison.OrdinalIgnoreCase)) ?? "Target Role";
            var inferredCompany = lines.Skip(1).FirstOrDefault(l => l.Length > 2 && l.Length < 50 && !l.StartsWith("http", StringComparison.OrdinalIgnoreCase)) ?? "Target Company";

            schema = new JobDescriptionSchema
            {
                Title = inferredTitle,
                Company = inferredCompany,
                Responsibilities = lines.Take(5).ToList()
            };
        }

        schema.EnsureKeywordsPopulated(rawText);

        // Dedicated AI fallback extraction strictly when none are coming
        if (schema.Keywords.Count == 0 && schema.MustHaveSkills.Count == 0 && !string.IsNullOrWhiteSpace(rawText))
        {
            await ExtractKeywordsFallbackWithAiAsync(aiProvider, user, schema, rawText, cancellationToken);
            schema.EnsureKeywordsPopulated(rawText);
        }

        return Result<JobDescriptionSchema>.Success(schema);
    }

    private static async Task ExtractKeywordsFallbackWithAiAsync(
        IAiProvider aiProvider,
        User user,
        JobDescriptionSchema schema,
        string rawText,
        CancellationToken cancellationToken)
    {
        var fallbackSystemPrompt = @"You are a Principal Technical Recruiter and ATS Keyword Extraction Engine.
Your SOLE TASK is to analyze the provided job description text and extract a comprehensive, granular list of technical skills, programming languages, libraries, frameworks, cloud services, databases, DevOps tools, architectural concepts, and engineering keywords.
Return valid JSON matching this exact structure:
{
  ""mustHaveSkills"": [""Mandatory technical skills and languages""],
  ""niceToHaveSkills"": [""Secondary or preferred skills""],
  ""tools"": [""Tools and platforms""],
  ""frameworks"": [""Frameworks and SDKs""],
  ""databases"": [""Databases and storage engines""],
  ""cloud"": [""Cloud and infrastructure services""],
  ""keywords"": [""Every distinct technical and role keyword found in the posting""]
}
CRITICAL REQUIREMENT: Extract at least 15-30 granular technical keywords. Do NOT return empty arrays.";

        var fallbackUserPrompt = $"Extract all technical skills and keywords from this job posting:\n\n{rawText}";
        var apiKey = user.PreferredAiProvider switch
        {
            AiProviderType.OpenAi => user.CustomOpenAiKey,
            AiProviderType.Claude => user.CustomClaudeKey,
            AiProviderType.Gemini => user.CustomGeminiKey,
            _ => null
        };

        var fallbackResult = await aiProvider.GenerateStructuredJsonAsync<JobDescriptionSchema>(
            fallbackSystemPrompt,
            fallbackUserPrompt,
            apiKey,
            user.PreferredModel,
            cancellationToken
        );

        if (fallbackResult.IsSuccess && fallbackResult.Value != null)
        {
            var fb = fallbackResult.Value;
            if (fb.MustHaveSkills != null && fb.MustHaveSkills.Any())
            {
                foreach (var s in fb.MustHaveSkills)
                {
                    if (!schema.MustHaveSkills.Contains(s, StringComparer.OrdinalIgnoreCase))
                        schema.MustHaveSkills.Add(s);
                }
            }
            if (fb.Keywords != null && fb.Keywords.Any())
            {
                var set = new HashSet<string>(schema.Keywords, StringComparer.OrdinalIgnoreCase);
                foreach (var k in fb.Keywords) set.Add(k);
                schema.Keywords = set.ToList();
            }
            if (fb.Tools != null && fb.Tools.Any() && !schema.Tools.Any())
                schema.Tools = fb.Tools;
            if (fb.Frameworks != null && fb.Frameworks.Any() && !schema.Frameworks.Any())
                schema.Frameworks = fb.Frameworks;
            if (fb.Databases != null && fb.Databases.Any() && !schema.Databases.Any())
                schema.Databases = fb.Databases;
            if (fb.Cloud != null && fb.Cloud.Any() && !schema.Cloud.Any())
                schema.Cloud = fb.Cloud;
        }
    }
}

