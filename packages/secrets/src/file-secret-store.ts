import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ACCOUNT = /^[a-z][a-z0-9._-]{0,63}$/;

interface SecretFile {
  accounts: Record<string, string>;
}

function assertAccount(account: string): void {
  if (!ACCOUNT.test(account)) {
    throw new Error('Secret account is invalid');
  }
}

async function readAccounts(filePath: string): Promise<Record<string, string>> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || !('accounts' in parsed)) {
      throw new Error('Secret file is invalid');
    }
    const accounts = (parsed as SecretFile).accounts;
    if (typeof accounts !== 'object' || accounts === null) {
      throw new Error('Secret file is invalid');
    }
    const clean: Record<string, string> = {};
    for (const [account, secret] of Object.entries(accounts)) {
      if (ACCOUNT.test(account) && typeof secret === 'string') {
        clean[account] = secret;
      }
    }
    return clean;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

/**
 * Stores API keys outside the archive. This is a local secret file, not the
 * operating-system keychain. The file mode is owner-read/write on Unix.
 */
export class FileSecretStore {
  constructor(private readonly filePath: string) {}

  async set(account: string, secret: string): Promise<void> {
    assertAccount(account);
    if (secret.trim() === '' || secret.length > 4096) {
      throw new Error('Secret is invalid');
    }
    const accounts = await readAccounts(this.filePath);
    accounts[account] = secret;
    await this.write(accounts);
  }

  async get(account: string): Promise<string | undefined> {
    assertAccount(account);
    const accounts = await readAccounts(this.filePath);
    return accounts[account];
  }

  async has(account: string): Promise<boolean> {
    const secret = await this.get(account);
    return secret !== undefined && secret !== '';
  }

  async delete(account: string): Promise<void> {
    assertAccount(account);
    const accounts = await readAccounts(this.filePath);
    delete accounts[account];
    await this.write(accounts);
  }

  private async write(accounts: Record<string, string>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify({ accounts }, null, 2)}\n`, { mode: 0o600 });
    await chmod(tmpPath, 0o600);
    try {
      await rename(tmpPath, this.filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST' && code !== 'EPERM' && code !== 'EACCES') {
        throw error;
      }
      await rm(this.filePath, { force: true });
      await rename(tmpPath, this.filePath);
    }
    await chmod(this.filePath, 0o600);
  }
}
