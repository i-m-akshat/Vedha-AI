using System.Text.Json;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Exceptions;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Application.Features.Auth;

public record RegisterCommand(string Email, string Password, string FullName) : IRequest<Result<AuthResponseDto>>;

public record LoginCommand(string Email, string Password) : IRequest<Result<AuthResponseDto>>;

public record UpdateApiKeyCommand(
    AiProviderType PreferredProvider,
    string? PreferredModel,
    string? OpenAiKey,
    string? ClaudeKey,
    string? GeminiKey
) : IRequest<Result<bool>>;

public record GetCurrentUserQuery : IRequest<Result<UserDto>>;

public record ExportUserDataQuery : IRequest<Result<UserDataExportDto>>;

public record DeleteUserAccountCommand : IRequest<Result<bool>>;

public record AuthResponseDto(string Token, string RefreshToken, UserDto User);

public record RefreshTokenCommand(string AccessToken, string RefreshToken) : IRequest<Result<AuthResponseDto>>;

public record RevokeTokenCommand(string RefreshToken) : IRequest<Result<bool>>;

public record UserDto(
    Guid Id,
    string Email,
    string FullName,
    string Role,
    AiProviderType PreferredAiProvider,
    string? PreferredModel,
    bool HasCustomOpenAiKey,
    bool HasCustomClaudeKey,
    bool HasCustomGeminiKey,
    string? OpenAiKeyMasked = null,
    string? ClaudeKeyMasked = null,
    string? GeminiKeyMasked = null
);

