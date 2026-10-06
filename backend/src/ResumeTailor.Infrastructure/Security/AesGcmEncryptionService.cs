using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using ResumeTailor.Application.Common.Interfaces;

namespace ResumeTailor.Infrastructure.Security;

public class AesGcmEncryptionService : IEncryptionService
{
    private readonly byte[] _key;
    private const int NonceSize = 12; // 96 bits for AES-GCM
    private const int TagSize = 16;   // 128 bits for AES-GCM

    public AesGcmEncryptionService(IConfiguration configuration)
    {
        var configuredKey = configuration["SecuritySettings:DataProtectionKey"];
        if (string.IsNullOrWhiteSpace(configuredKey))
            configuredKey = configuration["JwtSettings:Secret"];
        if (string.IsNullOrWhiteSpace(configuredKey))
            configuredKey = "VedhaAi_Enterprise_Default_AES256_Master_Key_Secret_Must_Be_32Bytes!";

        // Derive deterministic 32-byte (256-bit) key using SHA256
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(configuredKey));
    }

    public string Encrypt(string? plainText)
    {
        if (string.IsNullOrEmpty(plainText))
            return string.Empty;

        var plainBytes = Encoding.UTF8.GetBytes(plainText);
        var nonce = new byte[NonceSize];
        RandomNumberGenerator.Fill(nonce);

        var cipherBytes = new byte[plainBytes.Length];
        var tag = new byte[TagSize];

        using (var aesGcm = new AesGcm(_key, TagSize))
        {
            aesGcm.Encrypt(nonce, plainBytes, cipherBytes, tag);
        }

        // Payload format: [Nonce (12B)][Tag (16B)][Ciphertext (NB)]
        var combined = new byte[NonceSize + TagSize + cipherBytes.Length];
        Buffer.BlockCopy(nonce, 0, combined, 0, NonceSize);
        Buffer.BlockCopy(tag, 0, combined, NonceSize, TagSize);
        Buffer.BlockCopy(cipherBytes, 0, combined, NonceSize + TagSize, cipherBytes.Length);

        return Convert.ToBase64String(combined);
    }

    public string? Decrypt(string? cipherText)
    {
        if (string.IsNullOrWhiteSpace(cipherText))
            return null;

        try
        {
            var combined = Convert.FromBase64String(cipherText);
            if (combined.Length < NonceSize + TagSize)
                return cipherText; // Fallback to plaintext if not in encrypted format

            var nonce = new byte[NonceSize];
            var tag = new byte[TagSize];
            var cipherBytesLength = combined.Length - NonceSize - TagSize;
            var cipherBytes = new byte[cipherBytesLength];
            var plainBytes = new byte[cipherBytesLength];

            Buffer.BlockCopy(combined, 0, nonce, 0, NonceSize);
            Buffer.BlockCopy(combined, NonceSize, tag, 0, TagSize);
            Buffer.BlockCopy(combined, NonceSize + TagSize, cipherBytes, 0, cipherBytesLength);

            using (var aesGcm = new AesGcm(_key, TagSize))
            {
                aesGcm.Decrypt(nonce, cipherBytes, tag, plainBytes);
            }

            return Encoding.UTF8.GetString(plainBytes);
        }
        catch
        {
            // If decryption fails (e.g. legacy unencrypted legacy data), return raw or null
            return cipherText;
        }
    }

    public string Mask(string? secret)
    {
        if (string.IsNullOrWhiteSpace(secret))
            return string.Empty;

        var decrypted = Decrypt(secret) ?? secret;
        if (decrypted.Length <= 6)
            return "••••••••";

        var prefix = decrypted.Length > 10 ? decrypted[..3] : "";
        var suffix = decrypted[^4..];
        return $"{prefix}••••••••{suffix}";
    }
}
