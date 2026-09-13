namespace ResumeTailor.Application.Common.Interfaces;

public interface IEncryptionService
{
    /// <summary>
    /// Encrypts plaintext using AES-256-GCM with an authenticated tag and unique nonce.
    /// Returns a combined base64-encoded string containing nonce + tag + ciphertext.
    /// </summary>
    string Encrypt(string? plainText);

    /// <summary>
    /// Decrypts a base64-encoded payload produced by Encrypt.
    /// </summary>
    string? Decrypt(string? cipherText);

    /// <summary>
    /// Masks a secret string (e.g. API key) for safe API output (e.g., "••••••••sk_1234").
    /// </summary>
    string Mask(string? secret);
}
