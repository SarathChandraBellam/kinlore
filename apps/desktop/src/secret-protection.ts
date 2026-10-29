import type { SecretProtection } from '@kinlore/secrets';

interface SafeStorage {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend(): string;
  encryptString(plaintext: string): Buffer;
  decryptString(ciphertext: Buffer): string;
}

/** Never fall back to Electron's unprotected Linux basic_text backend. */
export function createSecretProtection(
  storage: SafeStorage,
  platform = process.platform,
): SecretProtection {
  function assertAvailable(): void {
    if (
      !storage.isEncryptionAvailable() ||
      (platform === 'linux' && storage.getSelectedStorageBackend() === 'basic_text')
    ) {
      throw new Error('OS encryption is unavailable for saved keys');
    }
  }
  return {
    encrypt(plaintext) {
      assertAvailable();
      return storage.encryptString(plaintext).toString('base64');
    },
    decrypt(ciphertext) {
      assertAvailable();
      return storage.decryptString(Buffer.from(ciphertext, 'base64'));
    },
  };
}
