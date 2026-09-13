using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Application.Features.CandidateProfile;

public class CandidateProfileDto
{
    public Guid Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string CurrentCity { get; set; } = string.Empty;
    public string CurrentCountry { get; set; } = string.Empty;
    public string WorkAuthorizationStatus { get; set; } = "Authorized to work in current country";
    public bool RequiresVisaSponsorship { get; set; } = false;
    public int NoticePeriodDays { get; set; } = 30;
    public string CurrentSalary { get; set; } = string.Empty;
    public string ExpectedSalary { get; set; } = string.Empty;
    public string SalaryCurrency { get; set; } = "INR";
    public bool WillingToRelocate { get; set; } = false;
    public string RemotePreference { get; set; } = "Remote or Hybrid";
    public string LinkedInUrl { get; set; } = string.Empty;
    public string GithubUrl { get; set; } = string.Empty;
    public string PortfolioUrl { get; set; } = string.Empty;
    public string? EqualEmploymentGender { get; set; }
    public string? EqualEmploymentRace { get; set; }
    public string? EqualEmploymentVeteran { get; set; }
    public string? EqualEmploymentDisability { get; set; }
    public Dictionary<string, string> EvidenceKnowledgeBase { get; set; } = new();
}

public class ScreeningQuestionMemoryDto
{
    public Guid Id { get; set; }
    public string Company { get; set; } = string.Empty;
    public string QuestionHash { get; set; } = string.Empty;
    public string QuestionText { get; set; } = string.Empty;
    public string AnswerText { get; set; } = string.Empty;
    public string FieldType { get; set; } = "text";
    public int SuccessCount { get; set; }
    public DateTime LastUsedAtUtc { get; set; }
}

public record GetCandidateProfileQuery(Guid UserId) : IRequest<Result<CandidateProfileDto>>;

public record UpdateCandidateProfileCommand(
    Guid UserId,
    string PhoneNumber,
    string CurrentCity,
    string CurrentCountry,
    string WorkAuthorizationStatus,
    bool RequiresVisaSponsorship,
    int NoticePeriodDays,
    string CurrentSalary,
    string ExpectedSalary,
    string SalaryCurrency,
    bool WillingToRelocate,
    string RemotePreference,
    string LinkedInUrl,
    string GithubUrl,
    string PortfolioUrl,
    string? EqualEmploymentGender,
    string? EqualEmploymentRace,
    string? EqualEmploymentVeteran,
    string? EqualEmploymentDisability,
    Dictionary<string, string> EvidenceKnowledgeBase
) : IRequest<Result<CandidateProfileDto>>;

public record GetScreeningMemoriesQuery(Guid UserId, string? Company) : IRequest<Result<List<ScreeningQuestionMemoryDto>>>;

public record SaveScreeningMemoryCommand(
    Guid UserId,
    string Company,
    string QuestionText,
    string AnswerText,
    string FieldType
) : IRequest<Result<ScreeningQuestionMemoryDto>>;

