import {
  parseIdList,
  parseLanguage,
  parseMediaRelativePath,
  parseNonNegative,
  parseOptionalDay,
  parseOptionalLanguage,
  parseOptionalMediaPath,
  parseOptionalNonNegative,
  parseOptionalString,
  parseOptionalTimestamp,
  parseRequiredString,
  parseStringList,
  parseTimestamp,
  requireRecord,
  withOptional,
} from './fields.js';
import { parseEntityId } from './id.js';
import type {
  Consent,
  ConsentScope,
  Interview,
  Keepsake,
  Recipe,
  Recording,
  RecordingOrigin,
  Story,
  TimelineEvent,
  Transcript,
  TranscriptSegment,
  TranscriptSource,
} from './model.js';

function parseOrigin(value: unknown): RecordingOrigin | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === 'capture' || value === 'file' || value === 'whatsapp' || value === 'video') {
    return value;
  }
  throw new Error('Recording origin is invalid');
}

function parseScope(value: unknown): ConsentScope {
  if (
    value === 'recording' ||
    value === 'archive' ||
    value === 'export' ||
    value === 'generated-voice'
  ) {
    return value;
  }
  throw new Error('Consent scope is invalid');
}

function parseSource(value: unknown): TranscriptSource {
  if (value === 'typed' || value === 'subtitle') {
    return value;
  }
  throw new Error('Transcript source is invalid');
}

export function parseRecording(value: unknown): Recording {
  const record = requireRecord(value, 'Recording');
  const recording: Recording = {
    id: parseEntityId(record.id, 'Recording id'),
    title: parseRequiredString(record.title, 'Recording title', 200),
    personIds: parseIdList(record.personIds, 'Recording personIds'),
    mediaRelativePath: parseMediaRelativePath(record.mediaRelativePath, 'Recording media'),
    createdAt: parseTimestamp(record.createdAt, 'Recording createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Recording updatedAt'),
  };
  withOptional(
    recording,
    'recordedAt',
    parseOptionalTimestamp(record.recordedAt, 'Recording recordedAt'),
  );
  withOptional(
    recording,
    'durationMs',
    parseOptionalNonNegative(record.durationMs, 'Recording durationMs'),
  );
  withOptional(recording, 'language', parseOptionalLanguage(record.language, 'Recording language'));
  withOptional(recording, 'origin', parseOrigin(record.origin));
  withOptional(
    recording,
    'sealedUntil',
    parseOptionalTimestamp(record.sealedUntil, 'Recording sealedUntil'),
  );
  withOptional(
    recording,
    'occasion',
    parseOptionalString(record.occasion, 'Recording occasion', 200),
  );
  return recording;
}

export function parseStory(value: unknown): Story {
  const record = requireRecord(value, 'Story');
  const recordingIds = parseIdList(record.recordingIds, 'Story recordingIds');
  if (recordingIds.length === 0) {
    throw new Error('Story must cite a recording');
  }
  const story: Story = {
    id: parseEntityId(record.id, 'Story id'),
    title: parseRequiredString(record.title, 'Story title', 200),
    personIds: parseIdList(record.personIds, 'Story personIds'),
    recordingIds,
    createdAt: parseTimestamp(record.createdAt, 'Story createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Story updatedAt'),
  };
  withOptional(story, 'summary', parseOptionalString(record.summary, 'Story summary', 4000));
  return story;
}

export function parseKeepsake(value: unknown): Keepsake {
  const record = requireRecord(value, 'Keepsake');
  const keepsake: Keepsake = {
    id: parseEntityId(record.id, 'Keepsake id'),
    title: parseRequiredString(record.title, 'Keepsake title', 200),
    personIds: parseIdList(record.personIds, 'Keepsake personIds'),
    createdAt: parseTimestamp(record.createdAt, 'Keepsake createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Keepsake updatedAt'),
  };
  withOptional(
    keepsake,
    'mediaRelativePath',
    parseOptionalMediaPath(record.mediaRelativePath, 'Keepsake media'),
  );
  withOptional(keepsake, 'notes', parseOptionalString(record.notes, 'Keepsake notes', 4000));
  return keepsake;
}

