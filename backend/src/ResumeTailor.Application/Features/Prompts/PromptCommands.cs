using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Application.Features.Prompts;

public record GetPromptTemplatesQuery : IRequest<Result<List<PromptTemplateDto>>>;

public record SavePromptTemplateCommand(
    string TemplateKey,
    string Name,
    string Description,
    string SystemPrompt,
    string UserPromptTemplate
) : IRequest<Result<PromptTemplateDto>>;

public record ResetPromptTemplateCommand(string TemplateKey) : IRequest<Result<bool>>;

public record PromptTemplateDto(
    Guid Id,
    string TemplateKey,
    string Name,
    string Description,
    string SystemPrompt,
    string UserPromptTemplate,
    bool IsDefault
);

public class PromptCommandHandler :
    IRequestHandler<GetPromptTemplatesQuery, Result<List<PromptTemplateDto>>>,
    IRequestHandler<SavePromptTemplateCommand, Result<PromptTemplateDto>>,
    IRequestHandler<ResetPromptTemplateCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public PromptCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<List<PromptTemplateDto>>> Handle(GetPromptTemplatesQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId;
        var templates = await _context.PromptTemplates
            .Where(p => p.UserId == null || (userId.HasValue && p.UserId == userId.Value))
            .OrderBy(p => p.TemplateKey)
            .ToListAsync(cancellationToken);

        if (!templates.Any())
        {
            templates = GetDefaultTemplates();
        }

        var dtos = templates.Select(t => new PromptTemplateDto(
            t.Id,
            t.TemplateKey,
            t.Name,
            t.Description,
            t.SystemPrompt,
            t.UserPromptTemplate,
            t.IsDefault
        )).ToList();

        return Result<List<PromptTemplateDto>>.Success(dtos);
    }

    public async Task<Result<PromptTemplateDto>> Handle(SavePromptTemplateCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var existing = await _context.PromptTemplates
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TemplateKey == request.TemplateKey, cancellationToken);

        if (existing == null)
        {
            existing = new PromptTemplate
            {
                UserId = userId,
                TemplateKey = request.TemplateKey,
                Name = request.Name,
                Description = request.Description,
                SystemPrompt = request.SystemPrompt,
                UserPromptTemplate = request.UserPromptTemplate,
                IsDefault = false
            };
            _context.PromptTemplates.Add(existing);
        }
        else
        {
            existing.Name = request.Name;
            existing.Description = request.Description;
            existing.SystemPrompt = request.SystemPrompt;
            existing.UserPromptTemplate = request.UserPromptTemplate;
            existing.UpdatedAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Result<PromptTemplateDto>.Success(new PromptTemplateDto(
            existing.Id,
            existing.TemplateKey,
            existing.Name,
            existing.Description,
            existing.SystemPrompt,
            existing.UserPromptTemplate,
            existing.IsDefault
        ));
    }

    public async Task<Result<bool>> Handle(ResetPromptTemplateCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var existing = await _context.PromptTemplates
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TemplateKey == request.TemplateKey, cancellationToken);

        if (existing != null)
        {
            _context.PromptTemplates.Remove(existing);
            await _context.SaveChangesAsync(cancellationToken);
        }

        return Result<bool>.Success(true);
    }

    private static List<PromptTemplate> GetDefaultTemplates() => new()
    {
        new()
        {
            TemplateKey = "ResumeParser",
            Name = "Master Resume Parser",
            Description = "Extracts text from raw resumes into structured JSON ResumeSchema.",
            SystemPrompt = "You are an expert ATS Resume Parsing Engine. Extract raw resume text into a structured JSON matching ResumeSchema.",
            UserPromptTemplate = "Please parse the following resume text into JSON format:\n\n{rawText}",
            IsDefault = true
        },
        new()
        {
            TemplateKey = "ResumeTailor",
            Name = "Truth-Preserving Resume Tailor",
            Description = "Tailors resume to target job description with strict zero-hallucination rules.",
            SystemPrompt = "You are an executive resume writer. Reorganize and rewrite bullet points to align with the target job without inventing fake experience.",
            UserPromptTemplate = "Target Job:\n{jobDescription}\n\nMaster Resume:\n{masterResume}\n\nTailor the resume into ResumeSchema JSON:",
            IsDefault = true
        },
        new()
        {
            TemplateKey = "CoverLetter",
            Name = "Targeted Cover Letter",
            Description = "Generates compelling 1-page cover letter tailored to the target role.",
            SystemPrompt = "You are an executive career advisor. Write an exceptional, concise cover letter under 400 words.",
            UserPromptTemplate = "Company: {company}\nRole: {role}\nCandidate Experience: {experience}\nJob Requirements: {requirements}",
            IsDefault = true
        }
    };
}
