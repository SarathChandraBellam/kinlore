import {
  isRecordingSealed,
  type AskClip,
  type AskCorpus,
  type AskResponse,
  type AskSegment,
  type FamilyAsk,
  type Person,
  type Recording,
  type Transcript,
} from '@kinlore/core';

const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'of',
  'to',
  'in',
  'on',
  'for',
  'and',
  'or',
  'was',
  'were',
  'is',
  'are',
  'what',
  'how',
  'did',
  'do',
  'does',
  'who',
  'when',
  'where',
  'your',
  'you',
  'with',
  'from',
  'that',
  'this',
  'they',
  'their',
]);

function tokens(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function score(question: string, segment: AskSegment): number {
  const wanted = tokens(question);
  if (wanted.length === 0) {
    return 0;
  }
  const haystack = new Set(tokens(`${segment.question ?? ''} ${segment.text}`));
  const hits = wanted.filter((token) => haystack.has(token)).length;
  if (hits === 0) {
    return 0;
  }
  return hits / wanted.length;
}

function toClip(segment: AskSegment, people: AskCorpus['people']): AskClip {
  const speaker = people.find((person) => person.id === segment.speakerId);
  const clip: AskClip = {
    recordingId: segment.recordingId,
    segmentId: segment.segmentId,
    startMs: segment.startMs,
    endMs: segment.endMs,
    text: segment.text,
  };
  if (segment.speakerId !== undefined) {
    clip.speakerId = segment.speakerId;
  }
  if (speaker !== undefined) {
    clip.speakerName = speaker.displayName;
  }
  if (segment.question !== undefined) {
    clip.question = segment.question;
  }
  return clip;
}

export function askQuestion(question: string, corpus: AskCorpus, personId?: string): AskResponse {
  const ranked = corpus.segments
    .filter((segment) => !segment.sealed && segment.text.trim() !== '')
    .filter((segment) => personId === undefined || segment.speakerId === personId)
    .map((segment) => ({ segment, score: score(question, segment) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (ranked.length === 0) {
    return { kind: 'unknown' };
  }
  return { kind: 'clips', clips: ranked.map((row) => toClip(row.segment, corpus.people)) };
}

export function askFamily(question: string, corpus: AskCorpus): FamilyAsk {
  const memories = corpus.people.map((person) => ({
    personId: person.id,
    displayName: person.displayName,
    response: askQuestion(question, corpus, person.id),
  }));
  const distinctVoices = memories.filter((memory) => memory.response.kind === 'clips').length;
  return { memories, distinctVoices };
}

export function buildAskCorpus(input: {
  people: readonly Person[];
  recordings: readonly Recording[];
  transcripts: readonly Transcript[];
  now: Date;
}): AskCorpus {
  const recordings = new Map(input.recordings.map((recording) => [recording.id, recording]));
  const segments: AskSegment[] = [];
  for (const transcript of input.transcripts) {
    const recording = recordings.get(transcript.recordingId);
    if (recording === undefined) {
      continue;
    }
    const sealed = isRecordingSealed(recording, input.now);
    for (const segment of transcript.segments) {
      const row: AskSegment = {
        recordingId: recording.id,
        segmentId: segment.id,
        startMs: segment.startMs,
        endMs: segment.endMs,
        text: segment.text,
        sealed,
      };
      const speakerId = segment.speakerId ?? recording.personIds[0];
      if (speakerId !== undefined) {
        row.speakerId = speakerId;
      }
      if (transcript.question !== undefined) {
        row.question = transcript.question;
      }
      segments.push(row);
    }
  }
  return {
    people: input.people.map((person) => ({ id: person.id, displayName: person.displayName })),
    segments,
  };
}
