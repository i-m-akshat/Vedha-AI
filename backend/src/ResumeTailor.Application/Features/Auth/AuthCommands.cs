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

public record AuthResponseDto(string Token, UserDto User);

public record UserDto(
    Guid Id,
    string Email,
    string FullName,
    string Role,
    AiProviderType PreferredAiProvider,
    string? PreferredModel,
    bool HasCustomOpenAiKey,
    bool HasCustomClaudeKey,
    bool HasCustomGeminiKey
);

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
    IRequestHandler<UpdateApiKeyCommand, Result<bool>>,
    IRequestHandler<GetCurrentUserQuery, Result<UserDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ICurrentUserService _currentUserService;

    public AuthCommandHandler(
        IApplicationDbContext context,
        IJwtTokenGenerator jwtTokenGenerator,
        IPasswordHasher passwordHasher,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _jwtTokenGenerator = jwtTokenGenerator;
        _passwordHasher = passwordHasher;
        _currentUserService = currentUserService;
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
            PreferredModel = "gemini-2.0-flash"
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(cancellationToken);

        var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role);
        var userDto = MapToUserDto(user);

        return Result<AuthResponseDto>.Success(new AuthResponseDto(token, userDto));
    }

    public async Task<Result<AuthResponseDto>> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower().Trim(), cancellationToken);
        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
            return Result<AuthResponseDto>.Failure("Invalid email or password.");

        var token = _jwtTokenGenerator.GenerateToken(user.Id, user.Email, user.Role);
        var userDto = MapToUserDto(user);

        return Result<AuthResponseDto>.Success(new AuthResponseDto(token, userDto));
    }

    public async Task<Result<bool>> Handle(UpdateApiKeyCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUserService.UserId ?? throw new UnauthorizedException();
        var user = await _context.Users.FindAsync(new object[] { userId }, cancellationToken) 
            ?? throw new NotFoundException(nameof(User), userId);

        user.PreferredAiProvider = request.PreferredProvider;
        if (!string.IsNullOrWhiteSpace(request.PreferredModel))
            user.PreferredModel = request.PreferredModel;

        if (request.OpenAiKey != null) user.CustomOpenAiKey = request.OpenAiKey;
        if (request.ClaudeKey != null) user.CustomClaudeKey = request.ClaudeKey;
        if (request.GeminiKey != null) user.CustomGeminiKey = request.GeminiKey;

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

    private static UserDto MapToUserDto(User user) => new(
        user.Id,
        user.Email,
        user.FullName,
        user.Role,
        user.PreferredAiProvider,
        user.PreferredModel,
        !string.IsNullOrEmpty(user.CustomOpenAiKey),
        !string.IsNullOrEmpty(user.CustomClaudeKey),
        !string.IsNullOrEmpty(user.CustomGeminiKey)
    );
}
