using System.Net;
using Microsoft.Extensions.Logging;
using ResumeTailor.Domain.Common;

namespace ResumeTailor.Infrastructure.Security;

/// <summary>
/// Centralized SSRF enforcement for every server-side fetch of a
/// candidate/agent-supplied URL (scraper, crawler sidecar dispatch, worker).
/// Literal checks first (fast reject, no network), then DNS resolution with
/// the SAME rules applied to every returned address — closing DNS-rebinding
/// (evil.com resolving to 10.x/169.254.x). Fail-closed: unresolvable hosts
/// are refused, never fetched.
/// </summary>
public static class UrlSafetyGuard
{
    public static async Task<(bool Allowed, string? Reason)> IsUrlAllowedAsync(
        string url,
        ILogger? logger = null,
        CancellationToken cancellationToken = default)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || !string.IsNullOrWhiteSpace(uri.UserInfo))
        {
            return (false, "Only absolute HTTP(S) URLs without embedded credentials may be fetched.");
        }

        if (UrlSafety.IsBlockedHost(uri.Host))
        {
            logger?.LogWarning("SSRF guard blocked fetch of disallowed host {Host}.", uri.Host);
            return (false, "URL host is not allowed (loopback/link-local/metadata).");
        }

        IPAddress[] addresses;
        try
        {
            addresses = await Dns.GetHostAddressesAsync(uri.Host, cancellationToken);
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "SSRF guard blocked fetch: DNS resolution failed for {Host}.", uri.Host);
            return (false, "URL host could not be resolved; refusing to fetch.");
        }

        if (addresses.Length == 0)
        {
            return (false, "URL host could not be resolved; refusing to fetch.");
        }

        foreach (var address in addresses)
        {
            if (UrlSafety.IsBlockedAddress(address))
            {
                logger?.LogWarning("SSRF guard blocked fetch: {Host} resolves to disallowed address {Address}.", uri.Host, address);
                return (false, "URL host resolves to a disallowed network address (DNS-rebinding guard).");
            }
        }

        return (true, null);
    }
}
