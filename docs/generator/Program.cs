using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Diagnostics;

QuestPDF.Settings.License = LicenseType.Community;

var outputPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
    "Downloads",
    $"VedhaAI_Project_Documentation_{DateTime.Now:yyyyMMdd_HHmmss}.pdf"
);

Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);

Console.WriteLine("Generating Vedha AI Project Documentation PDF...");
Console.WriteLine($"Output: {outputPath}");

var document = new VedhaAiDocumentation();
document.GeneratePdf(outputPath);

Console.WriteLine("PDF generated successfully!");
Console.WriteLine($"File size: {new FileInfo(outputPath).Length / 1024} KB");

// Try to open the PDF
try
{
    Process.Start(new ProcessStartInfo(outputPath) { UseShellExecute = true });
}
catch { }