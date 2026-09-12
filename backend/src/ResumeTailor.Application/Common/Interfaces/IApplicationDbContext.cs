using Microsoft.EntityFrameworkCore;
using ResumeTailor.Domain.Entities;

namespace ResumeTailor.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<User> Users { get; }
    DbSet<MasterResume> MasterResumes { get; }
    DbSet<ResumeVersion> ResumeVersions { get; }
    DbSet<GeneratedResume> GeneratedResumes { get; }
    DbSet<JobDescription> JobDescriptions { get; }
    DbSet<AtsAnalysis> AtsAnalyses { get; }
    DbSet<ApplicationRecord> Applications { get; }
    DbSet<PromptTemplate> PromptTemplates { get; }
    DbSet<UsageLog> UsageLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
