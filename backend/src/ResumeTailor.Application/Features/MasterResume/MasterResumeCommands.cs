using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Application.Features.MasterResumeFeatures;

public record UploadAndParseMasterResumeCommand(
    Stream FileStream,
    string FileName,
    string ContentType
) : IRequest<Result<MasterResumeDto>>;

public record UpdateMasterResumeCommand(
    string Title,
    ResumeSchema Schema,
    string? ChangeDescription
) : IRequest<Result<MasterResumeDto>>;

public record GetMasterResumeQuery : IRequest<Result<MasterResumeDto?>>;

public record GetResumeVersionsQuery : IRequest<Result<List<ResumeVersionDto>>>;

public record RevertToVersionCommand(Guid VersionId) : IRequest<Result<MasterResumeDto>>;

public record MasterResumeDto(
    Guid Id,
    string Title,
    string OriginalFileName,
    ResumeFormat Format,
    int VersionNumber,
    ResumeSchema Schema,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc
);

public record ResumeVersionDto(
    Guid Id,
    int VersionNumber,
    string ChangeDescription,
    DateTime CreatedAtUtc
);

public class MasterResumeCommandHandler :
    IRequestHandler<UploadAndParseMasterResumeCommand, Result<MasterResumeDto>>,
    IRequestHandler<UpdateMasterResumeCommand, Result<MasterResumeDto>>,
    IRequestHandler<GetMasterResumeQuery, Result<MasterResumeDto?>>,
    IRequestHandler<GetResumeVersionsQuery, Result<List<ResumeVersionDto>>>,
    IRequestHandler<RevertToVersionCommand, Result<MasterResumeDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IEnumerable<IDocumentParser> _documentParsers;
    private readonly IAiServiceFactory _aiServiceFactory;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public MasterResumeCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IEnumerable<IDocumentParser> documentParsers,
        IAiServiceFactory aiServiceFactory)
    {
        _context = context;
        _currentUserService = currentUserService;
        _documentParsers = documentParsers;
        _aiServiceFactory = aiServiceFactory;
    }

    public async Task<Result<MasterResumeDto>> Handle(UploadAndParseMasterResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var parser = _documentParsers.FirstOrDefault(p => p.CanParse(request.FileName, request.ContentType));
        if (parser == null)
            return Result<MasterResumeDto>.Failure($"Unsupported document format for '{request.FileName}'. Supported formats: PDF, DOCX, Markdown.");

        var textExtractResult = await parser.ExtractTextAsync(request.FileStream, request.FileName, cancellationToken);
        if (textExtractResult.IsFailure)
            return Result<MasterResumeDto>.Failure(textExtractResult.Error!);

        var rawText = textExtractResult.Value;

        // Parse structured schema using AI
        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var systemPrompt = @"You are an expert ATS Resume Parsing Engine. Your job is to extract raw resume text into a perfectly structured JSON object matching the exact ResumeSchema. 
Ensure all dates, companies, roles, bullet points, skills (categorized into Languages, Frameworks, Databases, Cloud, Tools, Soft Skills), education, certifications, and achievements are captured with 100% precision. Never omit or invent information.";

        var userPrompt = $"Please parse the following resume text into JSON format:\n\n{rawText}";

        var structuredResult = await aiProvider.GenerateStructuredJsonAsync<ResumeSchema>(
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

        var schema = structuredResult.IsSuccess ? structuredResult.Value : new ResumeSchema
        {
            Summary = "Uploaded resume content",
            Experience = new List<WorkExperienceItem>
            {
                new() { Company = "Work Experience", Role = "Extracted Position", Highlights = rawText.Split('\n', StringSplitOptions.RemoveEmptyEntries).Take(5).ToList() }
            }
        };

        var format = Path.GetExtension(request.FileName).ToLowerInvariant() switch
        {
            ".pdf" => ResumeFormat.Pdf,
            ".docx" => ResumeFormat.Docx,
            ".md" => ResumeFormat.Markdown,
            _ => ResumeFormat.Pdf
        };

        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);

        var jsonString = JsonSerializer.Serialize(schema, JsonOptions);

        if (masterResume == null)
        {
            masterResume = new MasterResume
            {
                UserId = userId,
                Title = Path.GetFileNameWithoutExtension(request.FileName),
                OriginalFileName = request.FileName,
                Format = format,
                RawExtractedText = rawText,
                StructuredJson = jsonString,
                IsActive = true,
                VersionNumber = 1
            };
            _context.MasterResumes.Add(masterResume);
        }
        else
        {
            masterResume.Title = Path.GetFileNameWithoutExtension(request.FileName);
            masterResume.OriginalFileName = request.FileName;
            masterResume.Format = format;
            masterResume.RawExtractedText = rawText;
            masterResume.StructuredJson = jsonString;
            masterResume.VersionNumber += 1;
            masterResume.UpdatedAtUtc = DateTime.UtcNow;
        }

        // Record version snapshot
        var version = new ResumeVersion
        {
            MasterResumeId = masterResume.Id,
            VersionNumber = masterResume.VersionNumber,
            ChangeDescription = $"Uploaded new file '{request.FileName}'",
            StructuredJsonSnapshot = jsonString
        };
        _context.ResumeVersions.Add(version);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<MasterResumeDto>.Success(new MasterResumeDto(
            masterResume.Id,
            masterResume.Title,
            masterResume.OriginalFileName,
            masterResume.Format,
            masterResume.VersionNumber,
            schema,
            masterResume.CreatedAtUtc,
            masterResume.UpdatedAtUtc
        ));
    }

    public async Task<Result<MasterResumeDto>> Handle(UpdateMasterResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken)
            ?? throw new NotFoundException(nameof(MasterResume), userId);

        var jsonString = JsonSerializer.Serialize(request.Schema, JsonOptions);
        masterResume.Title = request.Title;
        masterResume.StructuredJson = jsonString;
        masterResume.VersionNumber += 1;
        masterResume.UpdatedAtUtc = DateTime.UtcNow;

        var version = new ResumeVersion
        {
            MasterResumeId = masterResume.Id,
            VersionNumber = masterResume.VersionNumber,
            ChangeDescription = request.ChangeDescription ?? "Manual edit via Master Resume Studio",
            StructuredJsonSnapshot = jsonString
        };
        _context.ResumeVersions.Add(version);

        await _context.SaveChangesAsync(cancellationToken);

        return Result<MasterResumeDto>.Success(new MasterResumeDto(
            masterResume.Id,
            masterResume.Title,
            masterResume.OriginalFileName,
            masterResume.Format,
            masterResume.VersionNumber,
            request.Schema,
            masterResume.CreatedAtUtc,
            masterResume.UpdatedAtUtc
        ));
    }

    public async Task<Result<MasterResumeDto?>> Handle(GetMasterResumeQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);

        if (masterResume == null)
            return Result<MasterResumeDto?>.Success(null);

        var schema = JsonSerializer.Deserialize<ResumeSchema>(masterResume.StructuredJson, JsonOptions) ?? new ResumeSchema();

        return Result<MasterResumeDto?>.Success(new MasterResumeDto(
            masterResume.Id,
            masterResume.Title,
            masterResume.OriginalFileName,
            masterResume.Format,
            masterResume.VersionNumber,
            schema,
            masterResume.CreatedAtUtc,
            masterResume.UpdatedAtUtc
        ));
    }

    public async Task<Result<List<ResumeVersionDto>>> Handle(GetResumeVersionsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);

        if (masterResume == null)
            return Result<List<ResumeVersionDto>>.Success(new List<ResumeVersionDto>());

        var versions = await _context.ResumeVersions
            .Where(v => v.MasterResumeId == masterResume.Id)
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new ResumeVersionDto(v.Id, v.VersionNumber, v.ChangeDescription, v.CreatedAtUtc))
            .ToListAsync(cancellationToken);

        return Result<List<ResumeVersionDto>>.Success(versions);
    }

    public async Task<Result<MasterResumeDto>> Handle(RevertToVersionCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken)
            ?? throw new NotFoundException(nameof(MasterResume), userId);

        var targetVersion = await _context.ResumeVersions
            .FirstOrDefaultAsync(v => v.Id == request.VersionId && v.MasterResumeId == masterResume.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(ResumeVersion), request.VersionId);

        masterResume.StructuredJson = targetVersion.StructuredJsonSnapshot;
        masterResume.VersionNumber += 1;
        masterResume.UpdatedAtUtc = DateTime.UtcNow;

        var newVersion = new ResumeVersion
        {
            MasterResumeId = masterResume.Id,
            VersionNumber = masterResume.VersionNumber,
            ChangeDescription = $"Reverted to Version #{targetVersion.VersionNumber}",
            StructuredJsonSnapshot = targetVersion.StructuredJsonSnapshot
        };
        _context.ResumeVersions.Add(newVersion);

        await _context.SaveChangesAsync(cancellationToken);

        var schema = JsonSerializer.Deserialize<ResumeSchema>(masterResume.StructuredJson, JsonOptions) ?? new ResumeSchema();

        return Result<MasterResumeDto>.Success(new MasterResumeDto(
            masterResume.Id,
            masterResume.Title,
            masterResume.OriginalFileName,
            masterResume.Format,
            masterResume.VersionNumber,
            schema,
            masterResume.CreatedAtUtc,
            masterResume.UpdatedAtUtc
        ));
    }
}
