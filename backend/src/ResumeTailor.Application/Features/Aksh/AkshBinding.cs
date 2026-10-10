using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Application.Features.Aksh;

/// <summary>
/// Approval content binding (M2): a launch_apply approval is bound to the
/// EXACT package the candidate reviewed — not just its queue-item id. If the
/// package mutates between request and decide (re-tailor, edited answers
/// applied elsewhere, different resume), the approval supersedes instead of
/// submitting package B under package A's authorization.
/// Bound fields are semantic only (ids, resume, answers hash, company/role):
/// volatile fields (logs, status, timestamps) are deliberately excluded so
/// honest bookkeeping never false-supersedes.
/// </summary>
public static class AkshBinding
{
    public static string BuildArguments(ApplicationQueueItem queueItem, bool headed)
    {
        return JsonSerializer.Serialize(new
        {
            queueItemId = queueItem.Id,
            headed,
            generatedResumeId = queueItem.GeneratedResumeId,
            answersHash = ComputeAnswersHash(queueItem.PrefilledAnswersJson),
            targetCompany = queueItem.TargetCompany ?? string.Empty,
            targetRole = queueItem.TargetRole ?? string.Empty,
        });
    }

    /// <summary>
    /// Returns null when the stored arguments still describe the current row,
    /// else a human-readable mismatch reason. Legacy shapes (missing binding
    /// fields) never match: they predate binding and cannot prove sameness.
    /// </summary>
    public static string? VerifyArguments(string argumentsJson, ApplicationQueueItem queueItem)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
        }
        catch
        {
            return "approval arguments are malformed";
        }

        using (doc)
        {
            var root = doc.RootElement;

            if (!root.TryGetProperty("queueItemId", out var idEl)
                || !idEl.TryGetGuid(out var boundId)
                || boundId != queueItem.Id)
            {
                return "approval is bound to a different queue item";
            }

            if (!root.TryGetProperty("headed", out var headedEl)
                || (headedEl.ValueKind != JsonValueKind.True && headedEl.ValueKind != JsonValueKind.False))
            {
                return "approval predates content binding (no headed flag)";
            }

            if (!root.TryGetProperty("generatedResumeId", out var resumeEl)
                || GetNullableGuid(resumeEl) != queueItem.GeneratedResumeId)
            {
                return "tailored resume changed since approval";
            }

            if (!root.TryGetProperty("answersHash", out var hashEl)
                || hashEl.GetString() != ComputeAnswersHash(queueItem.PrefilledAnswersJson))
            {
                return "screening answers changed since approval";
            }

            if (!root.TryGetProperty("targetCompany", out var companyEl)
                || (companyEl.GetString() ?? string.Empty) != (queueItem.TargetCompany ?? string.Empty))
            {
                return "target company changed since approval";
            }

            if (!root.TryGetProperty("targetRole", out var roleEl)
                || (roleEl.GetString() ?? string.Empty) != (queueItem.TargetRole ?? string.Empty))
            {
                return "target role changed since approval";
            }

            return null;
        }
    }

    public static string ComputeAnswersHash(string? prefilledAnswersJson)
    {
        var bytes = Encoding.UTF8.GetBytes(prefilledAnswersJson ?? "[]");
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    private static Guid? GetNullableGuid(JsonElement element)
        => element.ValueKind == JsonValueKind.Null
            ? null
            : element.TryGetGuid(out var g) ? g : null;
}
