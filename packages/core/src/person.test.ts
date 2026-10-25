import { describe, expect, it } from 'vitest';
import { parsePerson } from './person.js';

const valid = {
  id: 'person-ada',
  displayName: 'Ada',
  createdAt: '2026-10-25T12:00:00.000Z',
  updatedAt: '2026-10-25T12:00:00.000Z',
};

describe('parsePerson', () => {
  it('returns only known fields', () => {
    expect(
      parsePerson({
        ...valid,
        preferredLanguage: 'te',
        extra: 'drop me',
      }),
    ).toEqual({
      ...valid,
      preferredLanguage: 'te',
    });
  });

  it('rejects a non-object', () => {
    expect(() => parsePerson('ada')).toThrow(/must be an object/);
  });

  it('rejects an invalid id', () => {
    expect(() => parsePerson({ ...valid, id: '../escape' })).toThrow(/id is invalid/);
  });

  it('rejects a blank displayName', () => {
    expect(() => parsePerson({ ...valid, displayName: '  ' })).toThrow(/displayName is required/);
  });

  it('rejects an unknown preferredLanguage', () => {
    expect(() => parsePerson({ ...valid, preferredLanguage: 'fr' })).toThrow(
      /preferredLanguage is invalid/,
    );
  });
});
