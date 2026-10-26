import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, session as electronSession } from 'electron';
import { DEFAULT_ARCHIVE_DIRNAME } from '@kinlore/storage';
import { ArchiveSession } from './archive-session.js';
import { isAppFrameUrl } from './ipc-guard.js';
import { handleMediaProtocol, registerMediaScheme } from './media-protocol.js';
import { registerIpc } from './register-ipc.js';

registerMediaScheme();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 780,
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

app.setName('Kinlore');

void app.whenReady().then(() => {
  const archiveSession = new ArchiveSession(path.join(app.getPath('userData'), 'secrets.json'));
  archiveSession.allowRoot(defaultArchivePath());
  registerIpc({ session: archiveSession, appUrl, defaultArchivePath });
  handleMediaProtocol(archiveSession);
  electronSession.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(permission === 'media');
  });
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
