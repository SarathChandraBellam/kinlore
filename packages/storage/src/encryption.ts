/**
 * TODO(encryption): implement OS-backed archive encryption.
 *
 * Planned approach (do not implement in this skeleton):
 * - Generate a per-archive data key.
 * - Wrap/unwrap that key with Windows DPAPI, macOS Keychain, or a Linux
 *   secret-service equivalent. Never persist the raw key inside KinloreArchive.
 * - Compose encryption around an existing StorageProvider rather than baking
 *   it into LocalJsonStorage, for example:
 *
 *   class EncryptedStorage implements StorageProvider {
 *     constructor(
 *       private readonly inner: StorageProvider,
 *       private readonly crypto: EncryptionProvider,
 *     ) {}
 *   }
 *
 * LocalJsonStorage stays plaintext so the archive remains open and portable
 * until a user opts into encryption.
 */
export interface EncryptionProvider {
  readonly id: string;
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}
