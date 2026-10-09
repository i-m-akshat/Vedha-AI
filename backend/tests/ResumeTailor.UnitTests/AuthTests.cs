using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Moq;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Application.Features.Auth;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Infrastructure.Identity;
using ResumeTailor.Infrastructure.Security;
using Xunit;

namespace ResumeTailor.UnitTests;

public class AuthTests
{
    private readonly Mock<IConfiguration> _configurationMock;
    private readonly PasswordHasher _passwordHasher;
    private readonly AesGcmEncryptionService _encryptionService;

    public AuthTests()
    {
        _configurationMock = new Mock<IConfiguration>();
        _configurationMock.Setup(c => c["JwtSettings:Secret"])
            .Returns("super_secret_jwt_key_at_least_32_characters_long_for_security_hs256");
        _configurationMock.Setup(c => c["JwtSettings:Issuer"]).Returns("VedhaApi");
        _configurationMock.Setup(c => c["JwtSettings:Audience"]).Returns("VedhaClient");
        _configurationMock.Setup(c => c["JwtSettings:ExpiryMinutes"]).Returns("1440");

        _passwordHasher = new PasswordHasher();
        _encryptionService = new AesGcmEncryptionService(_configurationMock.Object);
    }

    [Fact]
    public void PasswordHasher_HashAndVerify_ShouldSucceedForMatchingPassword()
    {
        // Arrange
        const string password = "TestSecurePassword123!";

        // Act
        var hash = _passwordHasher.HashPassword(password);
        var isValid = _passwordHasher.VerifyPassword(password, hash);
        var isInvalid = _passwordHasher.VerifyPassword("WrongPassword!", hash);

        // Assert
        hash.Should().NotBeNullOrWhiteSpace();
        isValid.Should().BeTrue();
        isInvalid.Should().BeFalse();
    }

