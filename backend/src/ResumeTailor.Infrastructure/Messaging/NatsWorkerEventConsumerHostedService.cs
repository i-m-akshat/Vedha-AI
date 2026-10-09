using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Messaging;

public class NatsWorkerEventConsumerHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<NatsWorkerEventConsumerHostedService> _logger;

    public NatsWorkerEventConsumerHostedService(
        IServiceProvider serviceProvider,
        ILogger<NatsWorkerEventConsumerHostedService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Starting NatsWorkerEventConsumerHostedService background listener...");

        using var scope = _serviceProvider.CreateScope();
        var eventBus = scope.ServiceProvider.GetRequiredService<INatsEventBus>();

        // 1. Consume 'app.job.ingested' -> Triggers Context RAG pipeline
        await eventBus.SubscribeAsync<JsonElement>("app.job.ingested", "core_rag_generator_group", async (payload) =>
        {
            try
            {
                var appIdStr = payload.TryGetProperty("application_id", out var a) ? a.GetString() : null;
                var userIdStr = payload.TryGetProperty("user_id", out var u) ? u.GetString() : null;
                var title = payload.TryGetProperty("job_title", out var t) ? t.GetString() ?? "" : "";
                var company = payload.TryGetProperty("company_name", out var c) ? c.GetString() ?? "" : "";
                var desc = payload.TryGetProperty("job_description", out var d) ? d.GetString() ?? "" : "";

                if (Guid.TryParse(appIdStr, out var appId) && Guid.TryParse(userIdStr, out var userId))
                {
                    _logger.LogInformation("Processing 'app.job.ingested' for application {ApplicationId}", appId);
                    using var innerScope = _serviceProvider.CreateScope();
                    var generator = innerScope.ServiceProvider.GetRequiredService<IRagResumeGenerator>();
                    await generator.GenerateTailoredResumeAsync(userId, appId, title, company, desc, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing 'app.job.ingested'");
            }
        }, stoppingToken);

        // 2. Consume 'app.worker.success' -> Triggers atomic credit deduction
        await eventBus.SubscribeAsync<JsonElement>("app.worker.success", "core_billing_group", async (payload) =>
        {
            try
            {
                var appIdStr = payload.TryGetProperty("application_id", out var a) ? a.GetString() : null;
                var userIdStr = payload.TryGetProperty("user_id", out var u) ? u.GetString() : null;

                if (Guid.TryParse(appIdStr, out var appId) && Guid.TryParse(userIdStr, out var userId))
                {
                    var idempotencyKey = $"success_{appId}";
                    _logger.LogInformation("Processing 'app.worker.success' with idempotency key {Key}", idempotencyKey);
                    using var innerScope = _serviceProvider.CreateScope();
                    var creditService = innerScope.ServiceProvider.GetRequiredService<ICreditTransactionService>();
                    await creditService.DeductCreditOnWorkerSuccessAsync(userId, appId, idempotencyKey, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing 'app.worker.success'");
            }
        }, stoppingToken);

        // 3. Consume 'app.worker.hitl_required' -> Sets application status to 'hitl_required' & alerts UI
        await eventBus.SubscribeAsync<JsonElement>("app.worker.hitl_required", "core_hitl_group", async (payload) =>
        {
            try
            {
                var appIdStr = payload.TryGetProperty("application_id", out var a) ? a.GetString() : null;
                var userIdStr = payload.TryGetProperty("user_id", out var u) ? u.GetString() : null;
                var question = payload.TryGetProperty("question", out var q) ? q.GetString() ?? "" : "";

                if (Guid.TryParse(appIdStr, out var appId) && Guid.TryParse(userIdStr, out var userId))
                {
                    _logger.LogWarning("Subjective question encountered needing user resolution for application {ApplicationId}: {Question}", appId, question);
                    using var innerScope = _serviceProvider.CreateScope();
                    var context = innerScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                    var notifier = innerScope.ServiceProvider.GetRequiredService<ITailoringProgressNotifier>();

                    var app = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                        context.ApplicationAudits,
                        x => x.Id == appId,
                        stoppingToken);

                    if (app != null)
                    {
                        app.Status = "hitl_required";
                        app.HitlQuestion = question;
                        await context.SaveChangesAsync(stoppingToken);
                    }

                    await notifier.SendProgressAsync(
                        userId,
                        "HitLRequired",
                        $"Human-In-The-Loop Action Required: '{question}'",
                        50,
                        stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing 'app.worker.hitl_required'");
            }
        }, stoppingToken);

        // 4. Consume 'app.worker.failed' -> Sets application status to 'failed' & records error message
        await eventBus.SubscribeAsync<JsonElement>("app.worker.failed", "core_worker_failure_group", async (payload) =>
        {
            try
            {
                var appIdStr = payload.TryGetProperty("application_id", out var a) ? a.GetString() : null;
                var userIdStr = payload.TryGetProperty("user_id", out var u) ? u.GetString() : null;
                var error = payload.TryGetProperty("error", out var e) ? e.GetString() ?? "Unknown worker failure" : "Unknown worker failure";

                if (Guid.TryParse(appIdStr, out var appId) && Guid.TryParse(userIdStr, out var userId))
                {
                    _logger.LogError("Worker execution failed for application {ApplicationId}: {Error}", appId, error);
                    using var innerScope = _serviceProvider.CreateScope();
                    var context = innerScope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
                    var notifier = innerScope.ServiceProvider.GetRequiredService<ITailoringProgressNotifier>();

                    var app = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                        context.ApplicationAudits,
                        x => x.Id == appId,
                        stoppingToken);

                    if (app != null)
                    {
                        app.Status = "failed";
                        app.ErrorMessage = error;
                        app.AppliedAtUtc = DateTime.UtcNow;
                        await context.SaveChangesAsync(stoppingToken);
                    }

                    await notifier.SendProgressAsync(
                        userId,
                        "WorkerFailed",
                        $"Application submission failed: {error}",
                        100,
                        stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed processing 'app.worker.failed'");
            }
        }, stoppingToken);

        // Keep service alive until cancellation is requested
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Graceful shutdown
        }
    }
}
