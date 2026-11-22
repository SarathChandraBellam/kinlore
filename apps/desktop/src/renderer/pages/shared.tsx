import { useEffect, useState, type JSX } from 'react';
import { isRecordingSealed } from '@kinlore/core';
import type { AskClip, ConsentScope, PreferredLanguage, RecordingOrigin } from '@kinlore/core';
import type { LibrarySnapshot } from '@kinlore/ipc-contract';
import { Icon } from '../components/Icons.js';
import { MediaPlayer } from '../components/MediaPlayer.js';
import { translate, type CopyKey } from '../i18n.js';

export type Section =
  | 'home'
  | 'people'
  | 'interview'
  | 'library'
  | 'ask'
  | 'family'
  | 'stories'
  | 'keepsakes'
  | 'cookbook'
  | 'timeline'
  | 'sealed'
  | 'settings';

export type TranslateFn = (key: CopyKey) => string;
export interface RunWorkOptions {
  readonly silent?: boolean;
}
export type RunWorkFn = (work: () => Promise<void>, options?: RunWorkOptions) => Promise<void>;

export const EMPTY_LIBRARY: LibrarySnapshot = {
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

export const LANGUAGE_OPTIONS: readonly { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'te', label: 'తెలుగు' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'ta', label: 'தமிழ்' },
];

export function defaultTranslate(key: CopyKey): string {
  return translate('en', key);
}

export function stamp(): string {
  return new Date().toISOString();
}

export function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

export function consented(
  library: LibrarySnapshot,
  scope: ConsentScope,
): LibrarySnapshot['people'] {
  return library.people.filter((person) =>
    library.consents.some(
      (consent) => consent.personId === person.id && consent.scope === scope && consent.granted,
    ),
  );
}

export function derivePersonIdsFromRecording(
  library: LibrarySnapshot,
  recordingId: string,
): string[] {
  if (recordingId === '') return [];
  const recording = library.recordings.find((item) => item.id === recordingId);
  if (recording === undefined) return [];
  const validPeople = new Set(library.people.map((person) => person.id));
  return [...new Set(recording.personIds.filter((id) => validPeople.has(id)))];
}

export function personNamesForIds(
  library: LibrarySnapshot,
  personIds: readonly string[],
): string[] {
  const names: string[] = [];
  for (const id of personIds) {
    const person = library.people.find((item) => item.id === id);
    if (person !== undefined && !names.includes(person.displayName)) {
      names.push(person.displayName);
    }
  }
  return names;
}

export function recordingTitlesForIds(
  library: LibrarySnapshot,
  recordingIds: readonly string[],
): string[] {
  const titles: string[] = [];
  for (const id of recordingIds) {
    const recording = library.recordings.find((item) => item.id === id);
    if (recording !== undefined) {
      titles.push(recording.title);
    }
  }
  return titles;
}

export function formatDuration(durationMs: number | undefined): string | undefined {
  if (durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) {
    return undefined;
  }
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function localeForLanguage(language: PreferredLanguage): string {
  switch (language) {
    case 'te':
      return 'te-IN';
    case 'hi':
      return 'hi-IN';
    case 'ta':
      return 'ta-IN';
    case 'en':
      return 'en-US';
  }
}

export function formatDateTime(
  iso: string | undefined,
  language: PreferredLanguage = 'en',
  includeTime = false,
): string | undefined {
  if (iso === undefined) return undefined;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return undefined;
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(ms));
}

export function formatDayString(
  day: string | undefined,
  language: PreferredLanguage = 'en',
): string | undefined {
  if (day === undefined || day === '') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (match === null) return day;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, date));
  if (!Number.isFinite(utcDate.getTime())) return day;
  return new Intl.DateTimeFormat(localeForLanguage(language), {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(utcDate);
}

export function originCopyKey(origin: RecordingOrigin | undefined): CopyKey {
  switch (origin) {
    case 'whatsapp':
      return 'originWhatsapp';
    case 'video':
      return 'originVideo';
    case 'file':
      return 'originFile';
    case 'capture':
    case undefined:
      return 'originCapture';
  }
}

export function useMediaUrl(relativePath: string | undefined, disabled = false): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (disabled || relativePath === undefined) {
      setSrc(null);
      return;
    }
    if (typeof window === 'undefined' || window.kinlore === undefined) {
      setSrc(null);
      return;
    }
    let active = true;
    void window.kinlore
      .mediaUrl(relativePath)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [relativePath, disabled]);
  return disabled ? null : src;
}

export function RecordingSelect(props: {
  library: LibrarySnapshot;
  t: TranslateFn;
  id: string;
  value: string;
  onChange: (value: string) => void;
  includeSealed?: boolean;
}): JSX.Element {
  const now = new Date();
  const recordings = props.includeSealed
    ? props.library.recordings
    : props.library.recordings.filter((recording) => !isRecordingSealed(recording, now));

  return (
    <label className="source-label" htmlFor={props.id}>
      {props.t('sourceLabel')}
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        <option value="">—</option>
        {recordings.map((recording) => (
          <option key={recording.id} value={recording.id}>
            {recording.title}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClipCard(props: { library: LibrarySnapshot; clip: AskClip }): JSX.Element {
  const recording = props.library.recordings.find((item) => item.id === props.clip.recordingId);
  const sealed = recording !== undefined && isRecordingSealed(recording, new Date());
  const src = useMediaUrl(recording?.mediaRelativePath, recording === undefined || sealed);

  return (
    <article className="card clip-card">
      <div className="card-meta-row">
        {props.clip.speakerName !== undefined ? (
          <span className="speaker-chip">{props.clip.speakerName}</span>
        ) : null}
        {recording !== undefined ? <span className="pill-badge">{recording.title}</span> : null}
      </div>
      {!sealed && props.clip.question !== undefined ? (
        <p className="muted">{props.clip.question}</p>
      ) : null}
      {!sealed ? <blockquote>{props.clip.text}</blockquote> : null}
      {!sealed && src !== null ? (
        <MediaPlayer
          src={src}
          {...(recording === undefined ? {} : { mediaRelativePath: recording.mediaRelativePath })}
          {...(recording === undefined ? {} : { title: recording.title })}
          startMs={props.clip.startMs}
          endMs={props.clip.endMs}
        />
      ) : null}
    </article>
  );
}

export function ClipList(props: { library: LibrarySnapshot; clips: AskClip[] }): JSX.Element {
  return (
    <div className="stack">
      {props.clips.map((clip) => (
        <ClipCard key={clip.segmentId} library={props.library} clip={clip} />
      ))}
    </div>
  );
}

export function CitedRecordingsRow(props: {
  library: LibrarySnapshot;
  recordingIds: readonly string[];
  t: TranslateFn;
}): JSX.Element | null {
  const titles = recordingTitlesForIds(props.library, props.recordingIds);
  if (titles.length === 0) return null;
  return (
    <p className="cited-row">
      <Icon name="mic" size={14} />
      <span>
        {props.t('citedRecordings')}: {titles.join(', ')}
      </span>
    </p>
  );
}
