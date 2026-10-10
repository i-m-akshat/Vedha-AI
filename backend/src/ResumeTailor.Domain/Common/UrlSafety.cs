using System.Net;

namespace ResumeTailor.Domain.Common;

/// <summary>
/// Pure SSRF helpers: literal host/IP rules with no network I/O, so any
/// layer (including Application) can fast-reject obvious targets.
/// Design decision (recorded): RFC-1918 private ranges stay ALLOWED —
/// intranet career portals are legitimate targets. Loopback, link-local,
/// and cloud-metadata endpoints are never fetchable. DNS-rebinding defense
/// lives in Infrastructure.Security.UrlSafetyGuard (resolve + re-check).
/// </summary>
public static class UrlSafety
{
    public static bool IsBlockedHost(string? host)
    {
        var h = (host ?? string.Empty).Trim().TrimEnd('.').ToLowerInvariant();
        if (h.Length == 0
            || h == "localhost"
            || h == "metadata.google.internal"
            || h == "metadata.goog"
            || h == "instance-data"
            || h == "instance-data-compute"
            || h == "169.254.169.254"
            || h == "100.100.100.200"
            || h == "fd00:ec2::254"
            || h == "[::1]"
            || h == "::1")
        {
            return true;
        }

        var stripped = h.Trim('[', ']');
        if (IPAddress.TryParse(stripped, out var ip))
        {
            return IsBlockedAddress(ip);
        }

        return false;
    }

    public static bool IsBlockedAddress(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip) || ip.ToString() == "0.0.0.0")
        {
            return true;
        }

        var bytes = ip.GetAddressBytes();
        if (bytes.Length == 4 && bytes[0] == 169 && bytes[1] == 254)
        {
            return true; // link-local (covers 169.254.169.254/32 and peers)
        }

        if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal)
        {
            return true;
        }

        return false;
    }
}
