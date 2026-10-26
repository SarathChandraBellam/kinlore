const ENTITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function isEntityId(value: string): boolean {
  return ENTITY_ID_PATTERN.test(value);
}

export function parseEntityId(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isEntityId(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}
