using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Application.Features.AutonomousApplications;

// --- DTOs ---

public record ApplicationAuditDto(
    Guid Id,
    string JobTitle,
    string CompanyName,
    string JobUrl,
    string Status,
    string? ResumeS3Url,
    string? ErrorMessage,
    string? HitlQuestion,
    string? HitlAnswer,
    DateTime? AppliedAtUtc,
    DateTime CreatedAtUtc
);

public record CareerAchievementDto(
    Guid Id,
    string Content,
    int EmbeddingDimension,
    DateTime CreatedAtUtc
);

public record IngestJobResponse(
    Guid ApplicationId,
    string Status,
    string QueueTopic,
    string Message
);

public record UserCreditsDto(
    int CreditsBalance,
    string Email
);

// --- Ingest Job Command ---

public record IngestJobCommand(
    Guid UserId,
    string JobTitle,
    string CompanyName,
    string JobUrl,
    string JobDescription
) : IRequest<Result<IngestJobResponse>>;

public class IngestJobCommandHandler : IRequestHandler<IngestJobCommand, Result<IngestJobResponse>>
{
    private readonly IApplicationDbContext _context;
    private readonly INatsEventBus _eventBus;

    public IngestJobCommandHandler(IApplicationDbContext context, INatsEventBus eventBus)
    {
        _context = context;
        _eventBus = eventBus;
    }

    public async Task<Result<IngestJobResponse>> Handle(IngestJobCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.JobUrl))
            return Result<IngestJobResponse>.Failure("Job URL is required.");

        var application = new ApplicationAudit
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            JobTitle = string.IsNullOrWhiteSpace(request.JobTitle) ? "Software Engineer" : request.JobTitle,
            CompanyName = string.IsNullOrWhiteSpace(request.CompanyName) ? "Target Employer" : request.CompanyName,
            JobUrl = request.JobUrl,
            Status = "pending"
        };

        _context.ApplicationAudits.Add(application);
        await _context.SaveChangesAsync(cancellationToken);

        // Publish 'app.job.ingested' event to NATS JetStream
        var payload = new
        {
            application_id = application.Id.ToString(),
            user_id = request.UserId.ToString(),
            job_title = application.JobTitle,
            company_name = application.CompanyName,
            job_url = application.JobUrl,
            job_description = request.JobDescription
        };

        await _eventBus.PublishAsync("app.job.ingested", payload, cancellationToken);

        return Result<IngestJobResponse>.Success(new IngestJobResponse(
            application.Id,
            application.Status,
            "app.job.ingested",
            "Job successfully ingested into NATS JetStream queue. RAG pipeline triggered."
        ));
    }
}

// --- Get Application Audits Query ---

public record GetApplicationAuditsQuery(Guid UserId, string? Status = null) : IRequest<Result<List<ApplicationAuditDto>>>;

public class GetApplicationAuditsQueryHandler : IRequestHandler<GetApplicationAuditsQuery, Result<List<ApplicationAuditDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetApplicationAuditsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<ApplicationAuditDto>>> Handle(GetApplicationAuditsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.ApplicationAudits
            .AsNoTracking()
            .Where(a => a.UserId == request.UserId);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            query = query.Where(a => a.Status.ToLower() == request.Status.ToLower());
        }

        var list = await query
            .OrderByDescending(a => a.CreatedAtUtc)
            .Select(a => new ApplicationAuditDto(
                a.Id,
                a.JobTitle,
                a.CompanyName,
                a.JobUrl,
                a.Status,
                a.ResumeS3Url,
                a.ErrorMessage,
                a.HitlQuestion,
                a.HitlAnswer,
                a.AppliedAtUtc,
                a.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return Result<List<ApplicationAuditDto>>.Success(list);
    }
}

// --- Career Achievements Commands & Queries ---

public record AddCareerAchievementCommand(Guid UserId, string Content) : IRequest<Result<CareerAchievementDto>>;

