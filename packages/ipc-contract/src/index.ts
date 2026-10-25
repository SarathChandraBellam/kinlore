import type { Person } from '@kinlore/core';

export const IPC = {
  archiveDefaultPath: 'kinlore:archive:defaultPath',
  archiveSelectFolder: 'kinlore:archive:selectFolder',
  archiveCreate: 'kinlore:archive:create',
  archiveOpen: 'kinlore:archive:open',
  archiveStatus: 'kinlore:archive:status',
  peopleList: 'kinlore:people:list',
  peopleSave: 'kinlore:people:save',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface ArchiveStatus {
  rootPath: string | undefined;
}

export interface KinloreApi {
  getDefaultArchivePath(): Promise<string>;
  selectArchiveFolder(): Promise<string | undefined>;
  createArchive(rootPath: string): Promise<string>;
  openArchive(rootPath: string): Promise<string>;
  archiveStatus(): Promise<ArchiveStatus>;
  listPeople(): Promise<Person[]>;
  savePerson(person: Person): Promise<Person>;
}
