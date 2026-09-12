namespace ResumeTailor.Domain.Enums;

public enum ApplicationStatus
{
    Saved = 0,
    Applied = 1,
    Interviewing = 2,
    Offered = 3,
    Rejected = 4,
    Archived = 5
}

public enum JobSource
{
    DirectText = 0,
    LinkedIn = 1,
    Greenhouse = 2,
    Lever = 3,
    Workday = 4,
    Ashby = 5,
    Wellfound = 6,
    Indeed = 7,
    CompanyCareers = 8,
    Other = 9
}

public enum AiProviderType
{
    OpenAi = 0,
    Claude = 1,
    Gemini = 2
}

public enum ResumeFormat
{
    Pdf = 0,
    Docx = 1,
    Markdown = 2,
    Json = 3
}

public enum TemplateStyle
{
    ClassicAts = 0,
    ModernMinimalist = 1,
    ExecutiveClean = 2,
    TechnicalPro = 3
}
