import {
  parseOptionalLanguage,
  parseRequiredString,
  parseTimestamp,
  requireRecord,
  withOptional,
} from './fields.js';
import { parseEntityId } from './id.js';
import type { Person } from './model.js';

/** Runtime Person check for IPC. Returns a new object with only known fields. */
export function parsePerson(value: unknown): Person {
  const record = requireRecord(value, 'Person');
  const person: Person = {
    id: parseEntityId(record.id, 'Person id'),
    displayName: parseRequiredString(record.displayName, 'Person displayName', 200),
    createdAt: parseTimestamp(record.createdAt, 'Person createdAt'),
    updatedAt: parseTimestamp(record.updatedAt, 'Person updatedAt'),
  };
  withOptional(
    person,
    'preferredLanguage',
    parseOptionalLanguage(record.preferredLanguage, 'Person preferredLanguage'),
  );
  return person;
}
