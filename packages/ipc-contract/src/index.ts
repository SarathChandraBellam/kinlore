import type {
  AskResponse,
  Consent,
  FamilyAsk,
  Interview,
  InterviewPrompt,
  Keepsake,
  OutboundDisclosure,
  OutboundPurpose,
  Person,
  PreferredLanguage,
  Recipe,
  Recording,
  RemoteStepResult,
  Story,
  TimelineEvent,
  Transcript,
  VoiceDecision,
} from '@kinlore/core';

export const IPC = {
  archiveDefaultPath: 'kinlore:archive:defaultPath',
  archiveSelectFolder: 'kinlore:archive:selectFolder',
  archiveCreate: 'kinlore:archive:create',
  archiveOpen: 'kinlore:archive:open',
  archiveStatus: 'kinlore:archive:status',
  archiveInspect: 'kinlore:archive:inspect',
  archiveEncrypt: 'kinlore:archive:encrypt',
  archiveUnlock: 'kinlore:archive:unlock',
  archiveUnlockRecovery: 'kinlore:archive:unlockRecovery',
  archiveLock: 'kinlore:archive:lock',
  peopleList: 'kinlore:people:list',
  peopleSave: 'kinlore:people:save',
  consentList: 'kinlore:consent:list',
  consentSave: 'kinlore:consent:save',
  libraryLoad: 'kinlore:library:load',
  promptsNext: 'kinlore:prompts:next',
  captureSave: 'kinlore:capture:save',
  importSelect: 'kinlore:import:select',
  importRun: 'kinlore:import:run',
  keepsakeAttach: 'kinlore:keepsake:attach',
  storySave: 'kinlore:story:save',
  keepsakeSave: 'kinlore:keepsake:save',
  timelineSave: 'kinlore:timeline:save',
  recipeSave: 'kinlore:recipe:save',
  recordingSeal: 'kinlore:recording:seal',
  ask: 'kinlore:ask',
  askFamily: 'kinlore:askFamily',
  mediaUrl: 'kinlore:media:url',
  secretStatus: 'kinlore:secret:status',
  secretSave: 'kinlore:secret:save',
  secretDelete: 'kinlore:secret:delete',
  outboundDisclosure: 'kinlore:outbound:disclosure',
  outboundRun: 'kinlore:outbound:run',
  voiceDecision: 'kinlore:voice:decision',
  engineStatus: 'kinlore:engine:status',
  openRouterConfig: 'kinlore:openrouter:config',
  openRouterSaveConfig: 'kinlore:openrouter:saveConfig',
  llmPrepare: 'kinlore:llm:prepare',
  llmRun: 'kinlore:llm:run',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface ArchiveStatus {
  rootPath: string | undefined;
  encrypted: boolean;
  unlocked: boolean;
}

export type ArchivePresence = 'missing' | 'existing' | 'incomplete';

export interface EncryptedArchiveResult {
  backupPath?: string;
  status: ArchiveStatus;
  recoveryKey: string;
}

export interface LibrarySnapshot {
  people: Person[];
  consents: Consent[];
  recordings: Recording[];
  transcripts: Transcript[];
  interviews: Interview[];
  stories: Story[];
  keepsakes: Keepsake[];
  timeline: TimelineEvent[];
  recipes: Recipe[];
}

export interface PromptRequest {
  language: PreferredLanguage;
  personId?: string;
}

export interface CaptureInput {
  personId: string;
  language: PreferredLanguage;
  question: string;
  spokenWords?: string;
  mediaBase64: string;
  extension: string;
  promptId?: string;
  interviewId?: string;
  durationMs?: number;
}

export interface CaptureResult {
  recording: Recording;
  transcript?: Transcript;
  interview: Interview;
}

export interface ImportRequest {
  paths: string[];
  personIds: string[];
}

export interface ImportResult {
  recordings: Recording[];
  transcripts: Transcript[];
}

export interface KeepsakeMediaRequest {
  keepsakeId: string;
  sourcePath: string;
}

export interface SealRequest {
  id: string;
  sealedUntil: string;
  occasion?: string;
}

export interface AskRequest {
  question: string;
  personId?: string;
}

export interface SecretStatus {
  stored: boolean;
  location: 'secret-file';
}

export interface EngineStatus {
  speechEngineId: 'none';
  voiceEngineId: 'none';
  voiceInstalled: false;
  runsLocally: true;
}

export interface OutboundRequest {
  purpose: OutboundPurpose;
  approved: boolean;
  host: string;
}

export interface VoiceRequest {
  personId: string;
  enabled: boolean;
}

export type LlmTask = 'interview' | 'ask' | 'story' | 'recipe' | 'timeline';

export interface OpenRouterConfig {
  model: string;
  keyStored: boolean;
  location: 'secret-file';
}

export interface OpenRouterConfigInput {
  model: string;
  apiKey?: string;
  removeKey?: boolean;
}

export interface LlmRequest {
  task: LlmTask;
  language: PreferredLanguage;
  question?: string;
  persona?: string;
  personId?: string;
  recordingIds?: string[];
}

export interface LlmPreview {
  token: string;
  task: LlmTask;
  model: string;
  destination: string;
  expiresAt: string;
  messages: { role: 'system' | 'user'; content: string }[];
  /** Readable exact system and user message content, for the approval view. */
  text: string;
  recordingIds: string[];
}

export interface LlmApproval {
  token: string;
  approved: boolean;
}

export interface StoryDraft {
  title: string;
  summary: string;
  recordingIds: string[];
}

export interface RecipeDraft {
  title: string;
  ingredients: string[];
  steps: string[];
  recordingIds: string[];
}

export interface TimelineDraft {
  title: string;
  notes: string;
  occurredOn?: string;
  recordingIds: string[];
}

export type LlmResult =
  | { task: 'interview'; questions: string[] }
  | { task: 'ask'; response: AskResponse }
  | { task: 'story'; draft: StoryDraft }
  | { task: 'recipe'; draft: RecipeDraft }
  | { task: 'timeline'; draft: TimelineDraft };

export interface KinloreApi {
  getDefaultArchivePath(): Promise<string>;
  selectArchiveFolder(): Promise<string | undefined>;
  createArchive(
    rootPath: string,
    passphrase: string,
    replaceExisting?: boolean,
  ): Promise<EncryptedArchiveResult>;
  openArchive(rootPath: string): Promise<ArchiveStatus>;
  archiveStatus(): Promise<ArchiveStatus>;
  inspectArchive(rootPath: string): Promise<ArchivePresence>;
  enableEncryption(passphrase: string): Promise<{ recoveryKey: string }>;
  unlockArchive(passphrase: string): Promise<ArchiveStatus>;
  unlockArchiveWithRecovery(recoveryKey: string): Promise<ArchiveStatus>;
  lockArchive(): Promise<ArchiveStatus>;
  listPeople(): Promise<Person[]>;
  savePerson(person: Person): Promise<Person>;
  listConsents(): Promise<Consent[]>;
  saveConsent(consent: Consent): Promise<Consent>;
  loadLibrary(): Promise<LibrarySnapshot>;
  nextPrompts(request: PromptRequest): Promise<InterviewPrompt[]>;
  saveCapturedAnswer(input: CaptureInput): Promise<CaptureResult>;
  selectImports(): Promise<string[]>;
  importSelected(request: ImportRequest): Promise<ImportResult>;
  attachKeepsakeMedia(request: KeepsakeMediaRequest): Promise<Keepsake>;
  saveStory(story: Story): Promise<Story>;
  saveKeepsake(keepsake: Keepsake): Promise<Keepsake>;
  saveTimelineEvent(event: TimelineEvent): Promise<TimelineEvent>;
  saveRecipe(recipe: Recipe): Promise<Recipe>;
  sealRecording(request: SealRequest): Promise<Recording>;
  ask(request: AskRequest): Promise<AskResponse>;
  askFamily(question: string): Promise<FamilyAsk>;
  mediaUrl(relativePath: string): Promise<string | null>;
  secretStatus(account: string): Promise<SecretStatus>;
  saveSecret(account: string, secret: string): Promise<void>;
  deleteSecret(account: string): Promise<void>;
  showOutbound(purpose: OutboundPurpose): Promise<OutboundDisclosure>;
  runRemoteStep(request: OutboundRequest): Promise<RemoteStepResult>;
  voiceDecision(request: VoiceRequest): Promise<VoiceDecision>;
  engineStatus(): Promise<EngineStatus>;
  getOpenRouterConfig(): Promise<OpenRouterConfig>;
  saveOpenRouterConfig(input: OpenRouterConfigInput): Promise<OpenRouterConfig>;
  prepareLlm(request: LlmRequest): Promise<LlmPreview>;
  runLlm(approval: LlmApproval): Promise<LlmResult>;
}
