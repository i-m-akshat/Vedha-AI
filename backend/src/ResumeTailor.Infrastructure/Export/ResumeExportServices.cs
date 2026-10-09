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
        resume.NormalizeAndSortExperience();
        var totalHighlights = resume.Experience.Sum(e => e.Highlights.Count) + resume.Projects.Sum(p => p.Highlights.Count);
        var totalWords = (resume.Summary?.Length ?? 0) / 5 + totalHighlights * 15;

        // Dynamic Document Budgeting: Auto-scale typography & spacing to guarantee strict 1-page/2-page bounds without orphan line spills
        var isDense = totalHighlights > 8 || totalWords > 350;
        var margin = isDense ? 22f : 28f;
        var baseFontSize = isDense ? 9.0f : 9.5f;
        var headerFontSize = isDense ? 16f : 18f;
        var lineHeight = isDense ? 1.15f : 1.25f;
        var sectionPadding = isDense ? 3f : 4f;
        var itemSpacing = isDense ? 4f : 6f;

        var fontFamily = style switch
        {
            TemplateStyle.ClassicAts => "Times New Roman",
            TemplateStyle.ModernMinimalist => "Arial",
            TemplateStyle.ExecutiveClean => "Georgia",
            TemplateStyle.TechnicalPro => "Consolas",
            _ => "Arial"
        };

        var primaryColor = style switch
        {
            TemplateStyle.ModernMinimalist => Colors.Blue.Darken3,
            TemplateStyle.ExecutiveClean => Colors.BlueGrey.Darken4,
            TemplateStyle.TechnicalPro => Colors.Teal.Darken3,
            _ => Colors.Black
        };

        var document = QuestPDF.Fluent.Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(margin, Unit.Point);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily(fontFamily).FontSize(baseFontSize).FontColor(Colors.Grey.Darken4));

                page.Content().Column(col =>
                {
                    col.Spacing(itemSpacing);

                    // Header: Name & Contact
                    col.Item().AlignCenter().Column(header =>
                    {
                        header.Item().AlignCenter().Text(resume.PersonalInfo.FullName).Bold().FontSize(headerFontSize).FontColor(Colors.Black);
                        
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
                            RenderSectionHeader(section, "PROFESSIONAL SUMMARY", primaryColor, style);
                            section.Item().Text(resume.Summary).LineHeight(1.25f);
                        });
                    }

                    // Skills
                    if (resume.Skills.Any())
                    {
                        col.Item().PaddingTop(4).Column(section =>
                        {
                            RenderSectionHeader(section, "TECHNICAL SKILLS", primaryColor, style);
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
                            RenderSectionHeader(section, "WORK EXPERIENCE", primaryColor, style);
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
                            RenderSectionHeader(section, "PROJECTS", primaryColor, style);
                            foreach (var proj in resume.Projects)
                            {
                                section.Item().PaddingBottom(3).Column(projCol =>
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
                            RenderSectionHeader(section, "EDUCATION", primaryColor, style);
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
                            RenderSectionHeader(section, "CERTIFICATIONS", primaryColor, style);
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

    private static void RenderSectionHeader(ColumnDescriptor section, string title, string primaryColor, TemplateStyle style)
    {
        section.Item().PaddingBottom(2).Column(c =>
        {
            c.Item().Text(title).Bold().FontSize(11).FontColor(primaryColor);
            if (style == TemplateStyle.ModernMinimalist)
            {
                c.Item().LineHorizontal(1.5f).LineColor(primaryColor);
            }
            else if (style != TemplateStyle.ExecutiveClean)
            {
                c.Item().LineHorizontal(0.75f).LineColor(Colors.Grey.Lighten1);
            }
        });
    }

    public Task<byte[]> ExportDocxAsync(ResumeSchema resume, TemplateStyle style, CancellationToken cancellationToken = default)
    {
        resume.NormalizeAndSortExperience();
        var (fontFamily, primaryHexColor) = style switch
        {
            TemplateStyle.ModernMinimalist => ("Arial", "1E3A8A"), // Deep Navy Blue
            TemplateStyle.ExecutiveClean => ("Georgia", "1F2937"), // Slate/Charcoal
            TemplateStyle.TechnicalPro => ("Consolas", "0F766E"), // Deep Teal
            _ => ("Times New Roman", "111827") // Classic Ats - Charcoal
        };

        using var stream = new MemoryStream();
        using (var wordDoc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document, true))
        {
            var mainPart = wordDoc.AddMainDocumentPart();
            mainPart.Document = new DocumentFormat.OpenXml.Wordprocessing.Document();
            var body = mainPart.Document.AppendChild(new Body());

            // Name
            var nameRun = new Run(new Text(resume.PersonalInfo.FullName) { Space = SpaceProcessingModeValues.Preserve })
            {
                RunProperties = new RunProperties(
                    new Bold(),
                    new DocumentFormat.OpenXml.Wordprocessing.Color { Val = primaryHexColor },
                    new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                    new FontSize { Val = "32" } // 16pt
                )
            };
            var namePara = body.AppendChild(new Paragraph(nameRun));
            namePara.ParagraphProperties = new ParagraphProperties(
                new Justification { Val = JustificationValues.Center },
                new SpacingBetweenLines { After = "40" });

            // Contact info
            var contacts = new List<string>();
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Email)) contacts.Add(resume.PersonalInfo.Email);
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Phone)) contacts.Add(resume.PersonalInfo.Phone);
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.Location)) contacts.Add(resume.PersonalInfo.Location);
            if (!string.IsNullOrWhiteSpace(resume.PersonalInfo.LinkedInUrl)) contacts.Add(resume.PersonalInfo.LinkedInUrl);

            var contactRun = new Run(new Text(string.Join(" | ", contacts)))
            {
                RunProperties = new RunProperties(
                    new DocumentFormat.OpenXml.Wordprocessing.Color { Val = "4B5563" },
                    new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                    new FontSize { Val = "19" } // 9.5pt
                )
            };
            var contactPara = body.AppendChild(new Paragraph(contactRun));
            contactPara.ParagraphProperties = new ParagraphProperties(
                new Justification { Val = JustificationValues.Center },
                new SpacingBetweenLines { After = "120" });

            // Summary
            if (!string.IsNullOrWhiteSpace(resume.Summary))
            {
                AddDocxSectionHeader(body, "PROFESSIONAL SUMMARY", primaryHexColor, fontFamily, style);
                body.AppendChild(CreateBodyParagraph(resume.Summary, fontFamily));
            }

            // Skills
            if (resume.Skills.Any())
            {
                AddDocxSectionHeader(body, "TECHNICAL SKILLS", primaryHexColor, fontFamily, style);
                foreach (var cat in resume.Skills)
                {
                    var p = body.AppendChild(new Paragraph());
                    p.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "20" });
                    p.AppendChild(new Run(new Text($"{cat.CategoryName}: ") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(new Bold(), new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                    });
                    p.AppendChild(new Run(new Text(string.Join(", ", cat.Skills)))
                    {
                        RunProperties = new RunProperties(new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                    });
                }
            }

            // Experience
            if (resume.Experience.Any())
            {
                AddDocxSectionHeader(body, "WORK EXPERIENCE", primaryHexColor, fontFamily, style);
                foreach (var exp in resume.Experience)
                {
                    var pHeader = body.AppendChild(new Paragraph());
                    pHeader.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { Before = "60", After = "20" });
                    pHeader.AppendChild(new Run(new Text($"{exp.Role} - {exp.Company}") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(new Bold(), new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "21" })
                    });
                    pHeader.AppendChild(new Run(new Text($" ({exp.StartDate} - {(exp.IsCurrent ? "Present" : exp.EndDate)})") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(
                            new DocumentFormat.OpenXml.Wordprocessing.Color { Val = "6B7280" },
                            new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                            new FontSize { Val = "19" })
                    });

                    foreach (var bullet in exp.Highlights)
                    {
                        var pBullet = body.AppendChild(new Paragraph());
                        pBullet.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "20" }, new Indentation { Left = "240" });
                        pBullet.AppendChild(new Run(new Text($"•  {bullet}") { Space = SpaceProcessingModeValues.Preserve })
                        {
                            RunProperties = new RunProperties(new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                        });
                    }
                }
            }

            // Projects
            if (resume.Projects.Any())
            {
                AddDocxSectionHeader(body, "KEY PROJECTS", primaryHexColor, fontFamily, style);
                foreach (var proj in resume.Projects)
                {
                    var pProj = body.AppendChild(new Paragraph());
                    pProj.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { Before = "60", After = "20" });
                    pProj.AppendChild(new Run(new Text(proj.Title) { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(new Bold(), new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "21" })
                    });
                    if (!string.IsNullOrWhiteSpace(proj.Technologies))
                    {
                        pProj.AppendChild(new Run(new Text($" ({proj.Technologies})") { Space = SpaceProcessingModeValues.Preserve })
                        {
                            RunProperties = new RunProperties(
                                new DocumentFormat.OpenXml.Wordprocessing.Color { Val = "6B7280" },
                                new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                                new FontSize { Val = "19" })
                        });
                    }

                    if (!string.IsNullOrWhiteSpace(proj.Description))
                    {
                        body.AppendChild(CreateBodyParagraph(proj.Description, fontFamily));
                    }
                    foreach (var bullet in proj.Highlights)
                    {
                        var pBullet = body.AppendChild(new Paragraph());
                        pBullet.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "20" }, new Indentation { Left = "240" });
                        pBullet.AppendChild(new Run(new Text($"•  {bullet}") { Space = SpaceProcessingModeValues.Preserve })
                        {
                            RunProperties = new RunProperties(new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                        });
                    }
                }
            }

            // Education
            if (resume.Education.Any())
            {
                AddDocxSectionHeader(body, "EDUCATION", primaryHexColor, fontFamily, style);
                foreach (var edu in resume.Education)
                {
                    var pEdu = body.AppendChild(new Paragraph());
                    pEdu.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "20" });
                    pEdu.AppendChild(new Run(new Text($"{edu.Degree} in {edu.FieldOfStudy}, {edu.Institution}") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(new Bold(), new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                    });
                    pEdu.AppendChild(new Run(new Text($" ({edu.GraduationYear})") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(
                            new DocumentFormat.OpenXml.Wordprocessing.Color { Val = "6B7280" },
                            new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                            new FontSize { Val = "19" })
                    });
                }
            }

            // Certifications
            if (resume.Certifications.Any())
            {
                AddDocxSectionHeader(body, "CERTIFICATIONS", primaryHexColor, fontFamily, style);
                foreach (var cert in resume.Certifications)
                {
                    var pCert = body.AppendChild(new Paragraph());
                    pCert.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "20" });
                    pCert.AppendChild(new Run(new Text($"{cert.Name} - {cert.Issuer}") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(new Bold(), new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily }, new FontSize { Val = "20" })
                    });
                    pCert.AppendChild(new Run(new Text($" ({cert.IssueDate})") { Space = SpaceProcessingModeValues.Preserve })
                    {
                        RunProperties = new RunProperties(
                            new DocumentFormat.OpenXml.Wordprocessing.Color { Val = "6B7280" },
                            new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                            new FontSize { Val = "19" })
                    });
                }
            }

            wordDoc.Save();
        }

        return Task.FromResult(stream.ToArray());
    }

    private static Paragraph CreateBodyParagraph(string text, string fontFamily)
    {
        var runProps = new RunProperties(
            new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
            new FontSize { Val = "20" } // 10pt
        );
        var p = new Paragraph(new Run(new Text(text) { Space = SpaceProcessingModeValues.Preserve }) { RunProperties = runProps });
        p.ParagraphProperties = new ParagraphProperties(new SpacingBetweenLines { After = "40" });
        return p;
    }

    private static void AddDocxSectionHeader(Body body, string title, string primaryHexColor, string fontFamily, TemplateStyle style)
    {
        var run = new Run(new Text(title))
        {
            RunProperties = new RunProperties(
                new Bold(),
                new DocumentFormat.OpenXml.Wordprocessing.Color { Val = primaryHexColor },
                new RunFonts { Ascii = fontFamily, HighAnsi = fontFamily },
                new FontSize { Val = "22" } // 11pt
            )
        };
        var para = body.AppendChild(new Paragraph(run));
        var paraProps = new ParagraphProperties(new SpacingBetweenLines { Before = "160", After = "40" });

        if (style == TemplateStyle.ModernMinimalist)
        {
            paraProps.ParagraphBorders = new ParagraphBorders(new BottomBorder
            {
                Val = BorderValues.Single,
                Size = 12U,
                Space = 1U,
                Color = primaryHexColor
            });
        }
        else if (style != TemplateStyle.ExecutiveClean)
        {
            paraProps.ParagraphBorders = new ParagraphBorders(new BottomBorder
            {
                Val = BorderValues.Single,
                Size = 4U,
                Space = 1U,
                Color = "D1D5DB"
            });
        }
        para.ParagraphProperties = paraProps;
    }

    public string ExportMarkdown(ResumeSchema resume)
    {
        resume.NormalizeAndSortExperience();
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
