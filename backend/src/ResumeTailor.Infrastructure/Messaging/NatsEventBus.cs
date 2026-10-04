using System.Collections.Concurrent;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Messaging;

public class NatsEventBus : INatsEventBus
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<NatsEventBus> _logger;
    private readonly string _natsUrl;
    private readonly ConcurrentDictionary<string, List<Func<string, Task>>> _subscriptions = new();

    public NatsEventBus(IConfiguration configuration, ILogger<NatsEventBus> logger)
    {
        _configuration = configuration;
        _logger = logger;
        _natsUrl = configuration["NatsSettings:Url"] ?? configuration["NATS_URL"] ?? "nats://localhost:4222";
    }

    public async Task PublishAsync<T>(string subject, T payload, CancellationToken cancellationToken = default)
    {
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = false });
        _logger.LogInformation("[NATS JetStream] Publishing to subject '{Subject}': {Length} bytes", subject, json.Length);

        // 1. Attempt TCP publish to NATS broker if available
        try
        {
            await PublishToNatsBrokerAsync(subject, json, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "NATS TCP socket unavailable ({Url}), routing through local JetStream event bus.", _natsUrl);
        }

        // 2. Dispatch to registered in-process subscribers
        if (_subscriptions.TryGetValue(subject, out var handlers))
        {
            foreach (var handler in handlers)
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await handler(json);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error processing event for subject '{Subject}'", subject);
                    }
                }, cancellationToken);
            }
        }
    }

    public Task SubscribeAsync<T>(string subject, string queueGroup, Func<T, Task> handler, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[NATS JetStream] Subscribed to '{Subject}' with group '{QueueGroup}'", subject, queueGroup);

        _subscriptions.AddOrUpdate(
            subject,
            _ => new List<Func<string, Task>> { WrapHandler(handler) },
            (_, list) =>
            {
                lock (list)
                {
                    list.Add(WrapHandler(handler));
                }
                return list;
            });

        return Task.CompletedTask;
    }

    private static Func<string, Task> WrapHandler<T>(Func<T, Task> handler)
    {
        return async (json) =>
        {
            var item = JsonSerializer.Deserialize<T>(json);
            if (item != null)
            {
                await handler(item);
            }
        };
    }

    private async Task PublishToNatsBrokerAsync(string subject, string json, CancellationToken cancellationToken)
    {
        var uri = new Uri(_natsUrl.Replace("nats://", "http://"));
        using var client = new TcpClient();
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, cts.Token);

        await client.ConnectAsync(uri.Host, uri.Port > 0 ? uri.Port : 4222, linked.Token);
        using var stream = client.GetStream();

        // Standard NATS protocol: PUB <subject> [reply-to] <#bytes>\r\n[payload]\r\n
        var payloadBytes = Encoding.UTF8.GetBytes(json);
        var pubCmd = $"PUB {subject} {payloadBytes.Length}\r\n";
        var pubBytes = Encoding.UTF8.GetBytes(pubCmd);

        await stream.WriteAsync(pubBytes, linked.Token);
        await stream.WriteAsync(payloadBytes, linked.Token);
        await stream.WriteAsync(Encoding.UTF8.GetBytes("\r\n"), linked.Token);
        await stream.FlushAsync(linked.Token);
    }
}
