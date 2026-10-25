export type EntityId = string;

export type IsoDateTime = string;

export type PreferredLanguage = 'en' | 'te' | 'hi' | 'ta';

export interface Person {
  id: EntityId;
  displayName: string;
  preferredLanguage?: PreferredLanguage;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Recording {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  mediaRelativePath: string;
  recordedAt?: IsoDateTime;
  durationMs?: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Story {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  recordingIds: EntityId[];
  summary?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Keepsake {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  mediaRelativePath?: string;
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export type ConsentScope = 'recording' | 'archive' | 'export' | 'generated-voice';

export interface Consent {
  id: EntityId;
  personId: EntityId;
  scope: ConsentScope;
  granted: boolean;
  grantedAt?: IsoDateTime;
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
