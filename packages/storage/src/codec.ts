/** Transforms bytes around archive files. Identity leaves the JSON readable. */
export interface ArchiveCodec {
  readonly id: string;
  seal(plaintext: Uint8Array): Promise<Uint8Array>;
  open(stored: Uint8Array): Promise<Uint8Array>;
}

export const identityCodec: ArchiveCodec = {
  id: 'identity',
  seal: (plaintext) => Promise.resolve(plaintext),
  open: (stored) => Promise.resolve(stored),
};
