import { dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import type { OutboundPurpose } from '@kinlore/core';
import { IPC } from '@kinlore/ipc-contract';
import type { ArchiveSession } from './archive-session.js';
import { isAppFrameUrl } from './ipc-guard.js';

export function registerIpc(options: {
  session: ArchiveSession;
  appUrl: () => string;
  defaultArchivePath: () => string;
}): void {
  const { session } = options;

  function assertTrustedSender(event: IpcMainInvokeEvent): void {
    const frame = event.senderFrame;
    if (frame === null || !isAppFrameUrl(frame.url, options.appUrl())) {
      throw new Error('Blocked IPC from an untrusted frame');
    }
  }

  ipcMain.handle(IPC.archiveDefaultPath, (event) => {
    assertTrustedSender(event);
    return options.defaultArchivePath();
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
    return session.allowRoot(first);
  });

  ipcMain.handle(IPC.archiveCreate, async (event, rootPath: unknown) => {
    assertTrustedSender(event);
    if (typeof rootPath !== 'string') {
      throw new Error('Archive path is required');
    }
    return session.createArchive(rootPath);
  });

  ipcMain.handle(IPC.archiveOpen, async (event, rootPath: unknown) => {
    assertTrustedSender(event);
    if (typeof rootPath !== 'string') {
      throw new Error('Archive path is required');
    }
    return session.openArchive(rootPath);
  });

  ipcMain.handle(IPC.archiveStatus, (event) => {
    assertTrustedSender(event);
    return session.status();
  });

  ipcMain.handle(IPC.archiveEncrypt, async (event, passphrase: unknown) => {
    assertTrustedSender(event);
    if (typeof passphrase !== 'string') {
      throw new Error('Passphrase is required');
    }
    return session.enableEncryption(passphrase);
  });

  ipcMain.handle(IPC.archiveUnlock, async (event, passphrase: unknown) => {
    assertTrustedSender(event);
    if (typeof passphrase !== 'string') {
      throw new Error('Passphrase is required');
    }
    return session.unlockArchive(passphrase);
  });

  ipcMain.handle(IPC.archiveUnlockRecovery, async (event, recoveryKey: unknown) => {
    assertTrustedSender(event);
    if (typeof recoveryKey !== 'string') {
      throw new Error('Recovery key is required');
    }
    return session.unlockArchiveWithRecovery(recoveryKey);
  });

  ipcMain.handle(IPC.archiveLock, (event) => {
    assertTrustedSender(event);
    return session.lockArchive();
  });

  ipcMain.handle(IPC.peopleList, (event) => {
    assertTrustedSender(event);
    return session.listPeople();
  });

  ipcMain.handle(IPC.peopleSave, (event, person: unknown) => {
    assertTrustedSender(event);
    return session.savePerson(person);
  });

  ipcMain.handle(IPC.consentList, (event) => {
    assertTrustedSender(event);
    return session.listConsents();
  });

  ipcMain.handle(IPC.consentSave, (event, consent: unknown) => {
    assertTrustedSender(event);
    return session.saveConsent(consent);
  });

  ipcMain.handle(IPC.libraryLoad, (event) => {
    assertTrustedSender(event);
    return session.loadLibrary();
  });

  ipcMain.handle(IPC.promptsNext, (event, request: unknown) => {
    assertTrustedSender(event);
    return session.nextPrompts(request);
  });

  ipcMain.handle(IPC.captureSave, (event, input: unknown) => {
    assertTrustedSender(event);
    return session.saveCapturedAnswer(input);
  });

  ipcMain.handle(IPC.importSelect, async (event) => {
    assertTrustedSender(event);
    const result = await dialog.showOpenDialog({
      title: 'Add recordings',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Recordings and photos',
          extensions: [
            'wav',
            'mp3',
            'm4a',
            'aac',
            'ogg',
            'opus',
            'webm',
            'flac',
            'mp4',
            'mov',
            'mkv',
            'zip',
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'srt',
            'vtt',
          ],
        },
      ],
    });
    if (result.canceled) {
      return [];
    }
    return result.filePaths.map((filePath) => session.allowImport(filePath));
  });

  ipcMain.handle(IPC.importRun, (event, request: unknown) => {
    assertTrustedSender(event);
    return session.importSelected(request);
  });

  ipcMain.handle(IPC.keepsakeAttach, (event, request: unknown) => {
    assertTrustedSender(event);
    return session.attachKeepsakeMedia(request);
  });

  ipcMain.handle(IPC.storySave, (event, story: unknown) => {
    assertTrustedSender(event);
    return session.saveStory(story);
  });

  ipcMain.handle(IPC.keepsakeSave, (event, keepsake: unknown) => {
    assertTrustedSender(event);
    return session.saveKeepsake(keepsake);
  });

  ipcMain.handle(IPC.timelineSave, (event, eventValue: unknown) => {
    assertTrustedSender(event);
    return session.saveTimelineEvent(eventValue);
  });

  ipcMain.handle(IPC.recipeSave, (event, recipe: unknown) => {
    assertTrustedSender(event);
    return session.saveRecipe(recipe);
  });

  ipcMain.handle(IPC.recordingSeal, (event, request: unknown) => {
    assertTrustedSender(event);
    return session.sealRecording(request);
  });

  ipcMain.handle(IPC.ask, (event, request: unknown) => {
    assertTrustedSender(event);
    return session.ask(request);
  });

  ipcMain.handle(IPC.askFamily, (event, question: unknown) => {
    assertTrustedSender(event);
    if (typeof question !== 'string') {
      throw new Error('Question is required');
    }
    return session.askEveryone(question);
  });

  ipcMain.handle(IPC.mediaUrl, (event, relativePath: unknown) => {
    assertTrustedSender(event);
    if (typeof relativePath !== 'string') {
      return null;
    }
    return session.mediaUrl(relativePath);
  });

  ipcMain.handle(IPC.secretStatus, (event, account: unknown) => {
    assertTrustedSender(event);
    if (typeof account !== 'string') {
      throw new Error('Secret account is invalid');
    }
    return session.secretStatus(account);
  });

  ipcMain.handle(IPC.secretSave, async (event, account: unknown, secret: unknown) => {
    assertTrustedSender(event);
    if (typeof account !== 'string' || typeof secret !== 'string') {
      throw new Error('Secret is invalid');
    }
    await session.saveSecret(account, secret);
  });

  ipcMain.handle(IPC.secretDelete, async (event, account: unknown) => {
    assertTrustedSender(event);
    if (typeof account !== 'string') {
      throw new Error('Secret account is invalid');
    }
    await session.deleteSecret(account);
  });

  ipcMain.handle(IPC.outboundDisclosure, (event, purpose: unknown) => {
    assertTrustedSender(event);
    return session.showOutbound(purpose as OutboundPurpose);
  });

  ipcMain.handle(IPC.outboundRun, (event, request: unknown) => {
    assertTrustedSender(event);
    if (typeof request !== 'object' || request === null) {
      throw new Error('Outbound request was not approved');
    }
    const value = request as { purpose?: OutboundPurpose; approved?: boolean; host?: string };
    if (
      value.purpose === undefined ||
      typeof value.approved !== 'boolean' ||
      typeof value.host !== 'string'
    ) {
      throw new Error('Outbound request was not approved');
    }
    return session.runRemoteStep(value.purpose, value.approved, value.host);
  });

  ipcMain.handle(IPC.voiceDecision, (event, request: unknown) => {
    assertTrustedSender(event);
    if (typeof request !== 'object' || request === null) {
      throw new Error('Voice request is invalid');
    }
    const value = request as { personId?: unknown; enabled?: unknown };
    if (typeof value.personId !== 'string' || typeof value.enabled !== 'boolean') {
      throw new Error('Voice request is invalid');
    }
    return session.voiceDecision(value.personId, value.enabled);
  });

  ipcMain.handle(IPC.engineStatus, (event) => {
    assertTrustedSender(event);
    return session.engineStatus();
  });
}
