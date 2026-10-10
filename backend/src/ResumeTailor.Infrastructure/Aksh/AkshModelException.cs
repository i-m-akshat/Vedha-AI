using System;

namespace ResumeTailor.Infrastructure.Aksh;

/// <summary>
/// The model layer failed in a way the harness must see as FAILURE, not as
/// chat text. Carries a stable reasonCode so the runner can emit an honest
/// error event, park the session, and release the turn lock instead of
/// chaining grounded work onto an ungrounded apology.
/// </summary>
public sealed class AkshModelException : Exception
{
    public string ReasonCode { get; }

    public AkshModelException(string reasonCode, string message)
        : base(message)
    {
        ReasonCode = reasonCode;
    }
}
