import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ACCOUNT = /^[a-z][a-z0-9._-]{0,63}$/;

/** Supplied by Electron main; the portable package has no Electron dependency. */
export interface SecretProtection {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

function assertAccount(account: string): void {
  if (!ACCOUNT.test(account)) throw new Error('Secret account is invalid');
}

function parseAccounts(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || !('accounts' in value))
    throw new Error('Secret file is invalid');
  const accounts = value.accounts;
  if (typeof accounts !== 'object' || accounts === null || Array.isArray(accounts))
    throw new Error('Secret file is invalid');
  const clean: Record<string, string> = {};
  for (const [account, secret] of Object.entries(accounts)) {
    if (ACCOUNT.test(account) && typeof secret === 'string') clean[account] = secret;
  }
  return clean;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error('Secret file is invalid');
  }
}

/**
 * Local secret file outside the archive. Electron always supplies OS protection;
 * plaintext compatibility exists only for legacy migration and portable callers.
 */
export class FileSecretStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly protection?: SecretProtection,
  ) {}

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private async read(): Promise<Record<string, string>> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      throw new Error('The local secret file could not be read');
    }
    const parsed = parseJson(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'format' in parsed &&
      parsed.format === 'kinlore-protected-secrets'
    ) {
      if (
        !('version' in parsed) ||
        parsed.version !== 1 ||
        !('ciphertext' in parsed) ||
        typeof parsed.ciphertext !== 'string' ||
        this.protection === undefined
      ) {
        throw new Error('OS-protected secrets are unavailable on this computer');
      }
      let plaintext: string;
      try {
        plaintext = this.protection.decrypt(parsed.ciphertext);
      } catch {
        throw new Error('OS-protected secrets could not be unlocked on this computer');
      }
      return parseAccounts(parseJson(plaintext));
    }
    const accounts = parseAccounts(parsed);
    // Migrate the old local file before returning any legacy credential.
    if (this.protection !== undefined) await this.write(accounts);
    return accounts;
  }

  migrate(): Promise<void> {
    return this.exclusive(async () => {
      await this.read();
    });
  }

  async set(account: string, secret: string): Promise<void> {
    assertAccount(account);
    if (secret.trim() === '' || secret.length > 4096) throw new Error('Secret is invalid');
    await this.exclusive(async () => {
      const accounts = await this.read();
      accounts[account] = secret;
      await this.write(accounts);
    });
  }

  async get(account: string): Promise<string | undefined> {
    assertAccount(account);
    return this.exclusive(async () => (await this.read())[account]);
  }

  async has(account: string): Promise<boolean> {
    const secret = await this.get(account);
    return secret !== undefined && secret !== '';
  }

  async delete(account: string): Promise<void> {
    assertAccount(account);
    await this.exclusive(async () => {
      const accounts = await this.read();
      delete accounts[account];
      await this.write(accounts);
    });
  }

  private async write(accounts: Record<string, string>): Promise<void> {
    const plaintext = JSON.stringify({ accounts });
    let stored = plaintext;
    if (this.protection !== undefined) {
      let ciphertext: string;
      try {
        ciphertext = this.protection.encrypt(plaintext);
      } catch {
        throw new Error('OS encryption is unavailable. Keys cannot be saved without encryption.');
      }
      stored = JSON.stringify({ format: 'kinlore-protected-secrets', version: 1, ciphertext });
    }
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, `${stored}\n`, { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    try {
      await rename(tmpPath, this.filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') throw error;
      await rm(this.filePath, { force: true });
      await rename(tmpPath, this.filePath);
    }
    await chmod(this.filePath, 0o600);
  }
}