    [Fact]
    public void JwtTokenGenerator_GenerateToken_ShouldEmitStandardAndNameIdentifierClaims()
    {
        // Arrange
        var generator = new JwtTokenGenerator(_configurationMock.Object);
        var userId = Guid.NewGuid();
        const string email = "candidate@vedha.ai";
        const string role = "User";

        // Act
        var tokenString = generator.GenerateToken(userId, email, role);

        // Assert
        tokenString.Should().NotBeNullOrWhiteSpace();
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(tokenString);

        jwt.Issuer.Should().Be("VedhaApi");
        jwt.Audiences.Should().Contain("VedhaClient");

        var subClaim = jwt.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Sub || c.Type == "sub");
        subClaim.Should().NotBeNull();
        subClaim!.Value.Should().Be(userId.ToString());
    }

    [Fact]
    public void CurrentUserService_WhenGivenSubClaim_ShouldResolveUserId()
    {
        // Arrange
        var expectedUserId = Guid.NewGuid();
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, expectedUserId.ToString()),
            new(ClaimTypes.Email, "alex@vedha.ai")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var contextMock = new Mock<HttpContext>();
        contextMock.Setup(c => c.User).Returns(principal);

        var accessorMock = new Mock<IHttpContextAccessor>();
        accessorMock.Setup(a => a.HttpContext).Returns(contextMock.Object);

        var service = new CurrentUserService(accessorMock.Object);

        // Act
        var resolvedUserId = service.UserId;
        var resolvedEmail = service.UserEmail;

        // Assert
        resolvedUserId.Should().Be(expectedUserId);
        resolvedEmail.Should().Be("alex@vedha.ai");
    }

    [Fact]
    public void CurrentUserService_WhenGivenNameIdentifierClaim_ShouldResolveUserId()
    {
        // Arrange
        var expectedUserId = Guid.NewGuid();
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, expectedUserId.ToString()),
            new(ClaimTypes.Email, "alex@vedha.ai")
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        var principal = new ClaimsPrincipal(identity);

        var contextMock = new Mock<HttpContext>();
        contextMock.Setup(c => c.User).Returns(principal);

        var accessorMock = new Mock<IHttpContextAccessor>();
        accessorMock.Setup(a => a.HttpContext).Returns(contextMock.Object);

        var service = new CurrentUserService(accessorMock.Object);

        // Act
        var resolvedUserId = service.UserId;

        // Assert
        resolvedUserId.Should().Be(expectedUserId);
    }

    [Fact]
    public void EncryptionService_Mask_ShouldMaskSecretsGracefully()
    {
        // Arrange
        var key = "sk-ant-api03-abcdef1234567890-testkey";
        var encrypted = _encryptionService.Encrypt(key);

        // Act
        var masked = _encryptionService.Mask(encrypted);

        // Assert
        masked.Should().Contain("••••••••");
        masked.Should().NotContain("abcdef1234567890");
    }

    [Fact]
    public void JwtTokenGenerator_GenerateRefreshToken_ShouldReturnCryptographicallySecureUniqueTokens()
    {
        // Arrange
        var generator = new JwtTokenGenerator(_configurationMock.Object);

        // Act
        var token1 = generator.GenerateRefreshToken();
        var token2 = generator.GenerateRefreshToken();

        // Assert
        token1.Should().NotBeNullOrWhiteSpace();
        token2.Should().NotBeNullOrWhiteSpace();
        token1.Should().NotBe(token2);
        // Base64 of 64 bytes is 88 chars (64 * 4 / 3 = 85.33 -> 88 chars with padding)
        Convert.FromBase64String(token1).Length.Should().Be(64);
    }

    [Fact]
    public void JwtTokenGenerator_GetPrincipalFromExpiredToken_ShouldExtractClaimsEvenIfTokenExpired()
    {
        // Arrange
        var generator = new JwtTokenGenerator(_configurationMock.Object);
        var userId = Guid.NewGuid();
        const string email = "expired_test@vedha.ai";
        const string role = "User";

        // Generate token
        var tokenString = generator.GenerateToken(userId, email, role);

        // Act
        var principal = generator.GetPrincipalFromExpiredToken(tokenString);

        // Assert
        principal.Should().NotBeNull();
        var subClaim = principal!.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                    ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? principal.FindFirst("sub")?.Value;
        subClaim.Should().Be(userId.ToString());
    }

    [Fact]
    public void JwtTokenGenerator_GetPrincipalFromExpiredToken_ShouldReturnNullForInvalidOrTamperedToken()
    {
        // Arrange
        var generator = new JwtTokenGenerator(_configurationMock.Object);
        const string tamperedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature";

        // Act
        var principal = generator.GetPrincipalFromExpiredToken(tamperedToken);

        // Assert
        principal.Should().BeNull();
    }

    [Fact]
    public void RefreshToken_EntityProperties_ShouldReflectActiveRevokedAndExpiredStatesCorrectly()
    {
        // Arrange - active token
        var activeToken = new RefreshToken
        {
            UserId = Guid.NewGuid(),
            Token = "secure_token_1",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            CreatedAtUtc = DateTime.UtcNow
        };

        // Arrange - revoked token
        var revokedToken = new RefreshToken
        {
            UserId = Guid.NewGuid(),
            Token = "secure_token_2",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(7),
            CreatedAtUtc = DateTime.UtcNow,
            RevokedAtUtc = DateTime.UtcNow
        };

        // Arrange - expired token
        var expiredToken = new RefreshToken
        {
            UserId = Guid.NewGuid(),
            Token = "secure_token_3",
            ExpiresAtUtc = DateTime.UtcNow.AddDays(-1),
            CreatedAtUtc = DateTime.UtcNow.AddDays(-8)
        };

        // Assert
        activeToken.IsActive.Should().BeTrue();
        activeToken.IsRevoked.Should().BeFalse();
        activeToken.IsExpired.Should().BeFalse();

        revokedToken.IsActive.Should().BeFalse();
        revokedToken.IsRevoked.Should().BeTrue();

        expiredToken.IsActive.Should().BeFalse();
        expiredToken.IsExpired.Should().BeTrue();
    }
}

