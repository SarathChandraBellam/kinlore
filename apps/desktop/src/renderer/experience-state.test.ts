import { describe, expect, it } from 'vitest';
import { EMPTY_TAKE, takeReducer, draftState, reviewedDraftReducer } from './experience-state.js';

describe('recording take isolation', () => {
  it('discards the previous audio and its words before a new take', () => {
    let state = takeReducer(EMPTY_TAKE, { type: 'captured', blob: new Blob(['take A']) });
    state = takeReducer(state, { type: 'words', value: 'Words from A' });
    state = takeReducer(state, { type: 'discard' });
    expect(state).toEqual(EMPTY_TAKE);
    state = takeReducer(state, { type: 'captured', blob: new Blob(['take B']) });
    expect(state.words).toBe('');
    expect(state.blob?.size).toBe(6);
  });
  it('does not present partial audio as a successful take after a recorder failure', () => {
    const failed = takeReducer(EMPTY_TAKE, { type: 'failed', message: 'Capture failed' });
    const stopped = takeReducer(failed, { type: 'captured', blob: new Blob(['partial']) });
    expect(stopped.error).toBe('Capture failed');
    expect(stopped.blob).toBeUndefined();
    expect(takeReducer(stopped, { type: 'start' })).toEqual(EMPTY_TAKE);
  });
});
describe('reviewed draft provenance', () => {
  it.each([
    { title: '', summary: '' },
    { title: '', ingredients: '', steps: '' },
    { title: '', occurredOn: '', notes: '' },
  ])('clears all applied draft fields when changing its source', (fields) => {
    const initial = draftState<Record<string, string>>(fields, 'A');
    const generated = Object.fromEntries(Object.keys(fields).map((key) => [key, `draft ${key}`]));
    let state = reviewedDraftReducer(initial, { type: 'apply', fields: generated });
    state = reviewedDraftReducer(state, { type: 'edit', patch: { title: 'Reviewed title' } });
    state = reviewedDraftReducer(state, { type: 'source', id: 'B' });
    expect(state.sourceId).toBe('B');
    expect(state.fields).toEqual(fields);
    expect(state.applied).toBe(false);
  });
  it('keeps edits with their original citation when the source does not change', () => {
    let state = draftState({ title: '', summary: '' }, 'A');
    state = reviewedDraftReducer(state, {
      type: 'apply',
      fields: { title: 'Draft', summary: 'Summary' },
    });
    state = reviewedDraftReducer(state, { type: 'edit', patch: { title: 'Reviewed' } });
    state = reviewedDraftReducer(state, { type: 'source', id: 'A' });
    expect(state).toMatchObject({
      sourceId: 'A',
      applied: true,
      fields: { title: 'Reviewed', summary: 'Summary' },
    });
  });
});