public class AddCareerAchievementCommandHandler : IRequestHandler<AddCareerAchievementCommand, Result<CareerAchievementDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IEmbeddingService _embeddingService;

    public AddCareerAchievementCommandHandler(IApplicationDbContext context, IEmbeddingService embeddingService)
    {
        _context = context;
        _embeddingService = embeddingService;
    }

    public async Task<Result<CareerAchievementDto>> Handle(AddCareerAchievementCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
            return Result<CareerAchievementDto>.Failure("Achievement content cannot be empty.");

        var embedding = await _embeddingService.GenerateEmbeddingAsync(request.Content, null, cancellationToken);

        var achievement = new CareerAchievement
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            Content = request.Content
        };
        achievement.SetEmbedding(embedding);

        _context.CareerAchievements.Add(achievement);
        await _context.SaveChangesAsync(cancellationToken);

        return Result<CareerAchievementDto>.Success(new CareerAchievementDto(
            achievement.Id,
            achievement.Content,
            embedding.Length,
            achievement.CreatedAtUtc
        ));
    }
}

public record GetCareerAchievementsQuery(Guid UserId) : IRequest<Result<List<CareerAchievementDto>>>;

public class GetCareerAchievementsQueryHandler : IRequestHandler<GetCareerAchievementsQuery, Result<List<CareerAchievementDto>>>
{
    private readonly IApplicationDbContext _context;

    public GetCareerAchievementsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<List<CareerAchievementDto>>> Handle(GetCareerAchievementsQuery request, CancellationToken cancellationToken)
    {
        var list = await _context.CareerAchievements
            .AsNoTracking()
            .Where(c => c.UserId == request.UserId)
            .OrderByDescending(c => c.CreatedAtUtc)
            .Select(c => new CareerAchievementDto(
                c.Id,
                c.Content,
                c.GetEmbedding().Length,
                c.CreatedAtUtc
            ))
            .ToListAsync(cancellationToken);

        return Result<List<CareerAchievementDto>>.Success(list);
    }
}

// --- Resolve HitL Command ---

public record ResolveHitlCommand(Guid UserId, Guid ApplicationId, string Answer) : IRequest<Result<bool>>;

public class ResolveHitlCommandHandler : IRequestHandler<ResolveHitlCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly INatsEventBus _eventBus;

    public ResolveHitlCommandHandler(IApplicationDbContext context, INatsEventBus eventBus)
    {
        _context = context;
        _eventBus = eventBus;
    }

    public async Task<Result<bool>> Handle(ResolveHitlCommand request, CancellationToken cancellationToken)
    {
        var application = await _context.ApplicationAudits
            .FirstOrDefaultAsync(a => a.Id == request.ApplicationId && a.UserId == request.UserId, cancellationToken);

        if (application == null)
            return Result<bool>.Failure("Application not found.");

        application.HitlAnswer = request.Answer;
        application.Status = "applying";
        await _context.SaveChangesAsync(cancellationToken);

        // Publish 'app.worker.hitl_resolved' to resume worker
        var payload = new
        {
            application_id = request.ApplicationId.ToString(),
            user_id = request.UserId.ToString(),
            answer = request.Answer
        };
        await _eventBus.PublishAsync("app.worker.hitl_resolved", payload, cancellationToken);

        return Result<bool>.Success(true);
    }
}

// --- Get User Credits Query ---

public record GetUserCreditsQuery(Guid UserId) : IRequest<Result<UserCreditsDto>>;

public class GetUserCreditsQueryHandler : IRequestHandler<GetUserCreditsQuery, Result<UserCreditsDto>>
{
    private readonly IApplicationDbContext _context;

    public GetUserCreditsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<Result<UserCreditsDto>> Handle(GetUserCreditsQuery request, CancellationToken cancellationToken)
    {
        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

        if (user == null)
            return Result<UserCreditsDto>.Failure("User not found.");

        return Result<UserCreditsDto>.Success(new UserCreditsDto(user.CreditsBalance, user.Email));
    }
}
