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

public record DeleteMasterResumeCommand : IRequest<Result<bool>>;

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
    IRequestHandler<RevertToVersionCommand, Result<MasterResumeDto>>,
    IRequestHandler<DeleteMasterResumeCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;
    private readonly IAiServiceFactory _aiServiceFactory;
    private readonly IEnumerable<IDocumentParser> _documentParsers;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public MasterResumeCommandHandler(
        IApplicationDbContext context,
        ICurrentUserService currentUserService,
        IAiServiceFactory aiServiceFactory,
        IEnumerable<IDocumentParser> documentParsers)
    {
        _context = context;
        _currentUserService = currentUserService;
        _aiServiceFactory = aiServiceFactory;
        _documentParsers = documentParsers;
    }

    public async Task<Result<MasterResumeDto>> Handle(UploadAndParseMasterResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var extension = Path.GetExtension(request.FileName).ToLowerInvariant();
        var isMarkdownContent = request.ContentType.Contains("markdown", StringComparison.OrdinalIgnoreCase);
        if (extension is not ".pdf" and not ".docx" and not ".md" and not ".markdown" and not ".txt" && !isMarkdownContent)
            return Result<MasterResumeDto>.Failure($"Unsupported document format for '{request.FileName}'. Supported formats: PDF, DOCX, Markdown.");

        using var memoryStream = new MemoryStream();
        await request.FileStream.CopyToAsync(memoryStream, cancellationToken);
        var fileBytes = memoryStream.ToArray();

        var aiProvider = _aiServiceFactory.GetProvider(user.PreferredAiProvider);
        var customKey = user.PreferredAiProvider switch
        {
            AiProviderType.OpenAi => user.CustomOpenAiKey,
            AiProviderType.Claude => user.CustomClaudeKey,
            AiProviderType.Gemini => user.CustomGeminiKey,
            _ => null
        };

        var systemPrompt = @"You are an expert ATS Resume Parsing Engine. Extract 100% of ALL resume data with maximum accuracy and fidelity. Output ONLY a valid JSON object with this EXACT structure. Do NOT add extra fields. Do NOT use markdown fences.

Required JSON output structure:
{
  ""personalInfo"": {
    ""fullName"": ""string — candidate full name"",
    ""email"": ""string — email address"",
    ""phone"": ""string — phone number with country code"",
    ""location"": ""string — city, state/country"",
    ""title"": ""string — professional title or headline"",
    ""linkedInUrl"": ""string or null"",
    ""gitHubUrl"": ""string or null"",
    ""portfolioUrl"": ""string or null""
  },
  ""summary"": ""string — professional summary paragraph (write one if missing)"",
  ""experience"": [
    {
      ""id"": ""uuid"",
      ""company"": ""company name"",
      ""role"": ""job title"",
      ""location"": ""city, state"",
      ""startDate"": ""MMM YYYY format"",
      ""endDate"": ""MMM YYYY or empty if current"",
      ""isCurrent"": false,
      ""highlights"": [""achievement bullet 1"", ""achievement bullet 2""]
    }
  ],
  ""projects"": [
    {
      ""id"": ""uuid"",
      ""title"": ""project name"",
      ""description"": ""project description"",
      ""technologies"": ""comma-separated tech stack"",
      ""url"": ""url or null"",
      ""highlights"": [""achievement 1""]
    }
  ],
  ""skills"": [
    { ""categoryName"": ""Languages"", ""skills"": [""C#"", ""Python""] },
    { ""categoryName"": ""Frameworks"", ""skills"": [""ASP.NET Core"", ""React""] },
    { ""categoryName"": ""Databases"", ""skills"": [""PostgreSQL"", ""Redis""] },
    { ""categoryName"": ""Cloud & DevOps"", ""skills"": [""AWS"", ""Docker""] },
    { ""categoryName"": ""Tools"", ""skills"": [""Git"", ""Postman""] }
  ],
  ""education"": [
    {
      ""id"": ""uuid"",
      ""institution"": ""university name"",
      ""degree"": ""B.Tech or M.S."",
      ""fieldOfStudy"": ""Computer Science"",
      ""graduationYear"": ""2022"",
      ""gpa"": ""null or GPA string"",
      ""honors"": ""null or honors string""
    }
  ],
  ""certifications"": [
    {
      ""id"": ""uuid"",
      ""name"": ""cert name"",
      ""issuer"": ""issuer name"",
      ""issueDate"": ""MMM YYYY"",
      ""expirationDate"": null,
      ""credentialId"": null,
      ""url"": null
    }
  ],
  ""achievements"": [
    {
      ""id"": ""uuid"",
      ""title"": ""achievement title"",
      ""description"": ""description"",
      ""date"": ""YYYY or null""
    }
  ]
}

CRITICAL ACCURACY & INTEGRITY RULES:
1. ZERO DATA LOSS: Extract EVERY piece of information present in the resume. Never omit, summarize, shorten, or merge bullet points, jobs, projects, skills, education, or achievements.
2. PRESERVE ALL METRICS & VERBATIM BULLETS: In 'highlights', include EVERY single achievement bullet point. Retain all exact numbers, percentages (%), dollar amounts ($), team sizes, and technical stack terms verbatim.
3. MULTI-COLUMN & SIDEBAR SCANNING: Thoroughly inspect all columns, sidebars, headers, and footers to ensure contact links (LinkedIn, GitHub, Portfolio), certifications, and awards are fully captured.
4. SKILLS CATEGORIZATION: Extract ALL skills mentioned across the entire resume. Categorize them logically (Languages, Frameworks, Cloud, Databases, Developer Tools, Methodologies). Never drop any mentioned skill.
5. NEVER place personal info (name, email, phone, links) in experience highlights.
6. If a field is absent in the resume, use empty string """" or empty array [] — never null for required fields.
7. Generate a UUID for all ""id"" fields.
8. Do NOT hallucinate or invent information not present in the resume document.
";

        var mimeType = !string.IsNullOrWhiteSpace(request.ContentType) && request.ContentType != "application/octet-stream"
            ? request.ContentType
            : extension switch
            {
                ".pdf" => "application/pdf",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".md" or ".markdown" => "text/markdown",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };

        // Tier 1: Extract text locally using registered document parsers (PdfPig, OpenXml, Markdig)
        // This works even without AI API keys configured and is more cost-effective
        string extractedText = string.Empty;
        var localParser = _documentParsers.FirstOrDefault(p => p.CanParse(request.FileName, mimeType));
        if (localParser != null)
        {
            using var readStream = new MemoryStream(fileBytes);
            var parseResult = await localParser.ExtractTextAsync(readStream, request.FileName, cancellationToken);
            if (parseResult.IsSuccess && !string.IsNullOrWhiteSpace(parseResult.Value))
            {
                extractedText = parseResult.Value;
            }
        }

        ResumeSchema schema;
        if (!string.IsNullOrWhiteSpace(extractedText))
        {
            // Tier 2: Send extracted text to AI for structured JSON parsing
            var textResult = await aiProvider.GenerateStructuredJsonAsync<ResumeSchema>(
                systemPrompt,
                "Extract all resume content from this document text and output strictly structured JSON matching the required schema:\n\n" + extractedText,
                customKey,
                user.PreferredModel,
                cancellationToken
            );

            if (textResult.IsSuccess)
            {
                schema = textResult.Value;
            }
            else
            {
                // Tier 3 Fallback: If text-based parsing fails (e.g., scanned/image-based PDF), try multimodal AI parsing
                var multimodalResult = await aiProvider.ParseDocumentBytesAsync<ResumeSchema>(
                    fileBytes,
                    mimeType,
                    systemPrompt,
                    "Extract all resume content from this uploaded document and output strictly structured JSON matching the required schema.",
                    customKey,
                    user.PreferredModel,
                    cancellationToken
                );

                if (multimodalResult.IsSuccess)
                {
                    schema = multimodalResult.Value;
                }
                else
                {
                    return Result<MasterResumeDto>.Failure($"Failed to parse resume: {textResult.Error}. Multimodal fallback also failed: {multimodalResult.Error}");
                }
            }
        }
        else
        {
            // Local text extraction failed (e.g., scanned PDF), try multimodal AI parsing directly
            var multimodalResult = await aiProvider.ParseDocumentBytesAsync<ResumeSchema>(
                fileBytes,
                mimeType,
                systemPrompt,
                "Extract all resume content from this uploaded document and output strictly structured JSON matching the required schema.",
                customKey,
                user.PreferredModel,
                cancellationToken
            );

            if (multimodalResult.IsSuccess)
            {
                schema = multimodalResult.Value;
            }
            else
            {
                return Result<MasterResumeDto>.Failure($"Failed to extract text locally and multimodal AI parsing failed: {multimodalResult.Error}");
            }
        }

        var format = Path.GetExtension(request.FileName).ToLowerInvariant() switch
        {
            ".pdf" => ResumeFormat.Pdf,
            ".docx" => ResumeFormat.Docx,
            ".md" or ".markdown" or ".txt" => ResumeFormat.Markdown,
            _ => ResumeFormat.Pdf
        };

        var masterResume = await _context.MasterResumes
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);

        schema.NormalizeAndSortExperience();
        var jsonString = JsonSerializer.Serialize(schema, JsonOptions);

        // Auto-extract and populate CandidateProfile from parsed resume details (per user requirement)
        if (schema.PersonalInfo != null)
        {
            var candidateProfile = await _context.CandidateProfiles
                .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

            if (candidateProfile == null)
            {
                candidateProfile = new Domain.Entities.CandidateProfile
                {
                    UserId = userId,
                    PhoneNumber = schema.PersonalInfo.Phone ?? string.Empty,
                    LinkedInUrl = schema.PersonalInfo.LinkedInUrl ?? string.Empty,
                    GithubUrl = schema.PersonalInfo.GitHubUrl ?? string.Empty,
                    PortfolioUrl = schema.PersonalInfo.PortfolioUrl ?? string.Empty,
                    WorkAuthorizationStatus = "Authorized to work in current country",
                    NoticePeriodDays = 30,
                    RemotePreference = "Remote or Hybrid",
                    SalaryCurrency = "INR",
                    EvidenceKnowledgeBaseJson = "{}"
                };

                if (!string.IsNullOrWhiteSpace(schema.PersonalInfo.Location))
                {
                    var locParts = schema.PersonalInfo.Location.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                    if (locParts.Length > 0) candidateProfile.CurrentCity = locParts[0];
                    if (locParts.Length > 1) candidateProfile.CurrentCountry = locParts[1];
                }

                _context.CandidateProfiles.Add(candidateProfile);
            }
            else
            {
                bool profileDirty = false;

                if (string.IsNullOrWhiteSpace(candidateProfile.PhoneNumber) && !string.IsNullOrWhiteSpace(schema.PersonalInfo.Phone))
                {
                    candidateProfile.PhoneNumber = schema.PersonalInfo.Phone;
                    profileDirty = true;
                }

                if (string.IsNullOrWhiteSpace(candidateProfile.LinkedInUrl) && !string.IsNullOrWhiteSpace(schema.PersonalInfo.LinkedInUrl))
                {
                    candidateProfile.LinkedInUrl = schema.PersonalInfo.LinkedInUrl;
                    profileDirty = true;
                }

                if (string.IsNullOrWhiteSpace(candidateProfile.GithubUrl) && !string.IsNullOrWhiteSpace(schema.PersonalInfo.GitHubUrl))
                {
                    candidateProfile.GithubUrl = schema.PersonalInfo.GitHubUrl;
                    profileDirty = true;
                }

                if (string.IsNullOrWhiteSpace(candidateProfile.PortfolioUrl) && !string.IsNullOrWhiteSpace(schema.PersonalInfo.PortfolioUrl))
                {
                    candidateProfile.PortfolioUrl = schema.PersonalInfo.PortfolioUrl;
                    profileDirty = true;
                }

                if (!string.IsNullOrWhiteSpace(schema.PersonalInfo.Location))
                {
                    var locParts = schema.PersonalInfo.Location.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
                    if (locParts.Length > 0 && string.IsNullOrWhiteSpace(candidateProfile.CurrentCity))
                    {
                        candidateProfile.CurrentCity = locParts[0];
                        profileDirty = true;
                    }
                    if (locParts.Length > 1 && string.IsNullOrWhiteSpace(candidateProfile.CurrentCountry))
                    {
                        candidateProfile.CurrentCountry = locParts[1];
                        profileDirty = true;
                    }
                }

                if (profileDirty)
                {
                    candidateProfile.UpdatedAtUtc = DateTime.UtcNow;
                }
            }
        }

        if (masterResume == null)
        {
            masterResume = new MasterResume
            {
                UserId = userId,
                Title = Path.GetFileNameWithoutExtension(request.FileName),
                OriginalFileName = request.FileName,
                Format = format,
                RawExtractedText = string.Empty,
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
            masterResume.RawExtractedText = string.Empty;
            masterResume.StructuredJson = jsonString;
            masterResume.VersionNumber += 1;
            masterResume.UpdatedAtUtc = DateTime.UtcNow;
        }

        _context.ResumeVersions.Add(new ResumeVersion
        {
            MasterResumeId = masterResume.Id,
            VersionNumber = masterResume.VersionNumber,
            ChangeDescription = masterResume.VersionNumber == 1
                ? "Initial AI-parsed master resume upload"
                : "Replaced master resume with a new AI-parsed upload",
            StructuredJsonSnapshot = jsonString
        });

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

        request.Schema.NormalizeAndSortExperience();
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
        schema.NormalizeAndSortExperience();

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

    public async Task<Result<bool>> Handle(DeleteMasterResumeCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var masterResume = await _context.MasterResumes
            .Include(r => r.Versions)
            .Include(r => r.DerivedTailoredResumes)
            .FirstOrDefaultAsync(r => r.UserId == userId && r.IsActive, cancellationToken);

        if (masterResume == null)
            return Result<bool>.Failure("No active master resume found to delete.");

        // Remove linked versions
        if (masterResume.Versions.Any())
        {
            _context.ResumeVersions.RemoveRange(masterResume.Versions);
        }

        // Remove derived tailored resumes & their analyses
        if (masterResume.DerivedTailoredResumes.Any())
        {
            var derivedIds = masterResume.DerivedTailoredResumes.Select(d => d.Id).ToList();
            var atsAnalyses = await _context.AtsAnalyses
                .Where(a => derivedIds.Contains(a.GeneratedResumeId))
                .ToListAsync(cancellationToken);
            if (atsAnalyses.Any())
            {
                _context.AtsAnalyses.RemoveRange(atsAnalyses);
            }
            _context.GeneratedResumes.RemoveRange(masterResume.DerivedTailoredResumes);
        }

        _context.MasterResumes.Remove(masterResume);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true);
    }

}
