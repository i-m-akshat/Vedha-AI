using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Enums;
using ResumeTailor.Domain.ValueObjects;

namespace ResumeTailor.Infrastructure.Export;

public class ResumeExportService : IResumeExportService
{
    static ResumeExportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public Task<byte[]> ExportPdfAsync(ResumeSchema resume, TemplateStyle style, CancellationToken cancellationToken = default)
    {
        var document = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28, Unit.Point);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(9.5f).FontColor(Colors.Grey.Darken4));

                page.Content().Column(col =>
                {
                    col.Spacing(6);

                    // Header: Name & Contact
                    col.Item().AlignCenter().Column(header =>
                    {
                        header.Item().AlignCenter().Text(resume.PersonalInfo.FullName).Bold().FontSize(18).FontColor(Colors.Black);
                        
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Title))
                        {
                            header.Item().AlignCenter().Text(resume.PersonalInfo.Title).FontSize(11).FontColor(Colors.Grey.Darken2);
                        }

                        var contactDetails = new List<string>();
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Email)) contactDetails.Add(resume.PersonalInfo.Email);
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Phone)) contactDetails.Add(resume.PersonalInfo.Phone);
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Location)) contactDetails.Add(resume.PersonalInfo.Location);
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.LinkedInUrl)) contactDetails.Add(resume.PersonalInfo.LinkedInUrl);
                        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.GitHubUrl)) contactDetails.Add(resume.PersonalInfo.GitHubUrl);

                        header.Item().AlignCenter().Text(string.Join(" | ", contactDetails)).FontSize(8.5f).FontColor(Colors.Grey.Darken2);
                    });

                    // Summary
                    if (!string.IsNullOrWhiteSpace(resume.Summary))
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "PROFESSIONAL SUMMARY");
                            section.Item().Text(resume.Summary).LineHeight(1.25f);
                        });
                    }

                    // Skills
                    if (resume.Skills.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "TECHNICAL SKILLS");
                            foreach (var cat in resume.Skills.Where(c => c.Skills.Any()))
                            {
                                section.Item().Row(row =>
                                {
                                    row.AutoItem().Text($"{cat.CategoryName}: ").Bold();
                                    row.RelativeItem().Text(string.Join(", ", cat.Skills));
                                });
                            }
                        });
                    }

                    // Experience
                    if (resume.Experience.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "WORK EXPERIENCE");
                            foreach (var exp in resume.Experience)
                            {
                                section.Item().PaddingBottom(4).Column(expCol =>
                                {
                                    expCol.Item().Row(r =>
                                    {
                                        r.RelativeItem().Text($"{exp.Role} - {exp.Company}").Bold();
                                        r.AutoItem().Text($"{exp.StartDate} - {(exp.IsCurrent ? "Present" : exp.EndDate)}").FontColor(Colors.Grey.Darken2);
                                    });

                                    if (!string.IsNullOrWhiteSpace(exp.Location))
                                    {
                                        expCol.Item().Text(exp.Location).Italic().FontSize(8.5f).FontColor(Colors.Grey.Darken1);
                                    }

                                    foreach (var bullet in exp.Highlights)
                                    {
                                        expCol.Item().Row(bRow =>
                                        {
                                            bRow.ConstantItem(12).Text("•");
                                            bRow.RelativeItem().Text(bullet).LineHeight(1.2f);
                                        });
                                    }
                                });
                            }
                        });
                    }

                    // Projects
                    if (resume.Projects.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "KEY PROJECTS");
                            foreach (var proj in resume.Projects)
                            {
                                section.Item().PaddingBottom(4).Column(projCol =>
                                {
                                    projCol.Item().Row(r =>
                                    {
                                        r.RelativeItem().Text(proj.Title).Bold();
                                        if (!string.IsNullOrWhiteSpace(proj.Technologies))
                                        {
                                            r.AutoItem().Text($"Tech: {proj.Technologies}").Italic().FontSize(8.5f);
                                        }
                                    });

                                    if (!string.IsNullOrWhiteSpace(proj.Description))
                                    {
                                        projCol.Item().Text(proj.Description);
                                    }

                                    foreach (var bullet in proj.Highlights)
                                    {
                                        projCol.Item().Row(bRow =>
                                        {
                                            bRow.ConstantItem(12).Text("•");
                                            bRow.RelativeItem().Text(bullet).LineHeight(1.2f);
                                        });
                                    }
                                });
                            }
                        });
                    }

                    // Education
                    if (resume.Education.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "EDUCATION");
                            foreach (var edu in resume.Education)
                            {
                                section.Item().PaddingBottom(2).Row(r =>
                                {
                                    r.RelativeItem().Text($"{edu.Degree} in {edu.FieldOfStudy}, {edu.Institution}").Bold();
                                    r.AutoItem().Text(edu.GraduationYear).FontColor(Colors.Grey.Darken2);
                                });
                            }
                        });
                    }

                    // Certifications
                    if (resume.Certifications.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "CERTIFICATIONS");
                            foreach (var cert in resume.Certifications)
                            {
                                section.Item().PaddingBottom(1).Row(r =>
                                {
                                    r.RelativeItem().Text($"{cert.Name} - {cert.Issuer}").Bold();
                                    r.AutoItem().Text(cert.IssueDate).FontColor(Colors.Grey.Darken2);
                                });
                            }
                        });
                    }
                });
            });
        });

        var pdfBytes = document.GeneratePdf();
        return Task.FromResult(pdfBytes);
    }

    private static void RenderSectionHeader(ColumnDescriptor section, string title)
    {
        section.Item().PaddingBottom(2).Column(c =>
        {
            c.Item().Text(title).Bold().FontSize(11).FontColor(Colors.Black);
            c.Item().LineHorizontal(0.75f).LineColor(Colors.Grey.Lighten1);
        });
    }

    public Task<byte[]> ExportDocxAsync(ResumeSchema resume, TemplateStyle style, CancellationToken cancellationToken = default)
    {
        using var stream = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
            var body = mainPart.Document.AppendChild(new Body());

            // Name
            var namePara = body.AppendChild(new Paragraph(new Run(new Text(resume.PersonalInfo.FullName) { Space = SpaceProcessingModeValues.Preserve })));
            namePara.ParagraphProperties = new ParagraphProperties(new Justification { Val = JustificationValues.Center });

            // Contact info
            var contacts = new List<string>();
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Email)) contacts.Add(resume.PersonalInfo.Email);
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Phone)) contacts.Add(resume.PersonalInfo.Phone);
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Location)) contacts.Add(resume.PersonalInfo.Location);
            var contactPara = body.AppendChild(new Paragraph(new Run(new Text(string.Join(" | ", contacts)))));
            contactPara.ParagraphProperties = new ParagraphProperties(new Justification { Val = JustificationValues.Center });

            // Summary
            if (!string.IsNullOrWhiteSpace(resume.Summary))
            {
                AddDocxSectionHeader(body, "PROFESSIONAL SUMMARY");
                body.AppendChild(new Paragraph(new Run(new Text(resume.Summary))));
            }

            // Skills
            if (resume.Skills.Any())
            {
                AddDocxSectionHeader(body, "TECHNICAL SKILLS");
                foreach (var cat in resume.Skills)
                {
                    body.AppendChild(new Paragraph(new Run(new Text($"{cat.CategoryName}: {string.Join(", ", cat.Skills)}"))));
                }
            }

            // Experience
            if (resume.Experience.Any())
            {
                AddDocxSectionHeader(body, "WORK EXPERIENCE");
                foreach (var exp in resume.Experience)
                {
                    body.AppendChild(new Paragraph(new Run(new Text($"{exp.Role} - {exp.Company} ({exp.StartDate} - {(exp.IsCurrent ? "Present" : exp.EndDate)})"))));
                    foreach (var bullet in exp.Highlights)
                    {
                        body.AppendChild(new Paragraph(new Run(new Text($"• {bullet}"))));
                    }
                }
            }

            // Education
            if (resume.Education.Any())
            {
                AddDocxSectionHeader(body, "EDUCATION");
                foreach (var edu in resume.Education)
                {
                    body.AppendChild(new Paragraph(new Run(new Text($"{edu.Degree} in {edu.FieldOfStudy}, {edu.Institution} ({edu.GraduationYear})"))));
                }
            }

            wordDoc.Save();
        }

        return Task.FromResult(stream.ToArray());
    }

    private static void AddDocxSectionHeader(Body body, string title)
    {
        var para = body.AppendChild(new Paragraph(new Run(new Text(title)) { RunProperties = new RunProperties(new Bold()) }));
        para.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { Before = "120", After = "40" });
    }

    public string ExportMarkdown(ResumeSchema resume)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"# {resume.PersonalInfo.FullName}");
        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Title)) sb.AppendLine($"**{resume.PersonalInfo.Title}**");

        var contacts = new List<string>();
        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Email)) contacts.Add(resume.PersonalInfo.Email);
        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Phone)) contacts.Add(resume.PersonalInfo.Phone);
        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Location)) contacts.Add(resume.PersonalInfo.Location);
        if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.LinkedInUrl)) contacts.Add(resume.PersonalInfo.LinkedInUrl);
        sb.AppendLine(string.Join(" | ", contacts));
        sb.AppendLine();

        if (!string.IsNullOrWhiteSpace(resume.Summary))
        {
            sb.AppendLine("## Professional Summary");
            sb.AppendLine(resume.Summary);
            sb.AppendLine();
        }

        if (resume.Skills.Any())
        {
            sb.AppendLine("## Technical Skills");
            foreach (var cat in resume.Skills)
            {
                sb.AppendLine($"- **{cat.CategoryName}**: {string.Join(", ", cat.Skills)}");
            }
            sb.AppendLine();
        }

        if (resume.Experience.Any())
        {
            sb.AppendLine("## Work Experience");
            foreach (var exp in resume.Experience)
            {
                sb.AppendLine($"### {exp.Role} — {exp.Company}");
                sb.AppendLine($"*{exp.StartDate} – {(exp.IsCurrent ? "Present" : exp.EndDate)} | {exp.Location}*");
                foreach (var h in exp.Highlights)
                {
                    sb.AppendLine($"- {h}");
                }
                sb.AppendLine();
            }
        }

        if (resume.Projects.Any())
        {
            sb.AppendLine("## Key Projects");
            foreach (var proj in resume.Projects)
            {
                sb.AppendLine($"### {proj.Title}");
                if (!string.IsNullOrWhiteSpace(proj.Technologies)) sb.AppendLine($"*Technologies: {proj.Technologies}*");
                if (!string.IsNullOrWhiteSpace(proj.Description)) sb.AppendLine(proj.Description);
                foreach (var h in proj.Highlights)
                {
                    sb.AppendLine($"- {h}");
                }
                sb.AppendLine();
            }
        }

        if (resume.Education.Any())
        {
            sb.AppendLine("## Education");
            foreach (var edu in resume.Education)
            {
                sb.AppendLine($"- **{edu.Degree} in {edu.FieldOfStudy}**, {edu.Institution} ({edu.GraduationYear})");
            }
            sb.AppendLine();
        }

        if (resume.Certifications.Any())
        {
            sb.AppendLine("## Certifications");
            foreach (var cert in resume.Certifications)
            {
                sb.AppendLine($"- **{cert.Name}** — {cert.Issuer} ({cert.IssueDate})");
            }
        }

        return sb.ToString();
    }
}
