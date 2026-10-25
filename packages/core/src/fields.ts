import type { PreferredLanguage } from './model.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

export function parseRequiredString(value: unknown, label: string, max = 500): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} is required`);
  }
  const trimmed = value.trim();
  if (trimmed === '' || trimmed.length > max) {
    throw new Error(`${label} is required`);
  }
  return trimmed;
}

export function parseOptionalString(value: unknown, label: string, max = 4000): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} is invalid`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`${label} is invalid`);
  }
  return trimmed === '' ? undefined : trimmed;
}

export function parseTimestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} is required`);
  }
  return value;
}

export function parseOptionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseTimestamp(value, label);
}

export function isPreferredLanguage(value: string): value is PreferredLanguage {
  return value === 'en' || value === 'te' || value === 'hi' || value === 'ta';
}

export function parseLanguage(value: unknown, label: string): PreferredLanguage {
  if (typeof value !== 'string' || !isPreferredLanguage(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseOptionalLanguage(
  value: unknown,
  label: string,
): PreferredLanguage | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseLanguage(value, label);
}

export function parseIdList(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a list`);
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item)) {
      throw new Error(`${label}[${String(index)}] is invalid`);
    }
    return item;
  });
}

export function parseNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function parseOptionalNonNegative(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseNonNegative(value, label);
}

export function parseStringList(value: unknown, label: string, maxItems = 80): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a list`);
  }
  if (value.length > maxItems) {
    throw new Error(`${label} is too long`);
  }
  return value.map((item, index) => parseRequiredString(item, `${label}[${String(index)}]`, 500));
}

export function parseMediaRelativePath(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required`);
  }
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`${label} is invalid`);
  }
  const allowed =
    normalized.startsWith('recordings/media/') || normalized.startsWith('keepsakes/media/');
  if (!allowed) {
    throw new Error(`${label} must stay inside the archive media folders`);
  }
  return normalized;
}

export function parseOptionalMediaPath(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseMediaRelativePath(value, label);
}

const DAY = /^[0-9]{4}(?:-[0-9]{2}-[0-9]{2})?$/;

export function parseOptionalDay(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !DAY.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

export function withOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}
