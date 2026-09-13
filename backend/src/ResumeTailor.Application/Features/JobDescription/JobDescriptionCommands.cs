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
        var systemPrompt = @"You are an expert Job Description Analyzer. Parse the raw job posting text and extract a structured JSON representation matching JobDescriptionSchema.
Identify exact Title, Company, Location, Seniority, MustHaveSkills, NiceToHaveSkills, Tools, Frameworks, Databases, Cloud, Certifications, SoftSkills, and Key Responsibilities.";

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

        return result.IsSuccess
            ? Result<JobDescriptionSchema>.Success(result.Value)
            : Result<JobDescriptionSchema>.Failure($"Failed to parse job description with AI: {result.Error}");
    }
}
