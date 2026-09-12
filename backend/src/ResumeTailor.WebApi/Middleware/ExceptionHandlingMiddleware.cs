using System.Net;
using System.Text.Json;
using ResumeTailor.Application.Common.Exceptions;

namespace ResumeTailor.WebApi.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            StatusCode = (int)HttpStatusCode.InternalServerError,
            Title = "An error occurred while processing your request.",
            Detail = exception.Message,
            Errors = (object?)null
        };

        switch (exception)
        {
            case ValidationException valEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response = new
                {
                    StatusCode = (int)HttpStatusCode.BadRequest,
                    Title = "Validation Failed",
                    Detail = valEx.Message,
                    Errors = (object?)valEx.Errors
                };
                break;

            case NotFoundException notFoundEx:
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                response = new
                {
                    StatusCode = (int)HttpStatusCode.NotFound,
                    Title = "Resource Not Found",
                    Detail = notFoundEx.Message,
                    Errors = (object?)null
                };
                break;

            case UnauthorizedException unauthEx:
                context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                response = new
                {
                    StatusCode = (int)HttpStatusCode.Unauthorized,
                    Title = "Unauthorized",
                    Detail = unauthEx.Message,
                    Errors = (object?)null
                };
                break;

            case TruthPreservationException truthEx:
                context.Response.StatusCode = (int)HttpStatusCode.UnprocessableEntity;
                response = new
                {
                    StatusCode = (int)HttpStatusCode.UnprocessableEntity,
                    Title = "Truth Preservation Guardrail Failed",
                    Detail = truthEx.Message,
                    Errors = (object?)truthEx.Violations
                };
                break;

            default:
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                break;
        }

        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await context.Response.WriteAsync(json);
    }
}
