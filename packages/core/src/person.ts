import type { Person, PreferredLanguage } from './index.js';

const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPreferredLanguage(value: string): value is PreferredLanguage {
  return value === 'en' || value === 'te' || value === 'hi' || value === 'ta';
}

/** Runtime Person check for IPC. Returns a new object with only known fields. */
export function parsePerson(value: unknown): Person {
  if (!isRecord(value)) {
    throw new Error('Person must be an object');
  }
  if (typeof value.id !== 'string' || !ENTITY_ID_PATTERN.test(value.id)) {
    throw new Error('Person id is invalid');
  }
  if (typeof value.displayName !== 'string' || value.displayName.trim() === '') {
    throw new Error('Person displayName is required');
  }
  if (typeof value.createdAt !== 'string' || value.createdAt === '') {
    throw new Error('Person createdAt is required');
  }
  if (typeof value.updatedAt !== 'string' || value.updatedAt === '') {
    throw new Error('Person updatedAt is required');
  }

  const person: Person = {
    id: value.id,
    displayName: value.displayName,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.preferredLanguage !== undefined) {
    if (
      typeof value.preferredLanguage !== 'string' ||
      !isPreferredLanguage(value.preferredLanguage)
    ) {
      throw new Error('Person preferredLanguage is invalid');
    }
    person.preferredLanguage = value.preferredLanguage;
  }

  return person;
}
