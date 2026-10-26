import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type KinloreApi } from '@kinlore/ipc-contract';

const api: KinloreApi = {
  getDefaultArchivePath: () => ipcRenderer.invoke(IPC.archiveDefaultPath),
  selectArchiveFolder: () => ipcRenderer.invoke(IPC.archiveSelectFolder),
  createArchive: (rootPath) => ipcRenderer.invoke(IPC.archiveCreate, rootPath),
  openArchive: (rootPath) => ipcRenderer.invoke(IPC.archiveOpen, rootPath),
  archiveStatus: () => ipcRenderer.invoke(IPC.archiveStatus),
  enableEncryption: (passphrase) => ipcRenderer.invoke(IPC.archiveEncrypt, passphrase),
  unlockArchive: (passphrase) => ipcRenderer.invoke(IPC.archiveUnlock, passphrase),
  unlockArchiveWithRecovery: (recoveryKey) =>
    ipcRenderer.invoke(IPC.archiveUnlockRecovery, recoveryKey),
  lockArchive: () => ipcRenderer.invoke(IPC.archiveLock),
  listPeople: () => ipcRenderer.invoke(IPC.peopleList),
  savePerson: (person) => ipcRenderer.invoke(IPC.peopleSave, person),
  listConsents: () => ipcRenderer.invoke(IPC.consentList),
  saveConsent: (consent) => ipcRenderer.invoke(IPC.consentSave, consent),
  loadLibrary: () => ipcRenderer.invoke(IPC.libraryLoad),
  nextPrompts: (request) => ipcRenderer.invoke(IPC.promptsNext, request),
  saveCapturedAnswer: (input) => ipcRenderer.invoke(IPC.captureSave, input),
  selectImports: () => ipcRenderer.invoke(IPC.importSelect),
  importSelected: (request) => ipcRenderer.invoke(IPC.importRun, request),
  attachKeepsakeMedia: (request) => ipcRenderer.invoke(IPC.keepsakeAttach, request),
  saveStory: (story) => ipcRenderer.invoke(IPC.storySave, story),
  saveKeepsake: (keepsake) => ipcRenderer.invoke(IPC.keepsakeSave, keepsake),
  saveTimelineEvent: (event) => ipcRenderer.invoke(IPC.timelineSave, event),
  saveRecipe: (recipe) => ipcRenderer.invoke(IPC.recipeSave, recipe),
  sealRecording: (request) => ipcRenderer.invoke(IPC.recordingSeal, request),
  ask: (request) => ipcRenderer.invoke(IPC.ask, request),
  askFamily: (question) => ipcRenderer.invoke(IPC.askFamily, question),
  mediaUrl: (relativePath) => ipcRenderer.invoke(IPC.mediaUrl, relativePath),
  secretStatus: (account) => ipcRenderer.invoke(IPC.secretStatus, account),
  saveSecret: (account, secret) => ipcRenderer.invoke(IPC.secretSave, account, secret),
  deleteSecret: (account) => ipcRenderer.invoke(IPC.secretDelete, account),
  showOutbound: (purpose) => ipcRenderer.invoke(IPC.outboundDisclosure, purpose),
  runRemoteStep: (request) => ipcRenderer.invoke(IPC.outboundRun, request),
  voiceDecision: (request) => ipcRenderer.invoke(IPC.voiceDecision, request),
  engineStatus: () => ipcRenderer.invoke(IPC.engineStatus),
};

contextBridge.exposeInMainWorld('kinlore', api);
