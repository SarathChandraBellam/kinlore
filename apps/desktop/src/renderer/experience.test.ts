import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ArchiveStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { App, Home, RecordingRow } from './App.js';
import { ArchiveSetup } from './archive-setup.js';
import { LlmAssist, SourcePicker } from './assistance-ui.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { MediaPlayer } from './components/MediaPlayer.js';
import { translate } from './i18n.js';
import { FamilyPage } from './pages/FamilyPage.js';
import { MemoriesPage, TimelineView } from './pages/MemoriesPage.js';
import { RecordPage } from './pages/RecordPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { ClipCard, RecordingSelect } from './pages/shared.js';
import { UX_COPY } from './ux-copy.js';

const empty: LibrarySnapshot = {
  people: [],
  consents: [],
  recordings: [],
  transcripts: [],
  interviews: [],
  stories: [],
  keepsakes: [],
  timeline: [],
  recipes: [],
};
const archive: ArchiveStatus = { rootPath: '/example/archive', encrypted: true, unlocked: true };
const stamp = '2026-10-29T00:00:00.000Z';
const recording = {
  id: 'voice',
  title: 'A childhood home',
  personIds: ['ada'],
  mediaRelativePath: 'recordings/media/voice.webm',
  createdAt: stamp,
  updatedAt: stamp,
};
const library: LibrarySnapshot = {
  ...empty,
  people: [{ id: 'ada', displayName: 'Ada', createdAt: stamp, updatedAt: stamp }],
  recordings: [recording],
  transcripts: [
    {
      id: 'words',
      recordingId: 'voice',
      source: 'typed',
      segments: [
        { id: 'line', startMs: 0, endMs: 1000, text: 'A private story about the old house.' },
      ],
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
};
const t = (key: Parameters<typeof translate>[1]) => translate('en', key);

describe('family experience rendering', () => {
  // TC1 / AC1: initial markup works without a network or Electron bridge.
  it('offers five primary destinations and a clear first action', () => {
    const html = renderToStaticMarkup(createElement(App));
    const primary = html.split('<nav aria-label="Primary">')[1]?.split('</nav>')[0] ?? '';
    expect(primary.match(/<button/g)).toHaveLength(5);
    expect(html).toContain('Start your family archive');
    expect(html).toContain('Open an existing archive');
    expect(html).not.toContain('/example/archive');
  });

  it('guides an empty family toward a person and a consented family toward recording', () => {
    const props = { t, archive, library: empty, onNavigate: () => {}, onArchive: () => {} };
    expect(renderToStaticMarkup(createElement(Home, props))).toContain('Add person');
    const consented = {
      ...library,
      consents: [
        {
          id: 'consent',
          personId: 'ada',
          scope: 'recording' as const,
          granted: true,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    };
    expect(renderToStaticMarkup(createElement(Home, { ...props, library: consented }))).toContain(
      'Record a story',
    );
  });

  it('renders inline unlock controls on Home for a locked encrypted archive', () => {
    const lockedArchive: ArchiveStatus = {
      rootPath: '/synthetic/locked-archive',
      encrypted: true,
      unlocked: false,
    };
    const html = renderToStaticMarkup(
      createElement(Home, {
        t,
        archive: lockedArchive,
        library: empty,
        onNavigate: () => {},
        onArchive: () => {},
      }),
    );
    expect(html).toContain('Unlock your family archive');
    expect(html).toContain('id="home-passphrase"');
    expect(html).toContain('Use a recovery key instead');
    expect(html).toContain('Choose another folder');
  });

  // TC13 / AC6: never show sealed transcript content, including invalid seals.
  it.each(['2099-01-01T00:00:00.000Z', 'invalid'])(
    'hides sealed words and playback for %s',
    (sealedUntil) => {
      const html = renderToStaticMarkup(
        createElement(RecordingRow, { recording: { ...recording, sealedUntil }, library }),
      );
      expect(html).not.toContain('A private story');
      expect(html).not.toContain('<audio');
      expect(html).not.toContain('<video');
    },
  );

  it('keeps attested unsealed words readable', () => {
    expect(renderToStaticMarkup(createElement(RecordingRow, { recording, library }))).toContain(
      'A private story about the old house.',
    );
  });

  it('offers only unsealed transcripts as sources with nothing automatically checked', () => {
    const html = renderToStaticMarkup(
      createElement(SourcePicker, {
        library: {
          ...library,
          recordings: [
            recording,
            {
              ...recording,
              id: 'sealed',
              title: 'Hidden',
              sealedUntil: '2099-01-01T00:00:00.000Z',
            },
          ],
        },
        value: [],
        onChange: () => {},
        t,
      }),
    );
    expect(html).toContain('A childhood home');
    expect(html).not.toContain('Hidden');
    expect(html).not.toContain('checked=""');
  });

  it('starts optional assistance at review with no send or applied result', () => {
    const html = renderToStaticMarkup(
      createElement(LlmAssist, {
        request: { task: 'interview', language: 'en' },
        library: empty,
        t,
        onResult: () => {},
      }),
    );
    expect(html).toContain('Review an AI request');
    expect(html).not.toContain('Send this text');
    expect(html).not.toContain('Draft applied');
  });

  it('renders video elements for video extensions and audio elements for audio extensions', () => {
    for (const ext of ['.mp4', '.mov', '.mkv', '.MP4']) {
      const html = renderToStaticMarkup(
        createElement(MediaPlayer, {
          src: `kinlore://media/recordings/media/clip${ext}`,
          mediaRelativePath: `recordings/media/clip${ext}`,
          title: 'Family video',
        }),
      );
      expect(html).toContain('<video');
      expect(html).toContain('controls=""');
      expect(html).not.toContain('<audio');
    }

    for (const ext of ['.webm', '.mp3', '.wav', '.ogg', '.m4a']) {
      const html = renderToStaticMarkup(
        createElement(MediaPlayer, {
          src: `kinlore://media/recordings/media/clip${ext}`,
          mediaRelativePath: `recordings/media/clip${ext}`,
          title: 'Family audio',
        }),
      );
      expect(html).toContain('<audio');
      expect(html).toContain('controls=""');
      expect(html).not.toContain('<video');
    }
  });

  it('renders ErrorBoundary recovery UI when a child error occurs', () => {
    const errorState = ErrorBoundary.getDerivedStateFromError(new Error('Synthetic failure'));
    expect(errorState).toEqual({ hasError: true });

    const boundary = new ErrorBoundary({
      title: t('errorBoundaryTitle'),
      body: t('errorBoundaryBody'),
      reloadLabel: t('reloadApp'),
      children: createElement('div', null, 'healthy'),
    });
    boundary.state = errorState;
    const html = renderToStaticMarkup(boundary.render() as ReactElement);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Something unexpected happened');
    expect(html).toContain('Reload view');
    expect(html).not.toContain('Synthetic failure');
  });

  it('renders ConfirmDialog markup when open and nothing when closed', () => {
    const closedHtml = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: false,
        title: 'Start over',
        message: 'Leave this recording?',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(closedHtml).toBe('');

    const openHtml = renderToStaticMarkup(
      createElement(ConfirmDialog, {
        open: true,
        title: 'Start over',
        message: 'Leave this recording? Unsaved audio will be lost.',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        tone: 'danger',
        onConfirm: () => {},
        onCancel: () => {},
      }),
    );
    expect(openHtml).toContain('<dialog');
    expect(openHtml).toContain('Leave this recording? Unsaved audio will be lost.');
    expect(openHtml).toContain('Confirm');
    expect(openHtml).toContain('Cancel');
  });

  it('renders Timeline event notes, cited recordings, and sorts chronologically', () => {
    const timelineLibrary: LibrarySnapshot = {
      ...library,
      timeline: [
        {
          id: 'undated',
          title: 'Undated family gathering',
          personIds: ['ada'],
          recordingIds: [],
          notes: 'Remembered without an exact year.',
          createdAt: '2026-10-30T00:00:00.000Z',
          updatedAt: stamp,
        },
        {
          id: 'older',
          title: 'First monsoon in Vijayawada',
          occurredOn: '1985-07-12',
          personIds: ['ada'],
          recordingIds: ['voice'],
          notes: 'Rain poured onto the courtyard tiles.',
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: 'newer',
          title: 'Wedding anniversary',
          occurredOn: '2004-11-20',
          personIds: ['ada'],
          recordingIds: ['voice'],
          notes: 'Neighbors gathered in the veranda.',
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(TimelineView, {
        library: timelineLibrary,
        language: 'en',
        t,
        run: async () => {},
      }),
    );
    expect(html).toContain('Rain poured onto the courtyard tiles.');
    expect(html).toContain('Neighbors gathered in the veranda.');
    expect(html).toContain('Remembered without an exact year.');
    expect(html).toContain('A childhood home');
    expect(html).toContain('for="occurredOn">Date</label>');
    expect(html).not.toContain('Open on');

    const newerIndex = html.indexOf('Wedding anniversary');
    const olderIndex = html.indexOf('First monsoon in Vijayawada');
    const undatedIndex = html.indexOf('Undated family gathering');
    expect(newerIndex).toBeGreaterThan(-1);
    expect(olderIndex).toBeGreaterThan(newerIndex);
    expect(undatedIndex).toBeGreaterThan(olderIndex);
  });

  it('excludes sealed recordings from RecordingSelect by default and includes them when includeSealed is true', () => {
    const libraryWithSealed: LibrarySnapshot = {
      ...library,
      recordings: [
        recording,
        {
          ...recording,
          id: 'sealed-rec',
          title: 'Future letter',
          sealedUntil: '2099-01-01T00:00:00.000Z',
        },
      ],
    };

    const defaultHtml = renderToStaticMarkup(
      createElement(RecordingSelect, {
        library: libraryWithSealed,
        t,
        id: 'source-select',
        value: '',
        onChange: () => {},
      }),
    );
    expect(defaultHtml).toContain('A childhood home');
    expect(defaultHtml).not.toContain('Future letter');

    const includeSealedHtml = renderToStaticMarkup(
      createElement(RecordingSelect, {
        library: libraryWithSealed,
        t,
        id: 'seal-select',
        value: '',
        onChange: () => {},
        includeSealed: true,
      }),
    );
    expect(includeSealedHtml).toContain('A childhood home');
    expect(includeSealedHtml).toContain('Future letter');
  });

  it('hides clip text and media in ClipCard when the underlying recording is sealed', () => {
    const clip = {
      recordingId: 'voice',
      segmentId: 'line',
      startMs: 0,
      endMs: 1000,
      text: 'A private story about the old house.',
      speakerName: 'Ada',
      question: 'Where did you grow up?',
    };

    const unsealedHtml = renderToStaticMarkup(createElement(ClipCard, { library, clip }));
    expect(unsealedHtml).toContain('A private story about the old house.');
    expect(unsealedHtml).toContain('Where did you grow up?');

    const sealedLibrary: LibrarySnapshot = {
      ...library,
      recordings: [{ ...recording, sealedUntil: '2099-01-01T00:00:00.000Z' }],
    };
    const sealedHtml = renderToStaticMarkup(
      createElement(ClipCard, { library: sealedLibrary, clip }),
    );
    expect(sealedHtml).not.toContain('A private story about the old house.');
    expect(sealedHtml).not.toContain('Where did you grow up?');
    expect(sealedHtml).not.toContain('<audio');
    expect(sealedHtml).not.toContain('<video');
  });

  it('renders FamilyPage consent switches, RecordPage 3-step stepper, MemoriesPage tabs, and SettingsPage cards', () => {
    const consentedLibrary: LibrarySnapshot = {
      ...library,
      consents: [
        {
          id: 'consent-rec',
          personId: 'ada',
          scope: 'recording',
          granted: true,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
      keepsakes: [
        {
          id: 'keep-1',
          title: 'Brass lamp',
          personIds: ['ada'],
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    };

    const familyHtml = renderToStaticMarkup(
      createElement(FamilyPage, {
        section: 'people',
        library: consentedLibrary,
        language: 'en',
        t,
        run: async () => {},
        onNavigate: () => {},
      }),
    );
    expect(familyHtml).toContain('role="switch"');
    expect(familyHtml).toContain('Preferred language');
    expect(familyHtml).toContain('May share selected words and interview context');

    const recordHtml = renderToStaticMarkup(
      createElement(RecordPage, {
        library: consentedLibrary,
        language: 'en',
        t,
        run: async () => {},
        onDirtyChange: () => {},
        onMemories: () => {},
      }),
    );
    expect(recordHtml).toContain('Get comfortable');
    expect(recordHtml).toContain('Tell the story');
    expect(recordHtml).toContain('Listen &amp; keep');

    const keepsakesHtml = renderToStaticMarkup(
      createElement(MemoriesPage, {
        section: 'keepsakes',
        library: consentedLibrary,
        language: 'en',
        t,
        run: async () => {},
        onNavigate: () => {},
      }),
    );
    expect(keepsakesHtml).toContain('Attach photo…');
    expect(keepsakesHtml).not.toContain('Add recordings…');

    const settingsHtml = renderToStaticMarkup(
      createElement(SettingsPage, {
        archive,
        library: consentedLibrary,
        t,
        run: async () => {},
        onArchive: () => {},
      }),
    );
    expect(settingsHtml).toContain('Archive location');
    expect(settingsHtml).toContain('Encryption &amp; access');
    expect(settingsHtml).toContain('OpenRouter');
    expect(settingsHtml).toContain('Local engines &amp; privacy');

    const setupHtml = renderToStaticMarkup(
      createElement(ArchiveSetup, {
        t,
        onCreate: async () => ({
          status: archive,
          recoveryKey: 'synthetic-key',
        }),
        onClose: () => {},
      }),
    );
    expect(setupHtml).toContain('id="new-passphrase"');
    expect(setupHtml).toContain('Create encrypted archive');
  });

  it('has nonempty, genuinely translated copy for every key in all four languages', () => {
    for (const language of ['en', 'te', 'hi', 'ta'] as const) {
      for (const key of Object.keys(UX_COPY.en) as (keyof typeof UX_COPY.en)[]) {
        const value = translate(language, key);
        expect(value, `${language}.${key}`).toBeTruthy();
        if (language !== 'en') {
          expect(value, `${language}.${key} should not fall back to English`).not.toBe(
            translate('en', key),
          );
        }
      }
    }
  });
});
