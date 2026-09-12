using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Markdig;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using UglyToad.PdfPig;
using UglyToad.PdfPig.DocumentLayoutAnalysis.TextExtractor;

namespace ResumeTailor.Infrastructure.Parsing;

public class PdfDocumentParser : IDocumentParser
{
    public bool CanParse(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext == ".pdf" || contentType.Contains("pdf", StringComparison.OrdinalIgnoreCase);
    }

    public Task<Result<string>> ExtractTextAsync(Stream fileStream, string fileName, CancellationToken cancellationToken = default)
    {
        try
        {
            using var memoryStream = new MemoryStream();
            fileStream.CopyTo(memoryStream);
            memoryStream.Position = 0;

            using var document = PdfDocument.Open(memoryStream);
            var sb = new StringBuilder();

            foreach (var page in document.GetPages())
            {
                var pageText = ContentOrderTextExtractor.GetText(page);
                sb.AppendLine(pageText);
                sb.AppendLine();
            }

            var text = sb.ToString().Trim();
            if (string.IsNullOrWhiteSpace(text))
            {
                return Task.FromResult(Result<string>.Failure("The uploaded PDF appears to be empty or contains scanned images without selectable text."));
            }

            return Task.FromResult(Result<string>.Success(text));
        }
        catch (Exception ex)
        {
            return Task.FromResult(Result<string>.Failure($"PDF extraction failed: {ex.Message}"));
        }
    }
}

public class DocxDocumentParser : IDocumentParser
{
    public bool CanParse(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext == ".docx" || contentType.Contains("wordprocessingml", StringComparison.OrdinalIgnoreCase);
    }

    public Task<Result<string>> ExtractTextAsync(Stream fileStream, string fileName, CancellationToken cancellationToken = default)
    {
        try
        {
            using var memoryStream = new MemoryStream();
            fileStream.CopyTo(memoryStream);
            memoryStream.Position = 0;

            using var doc = WordprocessingDocument.Open(memoryStream, false);
            var body = doc.MainDocumentPart?.Document.Body;
            if (body == null)
            {
                return Task.FromResult(Result<string>.Failure("Invalid DOCX format: Document body not found."));
            }

            var sb = new StringBuilder();
            foreach (var paragraph in body.Descendants<Paragraph>())
            {
                var text = paragraph.InnerText;
                if (!string.IsNullOrWhiteSpace(text))
                {
                    sb.AppendLine(text);
                }
            }

            var resultText = sb.ToString().Trim();
            if (string.IsNullOrWhiteSpace(resultText))
            {
                return Task.FromResult(Result<string>.Failure("The uploaded DOCX file contains no readable text."));
            }

            return Task.FromResult(Result<string>.Success(resultText));
        }
        catch (Exception ex)
        {
            return Task.FromResult(Result<string>.Failure($"DOCX extraction failed: {ex.Message}"));
        }
    }
}

public class MarkdownDocumentParser : IDocumentParser
{
    public bool CanParse(string fileName, string contentType)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".md" or ".markdown" or ".txt" || contentType.Contains("markdown", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<Result<string>> ExtractTextAsync(Stream fileStream, string fileName, CancellationToken cancellationToken = default)
    {
        try
        {
            using var reader = new StreamReader(fileStream, Encoding.UTF8);
            var raw = await reader.ReadToEndAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(raw))
            {
                return Result<string>.Failure("The uploaded Markdown file is empty.");
            }

            var plainText = Markdown.ToPlainText(raw);
            return Result<string>.Success(plainText);
        }
        catch (Exception ex)
        {
            return Result<string>.Failure($"Markdown extraction failed: {ex.Message}");
        }
    }
}
