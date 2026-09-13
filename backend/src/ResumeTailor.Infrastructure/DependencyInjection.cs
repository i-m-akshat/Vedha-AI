using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Infrastructure.Ai;
using ResumeTailor.Infrastructure.AtsEngine;
using ResumeTailor.Infrastructure.Export;
using ResumeTailor.Infrastructure.Identity;
using ResumeTailor.Infrastructure.Parsing;
using ResumeTailor.Infrastructure.Persistence;
using ResumeTailor.Infrastructure.SignalR;
using ResumeTailor.Infrastructure.WebScraping;
using ResumeTailor.Infrastructure.Orchestrator;

namespace ResumeTailor.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Database
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (!string.IsNullOrEmpty(connectionString) && (connectionString.Contains("Host=") || connectionString.Contains("Server=")))
        {
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseNpgsql(connectionString, b => b.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName)));
        }
        else
        {
            // SQLite local fallback for zero-config developer onboarding
            var sqliteConnection = configuration.GetConnectionString("SqliteConnection") ?? "Data Source=vedha.db";
            services.AddDbContext<ApplicationDbContext>(options =>
                options.UseSqlite(sqliteConnection));
        }

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        // 2. Identity & HTTP Context & Security
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, CurrentUserService>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IEncryptionService, ResumeTailor.Infrastructure.Security.AesGcmEncryptionService>();

        // 3. Document Parsers
        services.AddScoped<IDocumentParser, PdfDocumentParser>();
        services.AddScoped<IDocumentParser, DocxDocumentParser>();
        services.AddScoped<IDocumentParser, MarkdownDocumentParser>();

        // 4. Web Scraping & HttpClient
        services.AddHttpClient<IJobScraperService, JobScraperService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 10
        });

        // 5. AI Providers & Factory
        services.AddHttpClient<OpenAiProvider>();
        services.AddHttpClient<ClaudeProvider>();
        services.AddHttpClient<GeminiProvider>();

        services.AddScoped<IAiProvider, OpenAiProvider>();
        services.AddScoped<IAiProvider, ClaudeProvider>();
        services.AddScoped<IAiProvider, GeminiProvider>();
        services.AddScoped<IAiServiceFactory, AiServiceFactory>();

        // 6. ATS Scoring & Validation Engine
        services.AddScoped<IAtsScoringEngine, AtsScoringEngine>();

        // 7. Resume Export
        services.AddScoped<IResumeExportService, ResumeExportService>();

        // 8. SignalR & Real-Time Logging
        services.AddSignalR();
        services.AddScoped<ITailoringProgressNotifier, TailoringProgressNotifier>();

        // 9. Job Application Orchestrator & Providers
        services.AddScoped<IJobApplicationProvider, GreenhouseProvider>();
        services.AddScoped<IJobApplicationProvider, LeverProvider>();
        services.AddScoped<IJobApplicationProvider, AshbyProvider>();
        services.AddScoped<IJobApplicationProvider, LinkedInCopilotProvider>();
        services.AddScoped<IJobApplicationProvider, NaukriProvider>();
        services.AddScoped<IJobApplicationProvider, WorkdayProvider>();

        // GenericBrowserProvider needs a typed HttpClient for real DOM fetching
        services.AddHttpClient<GenericBrowserProvider>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
        {
            AllowAutoRedirect = true,
            MaxAutomaticRedirections = 5
        });
        // Register as both concrete (for HttpClient resolution) and as IJobApplicationProvider
        services.AddScoped<IJobApplicationProvider>(sp => sp.GetRequiredService<GenericBrowserProvider>());

        services.AddScoped<IJobApplicationOrchestrator, JobApplicationOrchestrator>();
        services.AddScoped<SemanticDomFormMapper>();

        return services;
    }
}
