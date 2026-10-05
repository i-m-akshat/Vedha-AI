using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using QuestPDF.Infrastructure;
using ResumeTailor.Application;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure;
using ResumeTailor.Infrastructure.Persistence;
using ResumeTailor.Infrastructure.SignalR;
using ResumeTailor.WebApi.Middleware;
using Serilog;

// Global QuestPDF License Configuration
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .CreateLogger();

builder.Host.UseSerilog();

// Add Layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// Add Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Configure JWT Authentication
var rawJwtSecret = builder.Configuration["JwtSettings:Secret"];
var jwtSecret = !string.IsNullOrWhiteSpace(rawJwtSecret) && rawJwtSecret.Trim().Length >= 32
    ? rawJwtSecret.Trim()
    : "super_secret_jwt_key_at_least_32_characters_long_for_security_hs256";
var jwtIssuer = !string.IsNullOrWhiteSpace(builder.Configuration["JwtSettings:Issuer"]) ? builder.Configuration["JwtSettings:Issuer"]!.Trim() : "VedhaApi";
var jwtAudience = !string.IsNullOrWhiteSpace(builder.Configuration["JwtSettings:Audience"]) ? builder.Configuration["JwtSettings:Audience"]!.Trim() : "VedhaClient";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    // Support token query param for SignalR WebSockets
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Vedha AI Platform API",
        Version = "v1",
        Description = "Production-ready AI Resume Tailoring, Parsing, ATS Optimization & Multi-Pipeline Application Orchestrator"
    });

    c.CustomSchemaIds(type => type.FullName?.Replace("+", "."));
    c.ResolveConflictingActions(apiDescriptions => apiDescriptions.First());

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Seed Database
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        if (dbContext.Database.IsRelational())
        {
            dbContext.Database.EnsureCreated();
            if (dbContext.Database.ProviderName?.Contains("Npgsql", StringComparison.OrdinalIgnoreCase) == true)
            {
                try
                {
                    dbContext.Database.ExecuteSqlRaw(@"
                        CREATE TABLE IF NOT EXISTS ""CareerAchievements"" (
                            ""Id"" uuid NOT NULL CONSTRAINT ""PK_CareerAchievements"" PRIMARY KEY,
                            ""UserId"" uuid NOT NULL,
                            ""Content"" text NOT NULL,
                            ""EmbeddingJson"" text NOT NULL DEFAULT '[]',
                            ""CreatedAt"" timestamp with time zone NOT NULL,
                            ""LastModifiedAt"" timestamp with time zone NULL,
                            CONSTRAINT ""FK_CareerAchievements_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_CareerAchievements_UserId"" ON ""CareerAchievements"" (""UserId"");

                        CREATE TABLE IF NOT EXISTS ""ApplicationAudits"" (
                            ""Id"" uuid NOT NULL CONSTRAINT ""PK_ApplicationAudits"" PRIMARY KEY,
                            ""UserId"" uuid NOT NULL,
                            ""JobTitle"" text NOT NULL,
                            ""CompanyName"" text NOT NULL,
                            ""JobUrl"" text NOT NULL,
                            ""Status"" text NOT NULL,
                            ""ResumeS3Url"" text NULL,
                            ""ErrorMessage"" text NULL,
                            ""HitlQuestion"" text NULL,
                            ""HitlAnswer"" text NULL,
                            ""AppliedAtUtc"" timestamp with time zone NULL,
                            ""CreatedAt"" timestamp with time zone NOT NULL,
                            ""LastModifiedAt"" timestamp with time zone NULL,
                            CONSTRAINT ""FK_ApplicationAudits_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_ApplicationAudits_UserId_Status"" ON ""ApplicationAudits"" (""UserId"", ""Status"");

                        CREATE TABLE IF NOT EXISTS ""IdempotentTransactions"" (
                            ""IdempotencyKey"" text NOT NULL CONSTRAINT ""PK_IdempotentTransactions"" PRIMARY KEY,
                            ""UserId"" uuid NOT NULL,
                            ""ApplicationId"" uuid NOT NULL,
                            ""CreditsDeducted"" integer NOT NULL DEFAULT 1,
                            ""ProcessedAtUtc"" timestamp with time zone NOT NULL,
                            CONSTRAINT ""FK_IdempotentTransactions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_IdempotentTransactions_ApplicationId"" ON ""IdempotentTransactions"" (""ApplicationId"");

                        ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""CreditsBalance"" integer NOT NULL DEFAULT 50;
                        ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""MasterContextJson"" text NULL;
                        ALTER TABLE ""CandidateProfiles"" ADD COLUMN IF NOT EXISTS ""SalaryCurrency"" text NOT NULL DEFAULT 'INR';
                    ");
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Schema migration check for PostgreSQL encountered an issue: {Message}", ex.Message);
                }
            }
            else if (dbContext.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true)
            {
                try
                {
                    dbContext.Database.ExecuteSqlRaw(@"
                        CREATE TABLE IF NOT EXISTS ""CareerAchievements"" (
                            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_CareerAchievements"" PRIMARY KEY,
                            ""UserId"" TEXT NOT NULL,
                            ""Content"" TEXT NOT NULL,
                            ""EmbeddingJson"" TEXT NOT NULL DEFAULT '[]',
                            ""CreatedAt"" TEXT NOT NULL,
                            ""LastModifiedAt"" TEXT NULL,
                            CONSTRAINT ""FK_CareerAchievements_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_CareerAchievements_UserId"" ON ""CareerAchievements"" (""UserId"");

                        CREATE TABLE IF NOT EXISTS ""ApplicationAudits"" (
                            ""Id"" TEXT NOT NULL CONSTRAINT ""PK_ApplicationAudits"" PRIMARY KEY,
                            ""UserId"" TEXT NOT NULL,
                            ""JobTitle"" TEXT NOT NULL,
                            ""CompanyName"" TEXT NOT NULL,
                            ""JobUrl"" TEXT NOT NULL,
                            ""Status"" TEXT NOT NULL,
                            ""ResumeS3Url"" TEXT NULL,
                            ""ErrorMessage"" TEXT NULL,
                            ""HitlQuestion"" TEXT NULL,
                            ""HitlAnswer"" TEXT NULL,
                            ""AppliedAtUtc"" TEXT NULL,
                            ""CreatedAt"" TEXT NOT NULL,
                            ""LastModifiedAt"" TEXT NULL,
                            CONSTRAINT ""FK_ApplicationAudits_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_ApplicationAudits_UserId_Status"" ON ""ApplicationAudits"" (""UserId"", ""Status"");

                        CREATE TABLE IF NOT EXISTS ""IdempotentTransactions"" (
                            ""IdempotencyKey"" TEXT NOT NULL CONSTRAINT ""PK_IdempotentTransactions"" PRIMARY KEY,
                            ""UserId"" TEXT NOT NULL,
                            ""ApplicationId"" TEXT NOT NULL,
                            ""CreditsDeducted"" INTEGER NOT NULL DEFAULT 1,
                            ""ProcessedAtUtc"" TEXT NOT NULL,
                            CONSTRAINT ""FK_IdempotentTransactions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE
                        );
                        CREATE INDEX IF NOT EXISTS ""IX_IdempotentTransactions_ApplicationId"" ON ""IdempotentTransactions"" (""ApplicationId"");
                    ");

                    var conn = dbContext.Database.GetDbConnection();
                    if (conn.State != System.Data.ConnectionState.Open) conn.Open();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "PRAGMA table_info(\"Users\");";
                        var userCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        using (var reader = cmd.ExecuteReader())
                        {
                            while (reader.Read()) userCols.Add(reader.GetString(1));
                        }
                        if (!userCols.Contains("CreditsBalance"))
                        {
                            using var addCol = conn.CreateCommand();
                            addCol.CommandText = "ALTER TABLE \"Users\" ADD COLUMN \"CreditsBalance\" INTEGER NOT NULL DEFAULT 50;";
                            addCol.ExecuteNonQuery();
                        }
                        if (!userCols.Contains("MasterContextJson"))
                        {
                            using var addCol = conn.CreateCommand();
                            addCol.CommandText = "ALTER TABLE \"Users\" ADD COLUMN \"MasterContextJson\" TEXT NULL;";
                            addCol.ExecuteNonQuery();
                        }
                    }

                    using (var cmdProf = conn.CreateCommand())
                    {
                        cmdProf.CommandText = "PRAGMA table_info(\"CandidateProfiles\");";
                        var profCols = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        using (var readerProf = cmdProf.ExecuteReader())
                        {
                            while (readerProf.Read()) profCols.Add(readerProf.GetString(1));
                        }
                        if (!profCols.Contains("SalaryCurrency"))
                        {
                            using var addCol = conn.CreateCommand();
                            addCol.CommandText = "ALTER TABLE \"CandidateProfiles\" ADD COLUMN \"SalaryCurrency\" TEXT NOT NULL DEFAULT 'INR';";
                            addCol.ExecuteNonQuery();
                        }
                    }
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Schema migration check for SQLite encountered an issue: {Message}", ex.Message);
                }
            }
        }

        // Seed demo user if empty
        if (!dbContext.Users.Any())
        {
            var demoUser = new User
            {
                Email = "demo@vedha.ai",
                FullName = "Alex Morgan",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
                Role = "User",
                PreferredAiProvider = AiProviderType.Gemini,
                PreferredModel = "gemini-flash-lite-latest"
            };
            dbContext.Users.Add(demoUser);

            // Seed default prompts
            dbContext.PromptTemplates.AddRange(new[]
            {
                new PromptTemplate
                {
                    TemplateKey = "ResumeParser",
                    Name = "Master Resume Parser",
                    Description = "Extracts text from raw resumes into structured JSON ResumeSchema.",
                    SystemPrompt = "You are an expert ATS Resume Parsing Engine. Extract raw resume text into structured JSON matching ResumeSchema.",
                    UserPromptTemplate = "Please parse the following resume text into JSON format:\n\n{rawText}",
                    IsDefault = true
                },
                new PromptTemplate
                {
                    TemplateKey = "ResumeTailor",
                    Name = "Truth-Preserving Resume Tailor",
                    Description = "Tailors resume to target job description with strict zero-hallucination rules.",
                    SystemPrompt = "You are an executive resume writer. Reorganize and rewrite bullet points to align with the target job without inventing fake experience.",
                    UserPromptTemplate = "Target Job:\n{jobDescription}\n\nMaster Resume:\n{masterResume}\n\nTailor the resume into ResumeSchema JSON:",
                    IsDefault = true
                },
                new PromptTemplate
                {
                    TemplateKey = "CoverLetter",
                    Name = "Targeted Cover Letter",
                    Description = "Generates compelling 1-page cover letter tailored to the target role.",
                    SystemPrompt = "You are an executive career advisor. Write an exceptional, concise cover letter under 400 words.",
                    UserPromptTemplate = "Company: {company}\nRole: {role}\nCandidate Experience: {experience}\nJob Requirements: {requirements}",
                    IsDefault = true
                }
            });

            dbContext.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "An error occurred while initializing the database.");
    }
}

// Middleware Pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment() || app.Environment.IsStaging() ||
    string.Equals(builder.Configuration["EnableSwagger"], "true", StringComparison.OrdinalIgnoreCase))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Vedha AI API v1"));
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<TailoringProgressHub>("/hubs/progress");

app.MapGet("/healthz", async ([Microsoft.AspNetCore.Mvc.FromServices] ApplicationDbContext db) =>
{
    var isDbHealthy = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        Status = isDbHealthy ? "Healthy" : "Degraded",
        Database = isDbHealthy ? "Connected" : "Unreachable",
        Timestamp = DateTime.UtcNow,
        Version = "1.0.0"
    });
}).ExcludeFromDescription();

app.MapGet("/health", async ([Microsoft.AspNetCore.Mvc.FromServices] ApplicationDbContext db) =>
{
    var isDbHealthy = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        Status = isDbHealthy ? "Healthy" : "Degraded",
        Database = isDbHealthy ? "Connected" : "Unreachable",
        Timestamp = DateTime.UtcNow,
        Version = "1.0.0"
    });
}).ExcludeFromDescription();

app.MapGet("/api/health", async ([Microsoft.AspNetCore.Mvc.FromServices] ApplicationDbContext db) =>
{
    var isDbHealthy = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        Status = isDbHealthy ? "Healthy" : "Degraded",
        Database = isDbHealthy ? "Connected" : "Unreachable",
        Timestamp = DateTime.UtcNow,
        Version = "1.0.0"
    });
}).ExcludeFromDescription();

app.MapGet("/", () => Results.Ok(new
{
    Name = "Vedha AI Platform API",
    Status = "Healthy",
    Version = "1.0.0",
    Timestamp = DateTime.UtcNow
})).ExcludeFromDescription();

app.Run();
