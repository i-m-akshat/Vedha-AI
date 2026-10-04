using System.Text.Json;
using ResumeTailor.Domain.Common;

namespace ResumeTailor.Domain.Entities;

public class CareerAchievement : AuditableEntity
{
    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string Content { get; set; } = string.Empty;

    // JSON serialized float[] embedding vector for pgvector / semantic search
    public string EmbeddingJson { get; set; } = "[]";

    public float[] GetEmbedding()
    {
        if (string.IsNullOrWhiteSpace(EmbeddingJson)) return Array.Empty<float>();
        try
        {
            return JsonSerializer.Deserialize<float[]>(EmbeddingJson) ?? Array.Empty<float>();
        }
        catch
        {
            return Array.Empty<float>();
        }
    }

    public void SetEmbedding(float[] embedding)
    {
        EmbeddingJson = JsonSerializer.Serialize(embedding);
    }
}
