import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LibrarySnapshot, ArchiveStatus } from '@kinlore/ipc-contract';
import { App, Home, RecordingRow } from './App.js';
import { LlmAssist, SourcePicker } from './assistance-ui.js';
import { translate } from './i18n.js';
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
  // TC13 / AC6: never show sealed transcript content, including invalid seals.
  it.each(['2099-01-01T00:00:00.000Z', 'invalid'])(
    'hides sealed words and playback for %s',
    (sealedUntil) => {
      const html = renderToStaticMarkup(
        createElement(RecordingRow, { recording: { ...recording, sealedUntil }, library }),
      );
      expect(html).not.toContain('A private story');
      expect(html).not.toContain('<audio');
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
  it('has nonempty copy for every new key in all four languages', () => {
    for (const language of ['en', 'te', 'hi', 'ta'] as const) {
      for (const key of Object.keys(UX_COPY.en) as (keyof typeof UX_COPY.en)[]) {
        expect(translate(language, key), `${language}.${key}`).toBeTruthy();
      }
    }
  });
});
