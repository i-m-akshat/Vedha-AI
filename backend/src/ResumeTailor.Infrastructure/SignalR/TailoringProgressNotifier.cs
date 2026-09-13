using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.SignalR;

[Authorize]
public class TailoringProgressHub : Hub
{
    public async Task JoinUserGroup()
    {
        var userId = GetUserId();
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
    }

    public async Task LeaveUserGroup()
    {
        var userId = GetUserId();
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
    }

    private string GetUserId()
    {
        return Context.User?.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new HubException("Authenticated user identity is required.");
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
