using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ResumeTailor.Application;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Infrastructure;
using ResumeTailor.Infrastructure.Persistence;
using ResumeTailor.Infrastructure.SignalR;
using ResumeTailor.WebApi.Middleware;
using Serilog;

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
                    ALTER TABLE ""CandidateProfiles"" 
                    ADD COLUMN IF NOT EXISTS ""SalaryCurrency"" text NOT NULL DEFAULT 'INR';
                ");
                }
                catch (Exception ex)
                {
                    Log.Warning(ex, "Schema migration check for CandidateProfiles encountered an issue: {Message}", ex.Message);
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
                PreferredModel = "gemini-3.8-flash"
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

app.MapGet("/", () => Results.Ok(new
{
    Name = "Vedha AI Platform API",
    Status = "Healthy",
    Version = "1.0.0",
    Timestamp = DateTime.UtcNow
})).ExcludeFromDescription();

app.Run();
