import type { ArchiveStatus, KinloreApi } from '@kinlore/ipc-contract';

type ArchiveAccess = Pick<
  KinloreApi,
  'archiveStatus' | 'getDefaultArchivePath' | 'inspectArchive' | 'openArchive'
>;
const unfinished =
  'This folder has an unfinished archive. Choose a different empty folder or restore your backup.';
export async function discoverArchive(api: ArchiveAccess): Promise<ArchiveStatus> {
  const current = await api.archiveStatus();
  if (current.rootPath !== undefined) return current;
  const root = await api.getDefaultArchivePath();
  const presence = await api.inspectArchive(root);
  if (presence === 'incomplete') throw new Error(unfinished);
  return presence === 'existing' ? api.openArchive(root) : current;
}
export async function chooseArchive(
  api: Pick<KinloreApi, 'inspectArchive'>,
  root: string,
  action: 'create' | 'open',
): Promise<'create' | 'existing' | 'open'> {
  const presence = await api.inspectArchive(root);
  if (presence === 'incomplete') throw new Error(unfinished);
  if (presence === 'existing') return action === 'create' ? 'existing' : 'open';
  if (action === 'open')
    throw new Error(
      'No archive was found in that folder. Choose the archive folder or create a new one.',
    );
  return 'create';
}
export function invocationMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : 'Something went wrong';
  return text.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '');
}
