import { describe, expect, it, vi } from 'vitest';
import { discoverArchive, chooseArchive, invocationMessage } from './archive-flow.js';
import type { KinloreApi, ArchiveStatus } from '@kinlore/ipc-contract';

function fixture(presence: 'missing' | 'existing' | 'incomplete' = 'existing') {
  const unopened: ArchiveStatus = { rootPath: undefined, encrypted: false, unlocked: false };
  const opened: ArchiveStatus = {
    rootPath: '/synthetic/archive',
    encrypted: true,
    unlocked: false,
  };
  const api = {
    archiveStatus: vi.fn(async () => unopened),
    getDefaultArchivePath: vi.fn(async () => '/synthetic/archive'),
    inspectArchive: vi.fn(async () => presence),
    openArchive: vi.fn(async () => opened),
  } satisfies Pick<
    KinloreApi,
    'archiveStatus' | 'getDefaultArchivePath' | 'inspectArchive' | 'openArchive'
  >;
  return { api, unopened, opened };
}
describe('Home archive discovery and choices', () => {
  it('discovers the existing default archive instead of offering destructive creation', async () => {
    const { api, opened } = fixture();
    expect(await discoverArchive(api)).toEqual(opened);
    expect(api.openArchive).toHaveBeenCalledWith('/synthetic/archive');
  });
  it('keeps the create journey for a genuinely missing archive', async () => {
    const { api, unopened } = fixture('missing');
    expect(await discoverArchive(api)).toEqual(unopened);
    expect(api.openArchive).not.toHaveBeenCalled();
    expect(await chooseArchive(api, '/synthetic/archive', 'create')).toEqual('create');
  });
  it('returns an existing-archive choice without opening or creating automatically', async () => {
    const { api } = fixture();
    expect(await chooseArchive(api, '/synthetic/archive', 'create')).toEqual('existing');
    expect(api.openArchive).not.toHaveBeenCalled();
  });
  it('reports unfinished setup without attempting to overwrite it', async () => {
    const { api } = fixture('incomplete');
    await expect(chooseArchive(api, '/synthetic/archive', 'create')).rejects.toThrow(/unfinished/i);
    await expect(discoverArchive(api)).rejects.toThrow(/unfinished/i);
  });
  it('does not replace an already open selected archive with the default', async () => {
    const { api, opened } = fixture();
    api.archiveStatus.mockResolvedValue(opened);
    expect(await discoverArchive(api)).toEqual(opened);
    expect(api.getDefaultArchivePath).not.toHaveBeenCalled();
  });
});

it('shows the useful error without Electron invocation boilerplate',()=>{expect(invocationMessage(new Error("Error invoking remote method 'kinlore:archive:create': Error: An archive already exists"))).toBe('An archive already exists');});
