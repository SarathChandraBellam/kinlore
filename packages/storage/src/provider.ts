import type {
  Consent,
  Interview,
  Keepsake,
  Person,
  Recipe,
  Recording,
  Story,
  TimelineEvent,
  Transcript,
} from '@kinlore/core';

export interface ArchiveManifest {
  format: 'kinlore-archive';
  version: number;
  createdAt: string;
  updatedAt: string;
  encrypted?: boolean;
}

export interface Archive {
  readonly rootPath: string;
  getManifest(): Promise<ArchiveManifest>;
  listPeople(): Promise<Person[]>;
  getPerson(id: string): Promise<Person | undefined>;
  savePerson(person: Person): Promise<Person>;
  listRecordings(): Promise<Recording[]>;
  saveRecording(recording: Recording): Promise<Recording>;
  listStories(): Promise<Story[]>;
  saveStory(story: Story): Promise<Story>;
  listKeepsakes(): Promise<Keepsake[]>;
  saveKeepsake(keepsake: Keepsake): Promise<Keepsake>;
  listConsents(): Promise<Consent[]>;
  saveConsent(consent: Consent): Promise<Consent>;
  listTranscripts(): Promise<Transcript[]>;
  saveTranscript(transcript: Transcript): Promise<Transcript>;
  listInterviews(): Promise<Interview[]>;
  saveInterview(interview: Interview): Promise<Interview>;
  listTimeline(): Promise<TimelineEvent[]>;
  saveTimelineEvent(event: TimelineEvent): Promise<TimelineEvent>;
  listRecipes(): Promise<Recipe[]>;
  saveRecipe(recipe: Recipe): Promise<Recipe>;
  writeMedia(relativePath: string, data: Uint8Array): Promise<void>;
  readMedia(relativePath: string): Promise<Uint8Array>;
}

export interface StorageProvider {
  create(rootPath: string): Promise<Archive>;
  open(rootPath: string): Promise<Archive>;
}