public class UserDataExportDto
{
    public UserDto User { get; set; } = null!;
    public List<MasterResume> MasterResumes { get; set; } = new();
    public List<GeneratedResume> GeneratedResumes { get; set; } = new();
    public List<JobDescription> JobDescriptions { get; set; } = new();
    public List<ApplicationRecord> Applications { get; set; } = new();
    public Domain.Entities.CandidateProfile? CandidateProfile { get; set; }
    public List<ScreeningQuestionMemory> ScreeningMemories { get; set; } = new();
    public DateTime ExportedAtUtc { get; set; } = DateTime.UtcNow;
}

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(100);
    }
}

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class AuthCommandHandler :
    IRequestHandler<RegisterCommand, Result<AuthResponseDto>>,
    IRequestHandler<LoginCommand, Result<AuthResponseDto>>,
    IRequestHandler<RefreshTokenCommand, Result<AuthResponseDto>>,
    IRequestHandler<RevokeTokenCommand, Result<bool>>,
    IRequestHandler<UpdateApiKeyCommand, Result<bool>>,
    IRequestHandler<GetCurrentUserQuery, Result<UserDto>>,
    IRequestHandler<ExportUserDataQuery, Result<UserDataExportDto>>,
    IRequestHandler<DeleteUserAccountCommand, Result<bool>>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUserService;
    private readonly IEncryptionService _encryptionService;

    public AuthCommandHandler(
        IApplicationDbContext context,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUserService,
        IEncryptionService encryptionService)
    {
        _context = context;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordHasher = passwordHasher;
        _currentUserService = currentUserService;
        _encryptionService = encryptionService;
    }

    public async Task<Result<AuthResponseDto>> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        var existingUser = await _context.Users.AnyAsync(u => u.Email.ToLower() == request.Email.ToLower(), cancellationToken);
        if (existingUser)
            return Result<AuthResponseDto>.Failure("An account with this email address already exists.");

        var passwordHash = _passwordHasher.HashPassword(request.Password);
        var user = new User
        {
            Email = request.Email.ToLower().Trim(),
            FullName = request.FullName.Trim(),
            PasswordHash = passwordHash,
            Role = "User",
            PreferredAiProvider = AiProviderType.Gemini,
            PreferredModel = "gemini-flash-lite-latest"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken();

        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(30),
            CreatedAtUtc = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        var userDto = MapToUserDto(user);
        return Result<AuthResponseDto>.Success(new AuthResponseDto(token, refreshToken, userDto));
    }

    public async Task<Result<AuthResponseDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower().Trim(), cancellationToken);
        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
            return Result<AuthResponseDto>.Failure("Invalid email or password.");

        var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role);
        var refreshToken = _jwtTokenGenerator.GenerateRefreshToken();

        var refreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(30),
            CreatedAtUtc = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(refreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        var userDto = MapToUserDto(user);
        return Result<AuthResponseDto>.Success(new AuthResponseDto(token, refreshToken, userDto));
    }

    public async Task<Result<AuthResponseDto>> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.AccessToken) || string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result<AuthResponseDto>.Failure("Access token and refresh token are required.");

        var principal = _jwtTokenGenerator.GetPrincipalFromExpiredToken(request.AccessToken);
        if (principal == null)
            return Result<AuthResponseDto>.Failure("Invalid access token.");

        var claim = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                 ?? principal.FindFirst("sub")?.Value;

        if (!Guid.TryParse(claim, out var userId))
            return Result<AuthResponseDto>.Failure("Invalid access token identity.");

        var storedToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken && r.UserId == userId, cancellationToken);

        if (storedToken == null || !storedToken.IsActive)
            return Result<AuthResponseDto>.Failure("Invalid, expired, or revoked refresh token.");

        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken);
        if (user == null)
            return Result<AuthResponseDto>.Failure("User not found.");

        // Rotate Refresh Token
        var newRefreshToken = _jwtTokenGenerator.GenerateRefreshToken();
        storedToken.RevokedAtUtc = DateTime.UtcNow;
        storedToken.ReplacedByToken = newRefreshToken;

        var newRefreshTokenEntity = new RefreshToken
        {
            UserId = user.Id,
            Token = newRefreshToken,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(30),
            CreatedAtUtc = DateTime.UtcNow
        };
        _context.RefreshTokens.Add(newRefreshTokenEntity);
        await _context.SaveChangesAsync(cancellationToken);

        var newAccessToken = _jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role);
        return Result<AuthResponseDto>.Success(new AuthResponseDto(newAccessToken, newRefreshToken, MapToUserDto(user)));
    }

    public async Task<Result<bool>> Handle(RevokeTokenCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return Result<bool>.Failure("Refresh token is required.");

        var storedToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken, cancellationToken);

        if (storedToken != null && storedToken.IsActive)
        {
            storedToken.RevokedAtUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
        }

        return Result<bool>.Success(true);
    }

    public async Task<Result<bool>> Handle(UpdateApiKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        user.PreferredAiProvider = request.PreferredProvider;
        if (!string.IsNullOrWhiteSpace(request.PreferredModel))
            user.PreferredModel = request.PreferredModel;

        if (request.OpenAiKey != null)
            user.CustomOpenAiKey = !string.IsNullOrWhiteSpace(request.OpenAiKey) ? _encryptionService.Encrypt(request.OpenAiKey) : null;

        if (request.ClaudeKey != null)
            user.CustomClaudeKey = !string.IsNullOrWhiteSpace(request.ClaudeKey) ? _encryptionService.Encrypt(request.ClaudeKey) : null;

        if (request.GeminiKey != null)
            user.CustomGeminiKey = !string.IsNullOrWhiteSpace(request.GeminiKey) ? _encryptionService.Encrypt(request.GeminiKey) : null;

        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true);
    }

    public async Task<Result<UserDto>> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        return Result<UserDto>.Success(MapToUserDto(user));
    }

    public async Task<Result<UserDataExportDto>> Handle(ExportUserDataQuery request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        var masterResumes = await _context.MasterResumes
            .Include(m => m.Versions)
            .Where(m => m.UserId == userId)
            .ToListAsync(cancellationToken);

        var generatedResumes = await _context.GeneratedResumes
            .Include(g => g.AtsAnalysis)
            .Where(g => g.UserId == userId)
            .ToListAsync(cancellationToken);

        var jobDescriptions = await _context.JobDescriptions
            .Where(j => j.UserId == userId)
            .ToListAsync(cancellationToken);

        var applications = await _context.Applications
            .Where(a => a.UserId == userId)
            .ToListAsync(cancellationToken);

        var candidateProfile = await _context.CandidateProfiles
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

        var screeningMemories = await _context.ScreeningQuestionMemories
            .Where(s => s.UserId == userId)
            .ToListAsync(cancellationToken);

        var export = new UserDataExportDto
        {
            User = MapToUserDto(user),
            MasterResumes = masterResumes,
            GeneratedResumes = generatedResumes,
            JobDescriptions = jobDescriptions,
            Applications = applications,
            CandidateProfile = candidateProfile,
            ScreeningMemories = screeningMemories,
            ExportedAtUtc = DateTime.UtcNow
        };

        return Result<UserDataExportDto>.Success(export);
    }

    public async Task<Result<bool>> Handle(DeleteUserAccountCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        // 1. Cascade Delete Master Resumes & Versions
        var masterResumes = await _context.MasterResumes.Include(m => m.Versions).Where(m => m.UserId == userId).ToListAsync(cancellationToken);
        _context.MasterResumes.RemoveRange(masterResumes);

        // 2. Cascade Delete Generated Resumes & Analyses
        var generatedResumes = await _context.GeneratedResumes.Include(g => g.AtsAnalysis).Where(g => g.UserId == userId).ToListAsync(cancellationToken);
        _context.GeneratedResumes.RemoveRange(generatedResumes);

        // 3. Cascade Delete Jobs
        var jobs = await _context.JobDescriptions.Where(j => j.UserId == userId).ToListAsync(cancellationToken);
        _context.JobDescriptions.RemoveRange(jobs);

        // 4. Cascade Delete Applications & Queue Items
        var apps = await _context.Applications.Where(a => a.UserId == userId).ToListAsync(cancellationToken);
        _context.Applications.RemoveRange(apps);

        var queueItems = await _context.ApplicationQueueItems.Where(q => q.UserId == userId).ToListAsync(cancellationToken);
        _context.ApplicationQueueItems.RemoveRange(queueItems);

        // 5. Cascade Delete Profile & Memories
        var profile = await _context.CandidateProfiles.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
        if (profile != null) _context.CandidateProfiles.Remove(profile);

        var memories = await _context.ScreeningQuestionMemories.Where(s => s.UserId == userId).ToListAsync(cancellationToken);
        _context.ScreeningQuestionMemories.RemoveRange(memories);

        // 6. Delete User Record
        _context.Users.Remove(user);

        await _context.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true);
    }

    private UserDto MapToUserDto(User user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Role,
        user.PreferredAiProvider,
        user.PreferredModel,
        !string.IsNullOrEmpty(user.CustomOpenAiKey),
        !string.IsNullOrEmpty(user.CustomClaudeKey),
        !string.IsNullOrEmpty(user.CustomGeminiKey),
        _encryptionService.Mask(user.CustomOpenAiKey),
        _encryptionService.Mask(user.CustomClaudeKey),
        _encryptionService.Mask(user.CustomGeminiKey)
    );
}
