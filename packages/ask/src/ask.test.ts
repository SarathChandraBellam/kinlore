import { describe, expect, it } from 'vitest';
import type { Person, Recording, Transcript } from '@kinlore/core';
import { askFamily, askQuestion, buildAskCorpus } from './ask.js';

const now = new Date('2026-10-26T00:00:00.000Z');
const stamps = { createdAt: now.toISOString(), updatedAt: now.toISOString() };

const ada: Person = { id: 'ada', displayName: 'Ada', ...stamps };
const lin: Person = { id: 'lin', displayName: 'Lin', ...stamps };

function recording(id: string, personId: string, sealedUntil?: string): Recording {
  const row: Recording = {
    id,
    title: id,
    personIds: [personId],
    mediaRelativePath: `recordings/media/${id}.webm`,
    ...stamps,
  };
  if (sealedUntil !== undefined) {
    row.sealedUntil = sealedUntil;
  }
  return row;
}

function transcript(id: string, recordingId: string, text: string, question: string): Transcript {
  return {
    id,
    recordingId,
    source: 'typed',
    question,
    segments: [{ id: `${id}-seg`, startMs: 0, endMs: 1200, text }],
    ...stamps,
  };
}

describe('ask', () => {
  const corpus = buildAskCorpus({
    people: [ada, lin],
    recordings: [recording('rec-ada', 'ada'), recording('rec-lin', 'lin')],
    transcripts: [
      transcript(
        'tr-ada',
        'rec-ada',
        'We made pongal before sunrise.',
        'How did your family celebrate Sankranti?',
      ),
      transcript(
        'tr-lin',
        'rec-lin',
        'We visited the temple after lunch.',
        'How did your family celebrate Sankranti?',
      ),
    ],
    now,
  });

  it('returns the spoken words and not a new sentence', () => {
    const response = askQuestion('How did the family celebrate Sankranti?', corpus);
    expect(response.kind).toBe('clips');
    if (response.kind !== 'clips') {
      return;
    }
    const texts = new Set(corpus.segments.map((segment) => segment.text));
    for (const clip of response.clips) {
      expect(texts.has(clip.text)).toBe(true);
    }
  });

  it('says it does not know when nothing in the archive matches', () => {
    expect(askQuestion('What was the name of the school teacher?', corpus)).toEqual({
      kind: 'unknown',
    });
  });

  it('keeps each person in their own words', () => {
    const family = askFamily('Sankranti celebration', corpus);
    expect(family.distinctVoices).toBe(2);
    const adaMemory = family.memories.find((memory) => memory.personId === 'ada');
    const linMemory = family.memories.find((memory) => memory.personId === 'lin');
    expect(adaMemory?.response).toMatchObject({
      kind: 'clips',
      clips: [expect.objectContaining({ text: 'We made pongal before sunrise.' })],
    });
    expect(linMemory?.response).toMatchObject({
      kind: 'clips',
      clips: [expect.objectContaining({ text: 'We visited the temple after lunch.' })],
    });
  });

  it('does not quote a sealed recording', () => {
    const sealed = buildAskCorpus({
      people: [ada],
      recordings: [recording('rec-seal', 'ada', '2027-01-01T00:00:00.000Z')],
      transcripts: [
        transcript('tr-seal', 'rec-seal', 'Open this on your wedding day.', 'A message for later'),
      ],
      now,
    });
    expect(askQuestion('wedding day', sealed)).toEqual({ kind: 'unknown' });
  });
});
