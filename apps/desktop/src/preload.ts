import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type KinloreApi } from '@kinlore/ipc-contract';

const api: KinloreApi = {
  getDefaultArchivePath: () => ipcRenderer.invoke(IPC.archiveDefaultPath),
  selectArchiveFolder: () => ipcRenderer.invoke(IPC.archiveSelectFolder),
  createArchive: (rootPath) => ipcRenderer.invoke(IPC.archiveCreate, rootPath),
  openArchive: (rootPath) => ipcRenderer.invoke(IPC.archiveOpen, rootPath),
  archiveStatus: () => ipcRenderer.invoke(IPC.archiveStatus),
  listPeople: () => ipcRenderer.invoke(IPC.peopleList),
  savePerson: (person) => ipcRenderer.invoke(IPC.peopleSave, person),
};

contextBridge.exposeInMainWorld('kinlore', api);
