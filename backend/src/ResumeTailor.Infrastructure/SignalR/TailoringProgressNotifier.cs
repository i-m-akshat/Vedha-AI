using Microsoft.AspNetCore.SignalR;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.SignalR;

public class TailoringProgressHub : Hub
{
    public async Task JoinUserGroup(string userId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
    }

    public async Task LeaveUserGroup(string userId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
    }
}

public class TailoringProgressNotifier : ITailoringProgressNotifier
{
    private readonly IHubContext<TailoringProgressHub> _hubContext;

    public TailoringProgressNotifier(IHubContext<TailoringProgressHub> hubContext)
    {
        _hubContext = hubContext;
    }

    public async Task SendProgressAsync(Guid userId, string stage, string message, int percentComplete, CancellationToken cancellationToken = default)
    {
        await _hubContext.Clients.Group($"user_{userId}").SendAsync("OnTailoringProgress", new
        {
            Stage = stage,
            Message = message,
            PercentComplete = percentComplete,
            Timestamp = DateTime.UtcNow
        }, cancellationToken);
    }
}
