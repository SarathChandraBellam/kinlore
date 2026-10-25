import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import type { Person } from '@kinlore/core';
import { IPC } from '@kinlore/ipc-contract';
import { DEFAULT_ARCHIVE_DIRNAME, LocalJsonStorage, type Archive } from '@kinlore/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storage = new LocalJsonStorage();
let archive: Archive | undefined;

function defaultArchivePath(): string {
  return path.join(app.getPath('userData'), DEFAULT_ARCHIVE_DIRNAME);
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    title: 'Kinlore',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    void window.loadURL(devServerUrl);
    return;
  }

  void window.loadFile(path.join(__dirname, '../out/renderer/index.html'));
}

function registerIpc(): void {
  ipcMain.handle(IPC.archiveDefaultPath, () => defaultArchivePath());

  ipcMain.handle(IPC.archiveSelectFolder, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose a Kinlore archive folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    const first = result.filePaths[0];
    return result.canceled || first === undefined ? undefined : first;
  });

  ipcMain.handle(IPC.archiveCreate, async (_event, rootPath: string) => {
    archive = await storage.create(rootPath);
    return archive.rootPath;
  });

  ipcMain.handle(IPC.archiveOpen, async (_event, rootPath: string) => {
    archive = await storage.open(rootPath);
    return archive.rootPath;
  });

  ipcMain.handle(IPC.archiveStatus, () => ({
    rootPath: archive?.rootPath,
  }));

  ipcMain.handle(IPC.peopleList, async () => {
    if (archive === undefined) {
      throw new Error('No archive is open');
    }
    return archive.listPeople();
  });

  ipcMain.handle(IPC.peopleSave, async (_event, person: Person) => {
    if (archive === undefined) {
      throw new Error('No archive is open');
    }
    return archive.savePerson(person);
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
