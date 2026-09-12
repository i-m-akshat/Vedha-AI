namespace ResumeTailor.Application.Common.Exceptions;

public class AppException : Exception
{
    public AppException(string message) : base(message) { }
    public AppException(string message, Exception innerException) : base(message, innerException) { }
}

public class NotFoundException : AppException
{
    public NotFoundException(string name, object key)
        : base($"Entity \"{name}\" ({key}) was not found.") { }
}

public class ValidationException : AppException
{
    public IDictionary<string, string[]> Errors { get; }

    public ValidationException(IDictionary<string, string[]> errors)
        : base("One or more validation failures have occurred.")
    {
        Errors = errors;
    }
}

public class UnauthorizedException : AppException
{
    public UnauthorizedException(string message = "Unauthorized access.") : base(message) { }
}

public class TruthPreservationException : AppException
{
    public List<string> Violations { get; }

    public TruthPreservationException(List<string> violations) 
        : base("Strict truth preservation check failed: The tailored resume attempts to introduce unverified entities.")
    {
        Violations = violations;
    }
}