export function parseConsent(value: unknown): Consent {
  const record = requireRecord(value, 'Consent');
  if (typeof record.granted !== 'boolean') {
    throw new Error('Consent granted is required');
  }
  const consent: Consent = {
    id: parseEntityId(record.id, 'Consent id'),
    personId: parseEntityId(record.personId, 'Consent personId'),
    scope: parseScope(record.scope),
    granted: record.granted,
    createdAt: parseTimestamp(record.createdAt, 'Consent createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Consent updatedAt'),
  };
  withOptional(consent, 'grantedAt', parseOptionalTimestamp(record.grantedAt, 'Consent grantedAt'));
  withOptional(consent, 'notes', parseOptionalString(record.notes, 'Consent notes', 2000));
  return consent;
}

function parseSegment(value: unknown, index: number): TranscriptSegment {
  const record = requireRecord(value, `Transcript segment ${String(index)}`);
  const text = parseRequiredString(record.text, `Transcript segment ${String(index)} text`, 8000);
  const segment: TranscriptSegment = {
    id: parseEntityId(record.id, `Transcript segment ${String(index)} id`),
    startMs: parseNonNegative(record.startMs, `Transcript segment ${String(index)} startMs`),
    endMs: parseNonNegative(record.endMs, `Transcript segment ${String(index)} endMs`),
    text,
  };
  if (record.speakerId !== undefined) {
    segment.speakerId = parseEntityId(
      record.speakerId,
      `Transcript segment ${String(index)} speakerId`,
    );
  }
  withOptional(
    segment,
    'language',
    parseOptionalLanguage(record.language, `Transcript segment ${String(index)} language`),
  );
  return segment;
}

export function parseTranscript(value: unknown): Transcript {
  const record = requireRecord(value, 'Transcript');
  if (!Array.isArray(record.segments) || record.segments.length === 0) {
    throw new Error('Transcript must include the words that were spoken');
  }
  if (record.segments.length > 5000) {
    throw new Error('Transcript is too long');
  }
  const transcript: Transcript = {
    id: parseEntityId(record.id, 'Transcript id'),
    recordingId: parseEntityId(record.recordingId, 'Transcript recordingId'),
    source: parseSource(record.source),
    segments: record.segments.map((segment, index) => parseSegment(segment, index)),
    createdAt: parseTimestamp(record.createdAt, 'Transcript createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Transcript updatedAt'),
  };
  withOptional(
    transcript,
    'question',
    parseOptionalString(record.question, 'Transcript question', 500),
  );
  if (record.promptId !== undefined) {
    transcript.promptId = parseEntityId(record.promptId, 'Transcript promptId');
  }
  return transcript;
}

export function parseInterview(value: unknown): Interview {
  const record = requireRecord(value, 'Interview');
  return {
    id: parseEntityId(record.id, 'Interview id'),
    title: parseRequiredString(record.title, 'Interview title', 200),
    personIds: parseIdList(record.personIds, 'Interview personIds'),
    language: parseLanguage(record.language, 'Interview language'),
    recordingIds: parseIdList(record.recordingIds, 'Interview recordingIds'),
    createdAt: parseTimestamp(record.createdAt, 'Interview createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Interview updatedAt'),
  };
}

export function parseTimelineEvent(value: unknown): TimelineEvent {
  const record = requireRecord(value, 'Timeline event');
  const event: TimelineEvent = {
    id: parseEntityId(record.id, 'Timeline event id'),
    title: parseRequiredString(record.title, 'Timeline event title', 200),
    personIds: parseIdList(record.personIds, 'Timeline event personIds'),
    recordingIds: parseIdList(record.recordingIds, 'Timeline event recordingIds'),
    createdAt: parseTimestamp(record.createdAt, 'Timeline event createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Timeline event updatedAt'),
  };
  withOptional(
    event,
    'occurredOn',
    parseOptionalDay(record.occurredOn, 'Timeline event occurredOn'),
  );
  withOptional(event, 'notes', parseOptionalString(record.notes, 'Timeline event notes', 4000));
  return event;
}

export function parseRecipe(value: unknown): Recipe {
  const record = requireRecord(value, 'Recipe');
  const recordingIds = parseIdList(record.recordingIds, 'Recipe recordingIds');
  if (recordingIds.length === 0) {
    throw new Error('Recipe must cite a recording');
  }
  return {
    id: parseEntityId(record.id, 'Recipe id'),
    title: parseRequiredString(record.title, 'Recipe title', 200),
    personIds: parseIdList(record.personIds, 'Recipe personIds'),
    recordingIds,
    ingredients: parseStringList(record.ingredients, 'Recipe ingredients'),
    steps: parseStringList(record.steps, 'Recipe steps'),
    createdAt: parseTimestamp(record.createdAt, 'Recipe createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Recipe updatedAt'),
  };
}
