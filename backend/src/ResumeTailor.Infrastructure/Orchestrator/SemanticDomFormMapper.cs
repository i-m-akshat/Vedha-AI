using System.Text.Json;
using AngleSharp.Dom;
using AngleSharp.Html.Dom;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Infrastructure.Orchestrator;

public class DomFieldDescriptor
{
    public string Label { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = "text"; // text, file, number, email, tel, textarea, select, radio, checkbox
    public string Placeholder { get; set; } = string.Empty;
    public string AriaLabel { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public bool IsRequired { get; set; }
    public string? InferredMappedValue { get; set; }
    public string MappingSource { get; set; } = "Inferred"; // Profile, Memory, AI Grounding
}

public class SemanticDomFormMapper
{
    private readonly IAiServiceFactory _aiFactory;

    public SemanticDomFormMapper(IAiServiceFactory aiFactory)
    {
        _aiFactory = aiFactory;
    }

    /// <summary>
    /// Scans an AngleSharp document DOM and extracts semantic form fields without hardcoded CSS selectors.
    /// </summary>
    public List<DomFieldDescriptor> ExtractSemanticFields(IDocument document)
    {
        var fields = new List<DomFieldDescriptor>();
        var inputs = document.QuerySelectorAll("input, textarea, select");

        foreach (var el in inputs)
        {
            var tagName = el.TagName.ToLowerInvariant();
            var inputType = el.GetAttribute("type")?.ToLowerInvariant() ?? (tagName == "textarea" ? "textarea" : tagName == "select" ? "select" : "text");

            // Skip hidden, submit, button inputs
            if (inputType is "hidden" or "submit" or "button" or "reset" or "image")
                continue;

            var name = el.GetAttribute("name") ?? string.Empty;
            var id = el.Id ?? string.Empty;
            var placeholder = el.GetAttribute("placeholder") ?? string.Empty;
            var ariaLabel = el.GetAttribute("aria-label") ?? string.Empty;
            var isRequired = el.HasAttribute("required");

            // Infer label text by searching associated label or parent label
            string labelText = string.Empty;
            if (!string.IsNullOrEmpty(id))
            {
                var labelEl = document.QuerySelector($"label[for='{id}']");
                if (labelEl != null) labelText = labelEl.TextContent.Trim();
            }

            if (string.IsNullOrEmpty(labelText))
            {
                var parentLabel = el.Closest("label");
                if (parentLabel != null) labelText = parentLabel.TextContent.Trim();
            }

            if (string.IsNullOrEmpty(labelText))
            {
                // Heuristic: preceding sibling or parent container heading/text
                var prev = el.PreviousElementSibling;
                if (prev != null && (prev.TagName.Equals("label", StringComparison.OrdinalIgnoreCase) || prev.TagName.Equals("span", StringComparison.OrdinalIgnoreCase)))
                {
                    labelText = prev.TextContent.Trim();
                }
            }

            var descriptor = new DomFieldDescriptor
            {
                Label = !string.IsNullOrEmpty(labelText) ? labelText : (!string.IsNullOrEmpty(placeholder) ? placeholder : (!string.IsNullOrEmpty(ariaLabel) ? ariaLabel : name)),
                Name = name,
                Id = id,
                Type = inputType,
                Placeholder = placeholder,
                AriaLabel = ariaLabel,
                IsRequired = isRequired
            };

            if (el is IHtmlSelectElement select)
            {
                descriptor.Options = select.Options.Select(o => o.Text.Trim()).Where(t => !string.IsNullOrEmpty(t)).ToList();
            }

            fields.Add(descriptor);
        }

        return fields;
    }

    /// <summary>
    /// Maps extracted semantic fields to candidate profile data and answers screening questions using Gemini AI grounding.
    /// </summary>
    public async Task<List<DomFieldDescriptor>> MapFieldsToCandidateAsync(
        List<DomFieldDescriptor> fields,
        CandidateProfile profile,
        ResumeSchema resumeData,
        List<ScreeningQuestionMemory> memoryList,
        CancellationToken cancellationToken = default)
    {
        var mappedFields = new List<DomFieldDescriptor>();
        var unmappedCustomQuestions = new List<DomFieldDescriptor>();

        foreach (var field in fields)
        {
            var descriptor = $"{field.Label} {field.Name} {field.Placeholder} {field.AriaLabel}".ToLowerInvariant();

            // 1. Standard Fields Mapping
            if (descriptor.Contains("first name") || descriptor.Contains("given name") || field.Name.Equals("fname", StringComparison.OrdinalIgnoreCase))
            {
                var parts = (resumeData.PersonalInfo.FullName ?? string.Empty).Split(' ');
                field.InferredMappedValue = parts[0];
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("last name") || descriptor.Contains("family name") || descriptor.Contains("surname") || field.Name.Equals("lname", StringComparison.OrdinalIgnoreCase))
            {
                var parts = (resumeData.PersonalInfo.FullName ?? string.Empty).Split(' ');
                field.InferredMappedValue = parts.Length > 1 ? string.Join(' ', parts.Skip(1)) : string.Empty;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("full name") || (descriptor.Contains("name") && !descriptor.Contains("company") && !descriptor.Contains("file")))
            {
                field.InferredMappedValue = resumeData.PersonalInfo.FullName;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (field.Type == "email" || descriptor.Contains("email"))
            {
                field.InferredMappedValue = resumeData.PersonalInfo.Email;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (field.Type == "tel" || descriptor.Contains("phone") || descriptor.Contains("mobile"))
            {
                field.InferredMappedValue = !string.IsNullOrEmpty(profile.PhoneNumber) ? profile.PhoneNumber : resumeData.PersonalInfo.Phone;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("linkedin"))
            {
                field.InferredMappedValue = !string.IsNullOrEmpty(profile.LinkedInUrl) ? profile.LinkedInUrl : resumeData.PersonalInfo.LinkedInUrl;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("github"))
            {
                field.InferredMappedValue = !string.IsNullOrEmpty(profile.GithubUrl) ? profile.GithubUrl : resumeData.PersonalInfo.GitHubUrl;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("portfolio") || descriptor.Contains("website"))
            {
                field.InferredMappedValue = !string.IsNullOrEmpty(profile.PortfolioUrl) ? profile.PortfolioUrl : resumeData.PersonalInfo.PortfolioUrl;
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("notice") || descriptor.Contains("start date"))
            {
                field.InferredMappedValue = profile.NoticePeriodDays == 0 ? "Immediate" : $"{profile.NoticePeriodDays} days";
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("salary") || descriptor.Contains("compensation") || descriptor.Contains("ctc"))
            {
                field.InferredMappedValue = !string.IsNullOrEmpty(profile.ExpectedSalary) ? profile.ExpectedSalary : "Negotiable";
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (descriptor.Contains("sponsorship") || descriptor.Contains("require visa"))
            {
                field.InferredMappedValue = profile.RequiresVisaSponsorship ? "Yes" : "No";
                field.MappingSource = "CandidateProfile";
                mappedFields.Add(field);
            }
            else if (field.Type == "file")
            {
                field.InferredMappedValue = "[ATS-Tailored-Resume.pdf]";
                field.MappingSource = "TailoredResumeAttachment";
                mappedFields.Add(field);
            }
            else
            {
                // 2. Check Browser Agent Memory
                var memMatch = memoryList.FirstOrDefault(m => m.QuestionText.Trim().Equals(field.Label.Trim(), StringComparison.OrdinalIgnoreCase));
                if (memMatch != null)
                {
                    field.InferredMappedValue = memMatch.AnswerText;
                    field.MappingSource = "BrowserAgentMemory";
                    mappedFields.Add(field);
                }
                else
                {
                    unmappedCustomQuestions.Add(field);
                }
            }
        }

        // 3. Ground remaining questions via Gemini AI (STAR method / numeric calculation)
        if (unmappedCustomQuestions.Any())
        {
            var aiService = _aiFactory.GetProvider(AiProviderType.Gemini);
            var systemPrompt = @"You are an expert candidate application form filler.
Answer each form field accurately using ONLY facts from the candidate's verified profile and resume experience.
Output JSON array of { ""Label"": ""..."", ""Answer"": ""..."" }";

            var userPrompt = $@"CANDIDATE PROFILE:
- Notice Period: {profile.NoticePeriodDays} days
- Work Auth: {profile.WorkAuthorizationStatus}
- Expected Salary: {profile.ExpectedSalary}
- Evidence Base: {profile.EvidenceKnowledgeBaseJson}

RESUME:
{JsonSerializer.Serialize(resumeData)}

FIELDS TO ANSWER:
{JsonSerializer.Serialize(unmappedCustomQuestions.Select(q => new { q.Label, q.Type, q.Options }))}";

            var aiResult = await aiService.GenerateStructuredJsonAsync<List<AiFieldAnswerResponse>>(
                systemPrompt, userPrompt, cancellationToken: cancellationToken);

            if (aiResult.IsSuccess && aiResult.Value != null)
            {
                foreach (var ans in aiResult.Value)
                {
                    var targetField = unmappedCustomQuestions.FirstOrDefault(f => f.Label.Trim().Equals(ans.Label.Trim(), StringComparison.OrdinalIgnoreCase));
                    if (targetField != null)
                    {
                        targetField.InferredMappedValue = ans.Answer;
                        targetField.MappingSource = "AIGrounding";
                        mappedFields.Add(targetField);
                    }
                }
            }
        }

        return mappedFields;
    }
}

public class AiFieldAnswerResponse
{
    public string Label { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
}