public class CandidateProfileHandlers :
    IRequestHandler<GetCandidateProfileQuery, Result<CandidateProfileDto>>,
    IRequestHandler<UpdateCandidateProfileCommand, Result<CandidateProfileDto>>,
    IRequestHandler<GetScreeningMemoriesQuery, Result<List<ScreeningQuestionMemoryDto>>>,
    IRequestHandler<SaveScreeningMemoryCommand, Result<ScreeningQuestionMemoryDto>>
{
    private readonly IApplicationDbContext _context;

    public CandidateProfileHandlers(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<CandidateProfileDto>> Handle(GetCandidateProfileQuery request, CancellationToken cancellationToken)
    {
        var profile = await _context.CandidateProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken);

        if (profile == null)
        {
            // Auto-create default profile for user if not yet initialized
            profile = new Domain.Entities.CandidateProfile
            {
                UserId = request.UserId,
                User = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken),
                WorkAuthorizationStatus = "Authorized to work in current country",
                NoticePeriodDays = 30,
                RemotePreference = "Remote or Hybrid",
                EvidenceKnowledgeBaseJson = "{}"
            };
            _context.CandidateProfiles.Add(profile);
            await _context.SaveChangesAsync(cancellationToken);
        }

        return Result<CandidateProfileDto>.Success(MapToDto(profile));
    }

    public async Task<Result<CandidateProfileDto>> Handle(UpdateCandidateProfileCommand request, CancellationToken cancellationToken)
    {
        var profile = await _context.CandidateProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == request.UserId, cancellationToken);

        if (profile == null)
        {
            profile = new Domain.Entities.CandidateProfile
            {
                UserId = request.UserId,
                User = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken)
            };
            _context.CandidateProfiles.Add(profile);
        }

        profile.PhoneNumber = request.PhoneNumber ?? string.Empty;
        profile.CurrentCity = request.CurrentCity ?? string.Empty;
        profile.CurrentCountry = request.CurrentCountry ?? string.Empty;
        profile.WorkAuthorizationStatus = request.WorkAuthorizationStatus ?? "Authorized to work";
        profile.RequiresVisaSponsorship = request.RequiresVisaSponsorship;
        profile.NoticePeriodDays = request.NoticePeriodDays;
        profile.CurrentSalary = request.CurrentSalary ?? string.Empty;
        profile.ExpectedSalary = request.ExpectedSalary ?? string.Empty;
        profile.SalaryCurrency = request.SalaryCurrency ?? "INR";
        profile.WillingToRelocate = request.WillingToRelocate;
        profile.RemotePreference = request.RemotePreference ?? "Remote or Hybrid";
        profile.LinkedInUrl = request.LinkedInUrl ?? string.Empty;
        profile.GithubUrl = request.GithubUrl ?? string.Empty;
        profile.PortfolioUrl = request.PortfolioUrl ?? string.Empty;
        profile.EqualEmploymentGender = request.EqualEmploymentGender;
        profile.EqualEmploymentRace = request.EqualEmploymentRace;
        profile.EqualEmploymentVeteran = request.EqualEmploymentVeteran;
        profile.EqualEmploymentDisability = request.EqualEmploymentDisability;
        profile.EvidenceKnowledgeBaseJson = JsonSerializer.Serialize(request.EvidenceKnowledgeBase ?? new Dictionary<string, string>());

        await _context.SaveChangesAsync(cancellationToken);

        return Result<CandidateProfileDto>.Success(MapToDto(profile));
    }

    public async Task<Result<List<ScreeningQuestionMemoryDto>>> Handle(GetScreeningMemoriesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.ScreeningQuestionMemories
            .Where(s => s.UserId == request.UserId);

        if (!string.IsNullOrWhiteSpace(request.Company))
        {
            query = query.Where(s => s.Company.ToLower() == request.Company.Trim().ToLower());
        }

        var items = await query
            .OrderByDescending(s => s.LastUsedAtUtc)
            .Select(s => new ScreeningQuestionMemoryDto
            {
                Id = s.Id,
                Company = s.Company,
                QuestionHash = s.QuestionHash,
                QuestionText = s.QuestionText,
                AnswerText = s.AnswerText,
                FieldType = s.FieldType,
                SuccessCount = s.SuccessCount,
                LastUsedAtUtc = s.LastUsedAtUtc
            })
            .ToListAsync(cancellationToken);

        return Result<List<ScreeningQuestionMemoryDto>>.Success(items);
    }

    public async Task<Result<ScreeningQuestionMemoryDto>> Handle(SaveScreeningMemoryCommand request, CancellationToken cancellationToken)
    {
        var normalizedQ = request.QuestionText.Trim().ToLowerInvariant();
        var hash = ComputeHash(normalizedQ);
        var company = request.Company.Trim();

        var existing = await _context.ScreeningQuestionMemories
            .FirstOrDefaultAsync(s => s.UserId == request.UserId && s.Company.ToLower() == company.ToLower() && s.QuestionHash == hash, cancellationToken);

        if (existing != null)
        {
            existing.AnswerText = request.AnswerText;
            existing.FieldType = request.FieldType;
            existing.SuccessCount += 1;
            existing.LastUsedAtUtc = DateTime.UtcNow;
        }
        else
        {
            existing = new ScreeningQuestionMemory
            {
                UserId = request.UserId,
                Company = company,
                QuestionHash = hash,
                QuestionText = request.QuestionText.Trim(),
                AnswerText = request.AnswerText.Trim(),
                FieldType = request.FieldType,
                SuccessCount = 1,
                LastUsedAtUtc = DateTime.UtcNow
            };
            _context.ScreeningQuestionMemories.Add(existing);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Result<ScreeningQuestionMemoryDto>.Success(new ScreeningQuestionMemoryDto
        {
            Id = existing.Id,
            Company = existing.Company,
            QuestionHash = existing.QuestionHash,
            QuestionText = existing.QuestionText,
            AnswerText = existing.AnswerText,
            FieldType = existing.FieldType,
            SuccessCount = existing.SuccessCount,
            LastUsedAtUtc = existing.LastUsedAtUtc
        });
    }

    private static CandidateProfileDto MapToDto(Domain.Entities.CandidateProfile profile)
    {
        Dictionary<string, string> evidence = new();
        try
        {
            if (!string.IsNullOrWhiteSpace(profile.EvidenceKnowledgeBaseJson))
            {
                evidence = JsonSerializer.Deserialize<Dictionary<string, string>>(profile.EvidenceKnowledgeBaseJson) ?? new();
            }
        }
        catch
        {
            evidence = new();
        }

        return new CandidateProfileDto
        {
            Id = profile.Id,
            FullName = profile.User?.FullName ?? string.Empty,
            PhoneNumber = profile.PhoneNumber,
            CurrentCity = profile.CurrentCity,
            CurrentCountry = profile.CurrentCountry,
            WorkAuthorizationStatus = profile.WorkAuthorizationStatus,
            RequiresVisaSponsorship = profile.RequiresVisaSponsorship,
            NoticePeriodDays = profile.NoticePeriodDays,
            CurrentSalary = profile.CurrentSalary,
            ExpectedSalary = profile.ExpectedSalary,
            SalaryCurrency = profile.SalaryCurrency ?? "INR",
            WillingToRelocate = profile.WillingToRelocate,
            RemotePreference = profile.RemotePreference,
            LinkedInUrl = profile.LinkedInUrl,
            GithubUrl = profile.GithubUrl,
            PortfolioUrl = profile.PortfolioUrl,
            EqualEmploymentGender = profile.EqualEmploymentGender,
            EqualEmploymentRace = profile.EqualEmploymentRace,
            EqualEmploymentVeteran = profile.EqualEmploymentVeteran,
            EqualEmploymentDisability = profile.EqualEmploymentDisability,
            EvidenceKnowledgeBase = evidence
        };
    }

    private static string ComputeHash(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
