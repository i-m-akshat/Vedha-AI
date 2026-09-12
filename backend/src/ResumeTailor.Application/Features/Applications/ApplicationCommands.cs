using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Application.Features.Applications;

public record CreateApplicationCommand(
    string CompanyName,
    string JobTitle,
    string? JobUrl,
    string? Location,
    string? SalaryRange,
    ApplicationStatus Status = ApplicationStatus.Saved,
    Guid? GeneratedResumeId = null,
    string? Notes = null
) : IRequest<Result<ApplicationRecordDto>>;

public record UpdateApplicationStatusCommand(
    Guid Id,
    ApplicationStatus Status,
    DateTime? AppliedDate = null,
    DateTime? NextInterviewDate = null
) : IRequest<Result<ApplicationRecordDto>>;

public record UpdateApplicationDetailsCommand(
    Guid Id,
    string CompanyName,
    string JobTitle,
    string? JobUrl,
    string? Location,
    string? SalaryRange,
    string? Notes,
    string? ContactPerson,
    string? ContactEmail
) : IRequest<Result<ApplicationRecordDto>>;

public record DeleteApplicationCommand(Guid Id) : IRequest<Result<bool>>;

public record GetApplicationsQuery(ApplicationStatus? FilterStatus = null) : IRequest<Result<List<ApplicationRecordDto>>>;

public record ApplicationRecordDto(
    Guid Id,
    Guid? GeneratedResumeId,
    string CompanyName,
    string JobTitle,
    string? JobUrl,
    string? Location,
    string? SalaryRange,
    ApplicationStatus Status,
    DateTime? AppliedDate,
    DateTime? NextInterviewDate,
    string? Notes,
    string? ContactPerson,
    string? ContactEmail,
    DateTime CreatedAtUtc
);

public class ApplicationCommandHandler :
    IRequestHandler<CreateApplicationCommand, Result<ApplicationRecordDto>>,
    IRequestHandler<UpdateApplicationStatusCommand, Result<ApplicationRecordDto>>,
    IRequestHandler<UpdateApplicationDetailsCommand, Result<ApplicationRecordDto>>,
    IRequestHandler<DeleteApplicationCommand, Result<bool>>,
    IRequestHandler<GetApplicationsQuery, Result<List<ApplicationRecordDto>>>
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public ApplicationCommandHandler(IApplicationDbContext context, ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    public async Task<Result<ApplicationRecordDto>> Handle(CreateApplicationCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();

        var record = new ApplicationRecord
        {
            UserId = userId,
            GeneratedResumeId = request.GeneratedResumeId,
            CompanyName = request.CompanyName,
            JobTitle = request.JobTitle,
            JobUrl = request.JobUrl,
            Location = request.Location,
            SalaryRange = request.SalaryRange,
            Status = request.Status,
            Notes = request.Notes,
            AppliedDate = request.Status == ApplicationStatus.Applied ? DateTime.UtcNow : null
        };

        _context.Applications.Add(record);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<ApplicationRecordDto>.Success(MapToDto(record));
    }

    public async Task<Result<ApplicationRecordDto>> Handle(UpdateApplicationStatusCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var record = await _context.Applications
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(ApplicationRecord), request.Id);

        record.Status = request.Status;
        if (request.AppliedDate.HasValue) record.AppliedDate = request.AppliedDate.Value;
        if (request.NextInterviewDate.HasValue) record.NextInterviewDate = request.NextInterviewDate.Value;
        record.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<ApplicationRecordDto>.Success(MapToDto(record));
    }

    public async Task<Result<ApplicationRecordDto>> Handle(UpdateApplicationDetailsCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var record = await _context.Applications
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(ApplicationRecord), request.Id);

        record.CompanyName = request.CompanyName;
        record.JobTitle = request.JobTitle;
        record.JobUrl = request.JobUrl;
        record.Location = request.Location;
        record.SalaryRange = request.SalaryRange;
        record.Notes = request.Notes;
        record.ContactPerson = request.ContactPerson;
        record.ContactEmail = request.ContactEmail;
        record.UpdatedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<ApplicationRecordDto>.Success(MapToDto(record));
    }

    public async Task<Result<bool>> Handle(DeleteApplicationCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var record = await _context.Applications
            .FirstOrDefaultAsync(a => a.Id == request.Id && a.UserId == userId, cancellationToken)
            ?? throw new NotFoundException(nameof(ApplicationRecord), request.Id);

        _context.Applications.Remove(record);
        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true);
    }

    public async Task<Result<List<ApplicationRecordDto>>> Handle(GetApplicationsQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var query = _context.Applications.Where(a => a.UserId == userId);

        if (request.FilterStatus.HasValue)
        {
            query = query.Where(a => a.Status == request.FilterStatus.Value);
        }

        var list = await query.OrderByDescending(a => a.CreatedAtUtc).ToListAsync(cancellationToken);
        return Result<List<ApplicationRecordDto>>.Success(list.Select(MapToDto).ToList());
    }

    private static ApplicationRecordDto MapToDto(ApplicationRecord a) => new(
        a.Id,
        a.GeneratedResumeId,
        a.CompanyName,
        a.JobTitle,
        a.JobUrl,
        a.Location,
        a.SalaryRange,
        a.Status,
        a.AppliedDate,
        a.NextInterviewDate,
        a.Notes,
        a.ContactPerson,
        a.ContactEmail,
        a.CreatedAtUtc
    );
}
