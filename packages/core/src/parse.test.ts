import { describe, expect, it } from 'vitest';
import { parseRecipe, parseRecording, parseStory, parseTranscript } from './parse.js';

const stamps = {
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
};

describe('entity parsers', () => {
  it('drops unknown recording fields and keeps a seal', () => {
    expect(
      parseRecording({
        id: 'rec-1',
        title: 'Kitchen',
        personIds: ['ada'],
        mediaRelativePath: 'recordings/media/rec-1.webm',
        sealedUntil: '2027-01-01T00:00:00.000Z',
        occasion: 'wedding',
        extra: 'no',
        ...stamps,
      }),
    ).toEqual({
      id: 'rec-1',
      title: 'Kitchen',
      personIds: ['ada'],
      mediaRelativePath: 'recordings/media/rec-1.webm',
      sealedUntil: '2027-01-01T00:00:00.000Z',
      occasion: 'wedding',
      ...stamps,
    });
  });

  it('rejects media that leaves the archive folders', () => {
    expect(() =>
      parseRecording({
        id: 'rec-1',
        title: 'Kitchen',
        personIds: [],
        mediaRelativePath: '../secret.webm',
        ...stamps,
      }),
    ).toThrow(/invalid/);
  });

  it('requires a story to cite a recording', () => {
    expect(() =>
      parseStory({
        id: 'story-1',
        title: 'How we came',
        personIds: ['ada'],
        recordingIds: [],
        ...stamps,
      }),
    ).toThrow(/cite a recording/);
  });

  it('keeps typed words and rejects an empty transcript', () => {
    expect(
      parseTranscript({
        id: 'tr-1',
        recordingId: 'rec-1',
        source: 'typed',
        question: 'How did you celebrate Sankranti?',
        segments: [{ id: 'seg-1', startMs: 0, endMs: 1000, text: 'We made pongal.' }],
        ...stamps,
      }).segments[0]?.text,
    ).toBe('We made pongal.');
    expect(() =>
      parseTranscript({
        id: 'tr-1',
        recordingId: 'rec-1',
        source: 'typed',
        segments: [],
        ...stamps,
      }),
    ).toThrow(/words that were spoken/);
  });

  it('requires a recipe to cite a recording', () => {
    expect(() =>
      parseRecipe({
        id: 'recipe-1',
        title: 'Pongal',
        personIds: ['ada'],
        recordingIds: [],
        ingredients: ['rice'],
        steps: ['boil'],
        ...stamps,
      }),
    ).toThrow(/cite a recording/);
  });
});
