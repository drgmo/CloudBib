/**
 * CloudBib — Electron Main Process
 *
 * Entry point for the Electron desktop app.
 * Initializes the BrowserWindow, sets up IPC handlers,
 * and manages the application lifecycle.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { openDatabase } from '../src/db/connection';
import { LibraryService } from '../src/services/library.service';
import { CacheService } from '../src/services/cache.service';
import { registerIpcHandlers } from './ipc-handlers';
import type { IDriveService } from '../src/services/drive.service';
import type { DatabaseConnection } from '../src/db/connection';

let mainWindow: BrowserWindow | null = null;
let dbConnection: DatabaseConnection | null = null;

/**
 * Creates a stub DriveService for offline / unconnected use.
 * In production, this would be replaced with a real Google Drive implementation
 * once the user completes OAuth onboarding.
 */
function createStubDriveService(): IDriveService {
  const notConnected = () => Promise.reject(new Error('Google Drive not connected. Complete onboarding in Settings.'));
  return {
    ensureFolder: notConnected,
    uploadResumable: notConnected,
    downloadFile: notConnected,
    downloadJSON: notConnected,
    getFileMetadata: notConnected,
    createFile: notConnected,
    updateFile: notConnected,
    isOnline: () => Promise.resolve(false),
  };
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CloudBib',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeServices(): void {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'cloudbib.db');
  const cachePath = path.join(userDataPath, 'cache');

  dbConnection = openDatabase(dbPath);
  const cacheService = new CacheService(cachePath);
  const driveService = createStubDriveService();
  const currentUserId = () => 'local-user';

  const libraryService = new LibraryService(
    dbConnection.db,
    driveService,
    cacheService,
    currentUserId
  );

  registerIpcHandlers(ipcMain, libraryService, dbConnection.db);
}

app.whenReady().then(() => {
  initializeServices();
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

app.on('will-quit', () => {
  if (dbConnection) {
    dbConnection.close();
  }
});
