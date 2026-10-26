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

export type RecordingOrigin = 'capture' | 'file' | 'whatsapp' | 'video';

export interface Recording {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  mediaRelativePath: string;
  recordedAt?: IsoDateTime;
  durationMs?: number;
  language?: PreferredLanguage;
  origin?: RecordingOrigin;
  /** When this instant is still in the future, the media stays sealed. */
  sealedUntil?: IsoDateTime;
  occasion?: string;
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

export type TranscriptSource = 'typed' | 'subtitle';

export interface TranscriptSegment {
  id: EntityId;
  speakerId?: EntityId;
  startMs: number;
  endMs: number;
  text: string;
  language?: PreferredLanguage;
}

/** Words attested by a person or a subtitle file. Never model-invented speech. */
export interface Transcript {
  id: EntityId;
  recordingId: EntityId;
  source: TranscriptSource;
  segments: TranscriptSegment[];
  /** The question that was asked, when this recording answers one. */
  question?: string;
  promptId?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Interview {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  language: PreferredLanguage;
  recordingIds: EntityId[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TimelineEvent {
  id: EntityId;
  title: string;
  occurredOn?: string;
  personIds: EntityId[];
  recordingIds: EntityId[];
  notes?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** A recipe told aloud. It cites the recording; it does not invent the method. */
export interface Recipe {
  id: EntityId;
  title: string;
  personIds: EntityId[];
  recordingIds: EntityId[];
  ingredients: string[];
  steps: string[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface InterviewPrompt {
  id: string;
  language: PreferredLanguage;
  topic: string;
  text: string;
}

export interface AskSegment {
  recordingId: EntityId;
  segmentId: EntityId;
  speakerId?: EntityId;
  startMs: number;
  endMs: number;
  text: string;
  question?: string;
  sealed: boolean;
}

export interface AskClip {
  recordingId: EntityId;
  segmentId: EntityId;
  speakerId?: EntityId;
  speakerName?: string;
  startMs: number;
  endMs: number;
  /** Verbatim words from the transcript. */
  text: string;
  question?: string;
}

export type AskResponse = { kind: 'clips'; clips: AskClip[] } | { kind: 'unknown' };

export interface FamilyMemory {
  personId: EntityId;
  displayName: string;
  response: AskResponse;
}

export interface FamilyAsk {
  memories: FamilyMemory[];
  /** How many people had a real clip. Two or more are separate memories. */
  distinctVoices: number;
}

export interface AskCorpus {
  people: { id: EntityId; displayName: string }[];
  segments: AskSegment[];
}

export type VoiceDenial = 'off' | 'no-consent' | 'no-model';

export type VoiceDecision =
  { allowed: false; reason: VoiceDenial } | { allowed: true; labeled: true };

export type OutboundPurpose = 'transcribe' | 'interview';

export interface OutboundDisclosure {
  purpose: OutboundPurpose;
  /** This build does not contact a host. */
  contactedHost: null;
  wouldLeaveIfRemote: string[];
  stays: string[];
}

export interface OutboundApproval {
  approved: boolean;
  purpose: OutboundPurpose;
  host: string;
}

export interface RemoteStepResult {
  sent: false;
  message: string;
}
