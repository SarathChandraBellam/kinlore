/**
 * Opt-in archive encryption. The algorithm lives in `passphrase-encryption.ts`
 * and is applied through `ArchiveCodec`. `LocalJsonStorage` stays a plaintext
 * JSON archive until a caller sets that codec.
 *
 * The data key is wrapped by a passphrase and by a recovery key. Neither raw
 * key is written into the archive. OS keychain / DPAPI wrapping can replace
 * the passphrase wrap later without changing `LocalJsonStorage`.
 */
export interface EncryptionProvider {
  readonly id: string;
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}
