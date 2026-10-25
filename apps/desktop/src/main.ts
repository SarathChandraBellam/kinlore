import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { parsePerson } from '@kinlore/core';
import { IPC } from '@kinlore/ipc-contract';
import { DEFAULT_ARCHIVE_DIRNAME, LocalJsonStorage, type Archive } from '@kinlore/storage';
import { isAppFrameUrl, resolveAllowedArchivePath } from './ipc-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storage = new LocalJsonStorage();
const allowedArchiveRoots = new Set<string>();
let archive: Archive | undefined;

function defaultArchivePath(): string {
  return path.join(app.getPath('userData'), DEFAULT_ARCHIVE_DIRNAME);
}

function appUrl(): string {
  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    return devServerUrl;
  }
  return pathToFileURL(path.join(__dirname, '../out/renderer/index.html')).href;
}

function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  if (frame === null || !isAppFrameUrl(frame.url, appUrl())) {
    throw new Error('Blocked IPC from an untrusted frame');
  }
}

function allowArchiveRoot(rootPath: string): string {
  const resolved = path.resolve(rootPath);
  allowedArchiveRoots.add(resolved);
  return resolved;
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    title: 'Kinlore',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const allowed = appUrl();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppFrameUrl(url, allowed)) {
      event.preventDefault();
    }
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    void window.loadURL(devServerUrl);
    return;
  }

  void window.loadFile(path.join(__dirname, '../out/renderer/index.html'));
}

function registerIpc(): void {
  allowArchiveRoot(defaultArchivePath());

  ipcMain.handle(IPC.archiveDefaultPath, (event) => {
    assertTrustedSender(event);
    return defaultArchivePath();
  });

  ipcMain.handle(IPC.archiveSelectFolder, async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({
      title: 'Choose a Kinlore archive folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    const first = result.filePaths[0];
    if (result.canceled || first === undefined) {
      return undefined;
    }
    return allowArchiveRoot(first);
  });

  ipcMain.handle(IPC.archiveCreate, async (event, rootPath: unknown) => {
    assertTrustedSender(event);
    archive = await storage.create(resolveAllowedArchivePath(rootPath, allowedArchiveRoots));
    return archive.rootPath;
  });

  ipcMain.handle(IPC.archiveOpen, async (event, rootPath: unknown) => {
    assertTrustedSender(event);
    archive = await storage.open(resolveAllowedArchivePath(rootPath, allowedArchiveRoots));
    return archive.rootPath;
  });

  ipcMain.handle(IPC.archiveStatus, (event) => {
    assertTrustedSender(event);
    return {
      rootPath: archive?.rootPath,
    };
  });

  ipcMain.handle(IPC.peopleList, async (event) => {
    assertTrustedSender(event);
    if (archive === undefined) {
      throw new Error('No archive is open');
    }
    return archive.listPeople();
  });

  ipcMain.handle(IPC.peopleSave, async (event, person: unknown) => {
    assertTrustedSender(event);
    if (archive === undefined) {
      throw new Error('No archive is open');
    }
    return archive.savePerson(parsePerson(person));
  });
}

app.setName('Kinlore');

void app.whenReady().then(() => {
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
