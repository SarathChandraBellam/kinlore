import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, safeStorage, session as electronSession } from 'electron';
import { DEFAULT_ARCHIVE_DIRNAME } from '@kinlore/storage';
import { ArchiveSession } from './archive-session.js';
import { isAppFrameUrl } from './ipc-guard.js';
import { handleMediaProtocol, registerMediaScheme } from './media-protocol.js';
import { registerIpc } from './register-ipc.js';
import { createSecretProtection } from './secret-protection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | undefined;

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
    width: 1220,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    backgroundColor: '#f6fbff',
    show: false,
    title: 'Kinlore',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow = window;
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = undefined;
    }
  });
  window.once('ready-to-show', () => {
    window.show();
  });

  const allowed = appUrl();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!isAppFrameUrl(url, allowed)) {
      event.preventDefault();
    }
  });
  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });

  const devServerUrl = process.env['VITE_DEV_SERVER_URL'];
  if (devServerUrl !== undefined && devServerUrl !== '') {
    void window.loadURL(devServerUrl);
    return;
  }

  void window.loadFile(path.join(__dirname, '../out/renderer/index.html'));
}

app.setName('Kinlore');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  registerMediaScheme();

  app.on('second-instance', () => {
    if (mainWindow === undefined || mainWindow.isDestroyed()) {
      if (app.isReady()) {
        createWindow();
      }
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  });

  void app.whenReady().then(async () => {
    const archiveSession = new ArchiveSession(
      path.join(app.getPath('userData'), 'secrets.json'),
      createSecretProtection(safeStorage),
    );
    try {
      await archiveSession.initializeSecretProtection();
    } catch {
      // A locked/unavailable OS key store must not block offline archives. Settings
      // retries and surfaces the safe protection error; no credential is returned.
    }
    archiveSession.allowRoot(defaultArchivePath());
    registerIpc({ session: archiveSession, appUrl, defaultArchivePath });
    handleMediaProtocol(archiveSession);
    electronSession.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(
        (permission === 'media' || permission === 'clipboard-sanitized-write') &&
          isAppFrameUrl(contents.getURL(), appUrl()),
      );
    });
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      } else if (mainWindow !== undefined && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
