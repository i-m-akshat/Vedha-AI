using Microsoft.EntityFrameworkCore;
using ResumeTailor.Application.Common.Interfaces;
using ResumeTailor.Domain.Common;
using ResumeTailor.Domain.Entities;
using ResumeTailor.Domain.Enums;

namespace ResumeTailor.Infrastructure.Persistence;

public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<MasterResume> MasterResumes => Set<MasterResume>();
    public DbSet<ResumeVersion> ResumeVersions => Set<ResumeVersion>();
    public DbSet<GeneratedResume> GeneratedResumes => Set<GeneratedResume>();
    public DbSet<JobDescription> JobDescriptions => Set<JobDescription>();
    public DbSet<AtsAnalysis> AtsAnalyses => Set<AtsAnalysis>();
    public DbSet<ApplicationRecord> Applications => Set<ApplicationRecord>();
    public DbSet<PromptTemplate> PromptTemplates => Set<PromptTemplate>();
    public DbSet<UsageLog> UsageLogs => Set<UsageLog>();
    public DbSet<CandidateProfile> CandidateProfiles => Set<CandidateProfile>();
    public DbSet<ScreeningQuestionMemory> ScreeningQuestionMemories => Set<ScreeningQuestionMemory>();
    public DbSet<ApplicationQueueItem> ApplicationQueueItems => Set<ApplicationQueueItem>();

    // Autonomous Job Application SaaS
    public DbSet<CareerAchievement> CareerAchievements => Set<CareerAchievement>();
    public DbSet<ApplicationAudit> ApplicationAudits => Set<ApplicationAudit>();
    public DbSet<IdempotentTransaction> IdempotentTransactions => Set<IdempotentTransaction>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CandidateProfile>(b =>
        {
            b.HasKey(c => c.Id);
            b.HasOne(c => c.User)
             .WithOne(u => u.CandidateProfile)
             .HasForeignKey<CandidateProfile>(c => c.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ScreeningQuestionMemory>(b =>
        {
            b.HasKey(s => s.Id);
            b.HasIndex(s => new { s.UserId, s.Company, s.QuestionHash });
            b.HasOne(s => s.User)
             .WithMany(u => u.ScreeningMemories)
             .HasForeignKey(s => s.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationQueueItem>(b =>
        {
            b.HasKey(q => q.Id);
            b.HasOne(q => q.User)
             .WithMany(u => u.ApplicationQueue)
             .HasForeignKey(q => q.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(q => q.GeneratedResume)
             .WithMany()
             .HasForeignKey(q => q.GeneratedResumeId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(u => u.Id);
            b.HasIndex(u => u.Email).IsUnique();
            b.Property(u => u.Email).IsRequired().HasMaxLength(256);
            b.Property(u => u.FullName).IsRequired().HasMaxLength(150);
            b.Property(u => u.CreditsBalance).HasDefaultValue(50);
        });

        modelBuilder.Entity<CareerAchievement>(b =>
        {
            b.HasKey(c => c.Id);
            b.HasIndex(c => c.UserId);
            b.HasOne(c => c.User)
             .WithMany(u => u.CareerAchievements)
             .HasForeignKey(c => c.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationAudit>(b =>
        {
            b.HasKey(a => a.Id);
            b.HasIndex(a => new { a.UserId, a.Status });
            b.HasOne(a => a.User)
             .WithMany(u => u.ApplicationAudits)
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IdempotentTransaction>(b =>
        {
            b.HasKey(t => t.IdempotencyKey);
            b.HasIndex(t => t.ApplicationId);
            b.HasOne(t => t.User)
             .WithMany(u => u.IdempotentTransactions)
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasKey(r => r.Id);
            b.HasIndex(r => r.Token).IsUnique();
            b.HasIndex(r => r.UserId);
            b.Property(r => r.Token).IsRequired().HasMaxLength(256);
            b.HasOne(r => r.User)
             .WithMany(u => u.RefreshTokens)
             .HasForeignKey(r => r.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MasterResume>(b =>
        {
            b.HasKey(r => r.Id);
            b.HasOne(r => r.User)
             .WithMany(u => u.MasterResumes)
             .HasForeignKey(r => r.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ResumeVersion>(b =>
        {
            b.HasKey(v => v.Id);
            b.HasOne(v => v.MasterResume)
             .WithMany(r => r.Versions)
             .HasForeignKey(v => v.MasterResumeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GeneratedResume>(b =>
        {
            b.HasKey(g => g.Id);
            b.HasOne(g => g.User)
             .WithMany(u => u.GeneratedResumes)
             .HasForeignKey(g => g.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(g => g.MasterResume)
             .WithMany(m => m.DerivedTailoredResumes)
             .HasForeignKey(g => g.MasterResumeId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(g => g.JobDescription)
             .WithMany()
             .HasForeignKey(g => g.JobDescriptionId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<AtsAnalysis>(b =>
        {
            b.HasKey(a => a.Id);
            b.HasOne(a => a.GeneratedResume)
             .WithOne(g => g.AtsAnalysis)
             .HasForeignKey<AtsAnalysis>(a => a.GeneratedResumeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ApplicationRecord>(b =>
        {
            b.HasKey(a => a.Id);
            b.HasOne(a => a.User)
             .WithMany(u => u.Applications)
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(a => a.GeneratedResume)
             .WithOne(g => g.ApplicationRecord)
             .HasForeignKey<ApplicationRecord>(a => a.GeneratedResumeId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PromptTemplate>(b =>
        {
            b.HasKey(p => p.Id);
            b.HasIndex(p => new { p.UserId, p.TemplateKey }).IsUnique();
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAtUtc = DateTime.UtcNow;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAtUtc = DateTime.UtcNow;
                    break;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
