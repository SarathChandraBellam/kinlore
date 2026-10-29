import { describe, expect, it, vi } from 'vitest';
import { createSecretProtection } from './secret-protection.js';

describe('OS secret protection', () => {
  it.each([false, true])('refuses an unavailable or basic_text Linux backend (%s)', (available) => {
    const storage = {
      isEncryptionAvailable: () => available,
      getSelectedStorageBackend: () => 'basic_text',
      encryptString: vi.fn(),
      decryptString: vi.fn(),
    };
    const protection = createSecretProtection(storage, 'linux');
    expect(() => protection.encrypt('synthetic')).toThrow(/unavailable/);
    expect(() => protection.decrypt('synthetic')).toThrow(/unavailable/);
    expect(storage.encryptString).not.toHaveBeenCalled();
    expect(storage.decryptString).not.toHaveBeenCalled();
  });
  it('uses OS encryption and a base64 envelope without exposing a raw key', () => {
    const storage = {
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'keychain',
      encryptString: vi.fn(() => Buffer.from('synthetic-ciphertext')),
      decryptString: vi.fn(() => 'synthetic-plaintext'),
    };
    const protection = createSecretProtection(storage, 'darwin');
    const encrypted = protection.encrypt('synthetic-plaintext');
    expect(encrypted).not.toContain('synthetic-plaintext');
    expect(protection.decrypt(encrypted)).toBe('synthetic-plaintext');
    expect(storage.encryptString).toHaveBeenCalledOnce();
  });
});
