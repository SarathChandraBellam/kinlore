import {
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
  type FormEvent,
  type JSX,
} from 'react';
import type {
  AskClip,
  ConsentScope,
  FamilyAsk,
  InterviewPrompt,
  PreferredLanguage,
  Recording,
} from '@kinlore/core';
import type { ArchiveStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { translate, type CopyKey } from './i18n.js';
import { blobToBase64, extensionFor } from './recording.js';
import { LlmAssist, OpenRouterSettings, SourcePicker } from './assistance-ui.js';
import { isRecordingSealed } from '@kinlore/core';
import { discoverArchive, chooseArchive, invocationMessage } from './archive-flow.js';
import { ExistingArchive } from './existing-archive.js';
import { ArchiveSetup } from './archive-setup.js';
import { takeReducer, EMPTY_TAKE, reviewedDraftReducer, draftState } from './experience-state.js';

type Section =
  | 'home'
  | 'people'
  | 'interview'
  | 'library'
  | 'ask'
  | 'family'
  | 'stories'
  | 'keepsakes'
  | 'cookbook'
  | 'timeline'
  | 'sealed'
  | 'settings';

const NAV: { id: Section; key: CopyKey; icon: string }[] = [
  { id: 'home', key: 'navHome', icon: 'home' },
  { id: 'people', key: 'familySpace', icon: 'people' },
  { id: 'interview', key: 'recordSpace', icon: 'mic' },
  { id: 'library', key: 'memoriesSpace', icon: 'book' },
  { id: 'settings', key: 'navSettings', icon: 'settings' },
];
const MEMORY_NAV: { id: Section; key: CopyKey }[] = [
  { id: 'library', key: 'allRecordings' },
  { id: 'stories', key: 'navStories' },
  { id: 'keepsakes', key: 'navKeepsakes' },
  { id: 'cookbook', key: 'navCookbook' },
  { id: 'timeline', key: 'navTimeline' },
  { id: 'sealed', key: 'navSealed' },
  { id: 'ask', key: 'navAsk' },
];
function Icon(props: { name: string }): JSX.Element {
  const paths: Record<string, string> = {
    home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
    people:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    mic: 'M12 15a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v7a3 3 0 0 0 3 3M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
    book: 'M12 5C8 2 4 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v16',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[props.name] ?? paths.book} />
    </svg>
  );
}

const EMPTY: LibrarySnapshot = {
  people: [],
  consents: [],
  recordings: [],
  transcripts: [],
  interviews: [],
  stories: [],
  keepsakes: [],
  timeline: [],
  recipes: [],
};

function errorMessage(error: unknown): string {
  return invocationMessage(error);
}

function stamp(): string {
  return new Date().toISOString();
}

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function Player(props: { src: string; startMs: number; endMs: number }): JSX.Element {
  return (
    <audio
      src={props.src}
      controls
      onLoadedMetadata={(event) => {
        if (props.startMs > 0) {
          event.currentTarget.currentTime = props.startMs / 1000;
        }
      }}
      onTimeUpdate={(event) => {
        if (props.endMs > props.startMs && event.currentTarget.currentTime * 1000 >= props.endMs) {
          event.currentTarget.pause();
        }
      }}
    />
  );
}

export function App(): JSX.Element {
  const [language, setLanguage] = useState<PreferredLanguage>('en');
  const [section, setSection] = useState<Section>('home');
  const [archive, setArchive] = useState<ArchiveStatus>({
    rootPath: undefined,
    encrypted: false,
    unlocked: false,
  });
  const [library, setLibrary] = useState<LibrarySnapshot>(EMPTY);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pendingRoot, setPendingRoot] = useState<string>();
  const [existingRoot, setExistingRoot] = useState<string>();
  const [replacing, setReplacing] = useState(false);
  const startup = useRef<Promise<ArchiveStatus> | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [unsavedRecording, setUnsavedRecording] = useState(false);
  const running = useRef(false);
  const t = useCallback((key: CopyKey) => translate(language, key), [language]);

  const reload = useCallback(async () => {
    const status = await window.kinlore.archiveStatus();
    setArchive(status);
    if (!status.unlocked) {
      setLibrary(EMPTY);
      return;
    }
    setLibrary(await window.kinlore.loadLibrary());
  }, []);

  useEffect(() => {
    let active = true;
    startup.current ??= discoverArchive(window.kinlore);
    void startup.current
      .then(async (status) => {
        if (!active) return;
        setArchive(status);
        if (status.unlocked) {
          const next = await window.kinlore.loadLibrary();
          if (active) setLibrary(next);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  async function run(work: () => Promise<void>): Promise<void> {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setSuccess(false);
    try {
      setError(undefined);
      await work();
      await reload();
      setSuccess(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  function navigate(next: Section): void {
    if (next === section) return;
    if (unsavedRecording && !window.confirm(t('discardRecording'))) return;
    setError(undefined);
    setSuccess(false);
    setSection(next);
  }

  async function useFolder(action: 'create' | 'open', rootPath: string): Promise<void> {
    const choice = await chooseArchive(window.kinlore, rootPath, action);
    if (choice === 'existing') {
      setExistingRoot(rootPath);
      return;
    }
    if (choice === 'create') {
      setReplacing(false);
      setPendingRoot(rootPath);
      return;
    }
    const status = await window.kinlore.openArchive(rootPath);
    setArchive(status);
    if (status.unlocked) setLibrary(await window.kinlore.loadLibrary());
    setSection(status.encrypted && !status.unlocked ? 'settings' : 'home');
  }

  async function onArchive(action: 'create' | 'open', folder: boolean): Promise<void> {
    await run(async () => {
      const rootPath = folder
        ? await window.kinlore.selectArchiveFolder()
        : await window.kinlore.getDefaultArchivePath();
      if (rootPath === undefined) {
        return;
      }
      await useFolder(action, rootPath);
    });
  }

  const primary =
    section === 'family'
      ? 'people'
      : MEMORY_NAV.some((item) => item.id === section)
        ? 'library'
        : section;
  const title = NAV.find((item) => item.id === primary)?.key ?? 'navHome';
  const intros: Partial<Record<Section, CopyKey>> = {
    people: 'familyIntro',
    library: 'memoriesIntro',
    interview: 'recordIntro',
    settings: 'settingsIntro',
  };
  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('skipContent')}
      </a>
      {existingRoot !== undefined ? (
        <ExistingArchive
          rootPath={existingRoot}
          t={t}
          onOpen={async () => {
            await useFolder('open', existingRoot);
            setExistingRoot(undefined);
          }}
          onChoose={() => {
            setExistingRoot(undefined);
            void onArchive('create', true);
          }}
          onReplace={() => {
            setPendingRoot(existingRoot);
            setReplacing(true);
            setExistingRoot(undefined);
          }}
          onClose={() => setExistingRoot(undefined)}
        />
      ) : null}
      {pendingRoot !== undefined ? (
        <ArchiveSetup
          t={t}
          replacing={replacing}
          onCreate={async (passphrase) => {
            const created = await window.kinlore.createArchive(pendingRoot, passphrase, replacing);
            setArchive(created.status);
            setLibrary(EMPTY);
            return created;
          }}
          onClose={(created) => {
            setPendingRoot(undefined);
            setReplacing(false);
            setSuccess(false);
            if (created) setSection('people');
          }}
        />
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            k
          </span>
          <div>
            <h1>
              kinlore<span>.</span>
            </h1>
            <p>{t('eyebrow')}</p>
          </div>
        </div>
        <nav aria-label="Primary">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={primary === item.id ? 'nav current' : 'nav'}
              aria-current={primary === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.key)}</span>
              {item.id === 'library' && library.recordings.length > 0 ? (
                <span className="nav-count">{library.recordings.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="privacy-dot" />
          <p>
            {t(archive.encrypted ? 'encryptedLabel' : 'privateLabel')}
            <small>{t('privateHelp')}</small>
          </p>
        </div>
      </aside>
      <main className="page" id="main-content">
        <header className="topbar">
          <span>{t('eyebrow')}</span>
          <label className="language">
            <span className="sr-only">{t('languageLabel')}</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as PreferredLanguage)}
            >
              <option value="en">English</option>
              <option value="te">తెలుగు</option>
              <option value="hi">हिन्दी</option>
              <option value="ta">தமிழ்</option>
            </select>
          </label>
        </header>
        <div className="page-content">
          <header className="page-heading">
            <div>
              <p className="eyebrow">Kinlore / {t(title)}</p>
              <h2>{t(title)}</h2>
              {intros[primary] !== undefined ? <p className="muted">{t(intros[primary])}</p> : null}
            </div>
            {archive.unlocked && primary !== 'interview' ? (
              <button type="button" className="record-cta" onClick={() => navigate('interview')}>
                <Icon name="mic" />
                {t('recordStory')}
              </button>
            ) : null}
          </header>
          {error !== undefined ? (
            <p role="alert" className="error notice">
              {error}
            </p>
          ) : null}
          {busy ? (
            <p role="status" className="notice">
              {t('working')}
            </p>
          ) : success ? (
            <p role="status" className="notice">
              {t('updated')}
            </p>
          ) : null}
          {archive.unlocked && !archive.encrypted && section !== 'settings' ? (
            <section className="notice migration-notice">
              <h3>{t('encryptionRequired')}</h3>
              <p>{t('encryptionRequiredHelp')}</p>
              <button type="button" onClick={() => navigate('settings')}>
                {t('encrypt')}
              </button>
            </section>
          ) : null}
          <fieldset className="workspace-fieldset" disabled={busy}>
            {section === 'home' ? (
              <Home
                t={t}
                archive={archive}
                library={library}
                onNavigate={navigate}
                onArchive={(action, folder) => void onArchive(action, folder)}
              />
            ) : null}
            {!archive.unlocked && section !== 'home' && section !== 'settings' ? (
              <section className="empty-state panel">
                <Icon name="book" />
                <h3>{t(archive.encrypted ? 'locked' : 'beginTitle')}</h3>
                <p>{t('archiveHelp')}</p>
                <button
                  type="button"
                  onClick={() => navigate(archive.encrypted ? 'settings' : 'home')}
                >
                  {t(archive.encrypted ? 'unlock' : 'startArchive')}
                </button>
              </section>
            ) : null}
            {archive.unlocked && archive.encrypted && primary === 'people' ? (
              <div className="subnav" aria-label={t('familySpace')}>
                {[
                  { id: 'people' as const, key: 'navPeople' as const },
                  { id: 'family' as const, key: 'allVoices' as const },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={section === item.id ? 'current' : ''}
                    aria-pressed={section === item.id}
                    onClick={() => navigate(item.id)}
                  >
                    {t(item.key)}
                  </button>
                ))}
              </div>
            ) : null}
            {archive.unlocked && archive.encrypted && primary === 'library' ? (
              <div className="subnav" aria-label={t('memoriesSpace')}>
                {MEMORY_NAV.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={section === item.id ? 'current' : ''}
                    aria-pressed={section === item.id}
                    onClick={() => navigate(item.id)}
                  >
                    {t(item.key)}
                  </button>
                ))}
              </div>
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'people' ? (
              <People library={library} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'interview' ? (
              <Interview
                library={library}
                language={language}
                t={t}
                run={run}
                onDirtyChange={setUnsavedRecording}
                onMemories={() => navigate('library')}
              />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'library' ? (
              <Library library={library} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'ask' ? (
              <Ask library={library} language={language} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'family' ? (
              <Family library={library} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'stories' ? (
              <Stories library={library} language={language} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'keepsakes' ? (
              <Keepsakes library={library} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'cookbook' ? (
              <Cookbook library={library} language={language} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'timeline' ? (
              <Timeline library={library} language={language} t={t} run={run} />
            ) : null}
            {archive.unlocked && archive.encrypted && section === 'sealed' ? (
              <Sealed library={library} t={t} run={run} />
            ) : null}
            {section === 'settings' ? (
              <>
                <section className="panel">
                  <h2>{t('archiveLocation')}</h2>
                  <p className="archive-path">{archive.rootPath ?? t('archiveHelp')}</p>
                  <ArchiveActions
                    t={t}
                    onArchive={(action, folder) => void onArchive(action, folder)}
                  />
                </section>
                <OpenRouterSettings t={t} />
                <Settings archive={archive} library={library} t={t} run={run} />
              </>
            ) : null}
          </fieldset>
          <footer className="page-footer">
            Kinlore <span aria-hidden="true">·</span> {t('privateHelp')}
          </footer>
        </div>
      </main>
    </div>
  );
}

function ArchiveActions(props: {
  t: (key: CopyKey) => string;
  onArchive: (action: 'create' | 'open', folder: boolean) => void;
}): JSX.Element {
  return (
    <div className="actions">
      <button type="button" className="secondary" onClick={() => props.onArchive('open', true)}>
        {props.t('openArchive')}
      </button>
      <details className="archive-options">
        <summary>{props.t('moreOptions')}</summary>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            onClick={() => props.onArchive('create', true)}
          >
            {props.t('createFolder')}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => props.onArchive('open', false)}
          >
            {props.t('openDefault')}
          </button>
        </div>
      </details>
    </div>
  );
}

export function Home(props: {
  t: (key: CopyKey) => string;
  archive: ArchiveStatus;
  library: LibrarySnapshot;
  onNavigate: (section: Section) => void;
  onArchive: (action: 'create' | 'open', folder: boolean) => void;
}): JSX.Element {
  const { t, archive, library } = props;
  const ready = consented(library, 'recording').length > 0;
  const next: Section =
    !archive.encrypted || !archive.unlocked ? 'settings' : ready ? 'interview' : 'people';
  return (
    <>
      <section className="welcome-hero">
        <div className="hero-copy">
          <p className="eyebrow">{t(archive.unlocked ? 'nextStep' : 'firstSteps')}</p>
          <h2>{t('welcomeTitle')}</h2>
          <p>{t('welcomeBody')}</p>
          <div className="actions">
            <button
              type="button"
              onClick={() =>
                archive.rootPath === undefined
                  ? props.onArchive('create', false)
                  : props.onNavigate(next)
              }
            >
              {t(
                archive.rootPath === undefined
                  ? 'startArchive'
                  : !archive.encrypted
                    ? 'encrypt'
                    : !archive.unlocked
                      ? 'unlock'
                      : ready
                        ? 'recordStory'
                        : 'addPerson',
              )}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          {archive.rootPath !== undefined ? (
            <button
              type="button"
              className="text-button"
              onClick={() => props.onArchive('create', false)}
            >
              {t('manageArchive')}
            </button>
          ) : null}
          {archive.rootPath === undefined ? (
            <button
              type="button"
              className="text-button"
              onClick={() => props.onArchive('open', true)}
            >
              {t('openArchive')} <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
        <div className="voice-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="voice-disc">
            <Icon name="mic" />
          </div>
          <div className="voice-wave">
            {[22, 40, 28, 58, 82, 48, 100, 64, 38, 72, 44, 26, 52, 32, 18].map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </div>
          <span>voices worth keeping</span>
        </div>
      </section>
      {archive.unlocked ? (
        <>
          <div className="archive-stats">
            {[
              { value: library.people.length, label: 'peopleCount' as const },
              { value: library.recordings.length, label: 'recordingsCount' as const },
              { value: library.stories.length, label: 'storiesCount' as const },
            ].map((item) => (
              <div key={item.label}>
                <strong>{item.value.toString().padStart(2, '0')}</strong>
                <span>{t(item.label)}</span>
              </div>
            ))}
          </div>
          <div className="section-heading">
            <h3>{t('recentMemories')}</h3>
            {library.recordings.length > 0 ? (
              <button
                type="button"
                className="text-button"
                onClick={() => props.onNavigate('library')}
              >
                {t('viewMemories')} →
              </button>
            ) : null}
          </div>
          {library.recordings.length > 0 ? (
            <RecordingList
              library={{
                ...library,
                recordings: [...library.recordings]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .slice(0, 3),
              }}
              t={t}
            />
          ) : (
            <section className="empty-state panel">
              <Icon name="book" />
              <h3>{t(library.people.length === 0 ? 'addFirstPerson' : 'beginTitle')}</h3>
              <p>{t(library.people.length === 0 ? 'firstPersonHelp' : 'beginBody')}</p>
              <button type="button" className="secondary" onClick={() => props.onNavigate(next)}>
                {t(ready ? 'recordStory' : 'addPerson')}
              </button>
            </section>
          )}
        </>
      ) : (
        <div className="journey-grid">
          {[
            { icon: 'people', title: 'familySpace' as const, body: 'firstPersonHelp' as const },
            { icon: 'mic', title: 'recordStory' as const, body: 'recordingHelp' as const },
            { icon: 'book', title: 'memoriesSpace' as const, body: 'privateHelp' as const },
          ].map((item, i) => (
            <article key={item.title}>
              <span className="step-number">0{i + 1}</span>
              <Icon name={item.icon} />
              <h3>{t(item.title)}</h3>
              <p>{t(item.body)}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function People(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [name, setName] = useState('');
  const scopes: { scope: ConsentScope; key: CopyKey }[] = [
    { scope: 'recording', key: 'recordingOk' },
    { scope: 'archive', key: 'archiveOk' },
    { scope: 'export', key: 'allowSharing' },
  ];

  async function onAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName === '') {
      return;
    }
    await props.run(async () => {
      const now = stamp();
      await window.kinlore.savePerson({
        id: crypto.randomUUID(),
        displayName,
        createdAt: now,
        updatedAt: now,
      });
      setName('');
    });
  }

  return (
    <section className="panel">
      <h2>{props.t('navPeople')}</h2>
      <p className="muted">{props.t('consentHint')}</p>
      <p className="muted">{props.t('exportHelp')}</p>
      {props.library.people.length === 0 ? <p className="muted">{props.t('nothing')}</p> : null}
      {props.library.people.map((person) => (
        <article key={person.id} className="card">
          <div className="person-heading">
            <span className="avatar" aria-hidden="true">
              {Array.from(person.displayName)[0]}
            </span>
            <div>
              <h3>{person.displayName}</h3>
              <p className="muted">
                {
                  props.library.recordings.filter((recording) =>
                    recording.personIds.includes(person.id),
                  ).length
                }{' '}
                {props.t('recordingsCount')}
              </p>
            </div>
          </div>
          <div className="actions">
            {scopes.map((item) => {
              const granted = props.library.consents.some(
                (consent) =>
                  consent.personId === person.id && consent.scope === item.scope && consent.granted,
              );
              return (
                <label className="consent-choice" key={item.scope}>
                  <input
                    type="checkbox"
                    checked={granted}
                    onChange={() => {
                      void props.run(async () => {
                        const existing = props.library.consents.find(
                          (consent) =>
                            consent.personId === person.id && consent.scope === item.scope,
                        );
                        const now = stamp();
                        const nextGranted = !granted;
                        await window.kinlore.saveConsent({
                          id: existing?.id ?? crypto.randomUUID(),
                          personId: person.id,
                          scope: item.scope,
                          granted: nextGranted,
                          ...(nextGranted ? { grantedAt: now } : {}),
                          ...(existing?.grantedAt !== undefined && !nextGranted
                            ? { grantedAt: existing.grantedAt }
                            : {}),
                          createdAt: existing?.createdAt ?? now,
                          updatedAt: now,
                        });
                      });
                    }}
                  />
                  <span>{props.t(item.key)}</span>
                </label>
              );
            })}
          </div>
        </article>
      ))}
      <form
        onSubmit={(event) => {
          void onAdd(event);
        }}
      >
        <label htmlFor="displayName">{props.t('name')}</label>
        <input
          id="displayName"
          required
          maxLength={120}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <button type="submit" disabled={name.trim() === ''}>
          {props.t('addPerson')}
        </button>
      </form>
    </section>
  );
}

function consented(library: LibrarySnapshot, scope: ConsentScope): LibrarySnapshot['people'] {
  return library.people.filter((person) =>
    library.consents.some(
      (consent) => consent.personId === person.id && consent.scope === scope && consent.granted,
    ),
  );
}

function Interview(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onMemories: () => void;
}): JSX.Element {
  const people = consented(props.library, 'recording');
  const [personId, setPersonId] = useState(people[0]?.id ?? '');
  const [prompts, setPrompts] = useState<InterviewPrompt[]>([]);
  const [question, setQuestion] = useState('');
  const [take, dispatchTake] = useReducer(takeReducer, EMPTY_TAKE);
  const { words, blob, error: captureError } = take;
  const setWords = (value: string): void => dispatchTake({ type: 'words', value });
  const setBlob = (value: Blob | undefined): void => {
    if (value === undefined) dispatchTake({ type: 'discard' });
    else dispatchTake({ type: 'captured', blob: value });
  };
  const [preview, setPreview] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [saved, setSaved] = useState(false);
  const [persona, setPersona] = useState('');
  const [sources, setSources] = useState<string[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const startedAt = useRef(0);
  const requesting = useRef(false);
  const takeGeneration = useRef(0);
  const dirty = recording || blob !== undefined || starting;
  useEffect(() => {
    props.onDirtyChange(dirty);
    return () => props.onDirtyChange(false);
  }, [dirty, props.onDirtyChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      takeGeneration.current += 1;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => {
    if (blob === undefined) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  useEffect(() => {
    if (!recording) return;
    const tick = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(tick);
  }, [recording]);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function start(): Promise<void> {
    if (requesting.current || recorder.current?.state === 'recording') return;
    requesting.current = true;
    const generation = ++takeGeneration.current;
    setStarting(true);
    setSaved(false);
    dispatchTake({ type: 'start' });
    let mediaStream: MediaStream | undefined;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = mediaStream;
      const media = new MediaRecorder(mediaStream);
      const chunks: Blob[] = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      media.onstop = () => {
        mediaStream?.getTracks().forEach((track) => track.stop());
        if (!mounted.current || generation !== takeGeneration.current) return;
        setRecording(false);
        setDuration(Date.now() - startedAt.current);
        setBlob(new Blob(chunks, { type: media.mimeType || 'audio/webm' }));
      };
      media.onerror = () => {
        mediaStream?.getTracks().forEach((track) => track.stop());
        if (mounted.current && generation === takeGeneration.current) {
          setRecording(false);
          dispatchTake({ type: 'failed', message: props.t('captureFailed') });
        }
      };
      media.start();
      recorder.current = media;
      startedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
    } catch (error) {
      mediaStream?.getTracks().forEach((track) => track.stop());
      throw error;
    } finally {
      requesting.current = false;
      if (mounted.current) setStarting(false);
    }
  }
  const activePrompt = prompts.find((prompt) => prompt.text === question);
  const request = {
    task: 'interview' as const,
    language: props.language,
    ...(personId === '' ? {} : { personId }),
    ...(question.trim() === '' ? {} : { question: question.trim() }),
    ...(persona.trim() === '' ? {} : { persona: persona.trim() }),
    recordingIds: sources,
  };
  if (people.length === 0)
    return (
      <section className="empty-state panel">
        <Icon name="people" />
        <h3>{props.t('consentNeeded')}</h3>
        <p>{props.t('firstPersonHelp')}</p>
      </section>
    );
  return (
    <section className="record-workspace">
      <ol className="record-steps">
        {['setup', 'capture', 'review'].map((step, index) => (
          <li
            key={step}
            className={(blob !== undefined ? 2 : recording ? 1 : 0) === index ? 'active' : ''}
          >
            <span>{index + 1}</span>
            {props.t(step as 'setup' | 'capture' | 'review')}
          </li>
        ))}
      </ol>
      {saved ? (
        <div className="saved-moment" role="status">
          <span aria-hidden="true">✓</span>
          <h3>{props.t('savedRecording')}</h3>
          <p>{props.t('recordingSavedHelp')}</p>
          <button type="button" className="secondary" onClick={props.onMemories}>
            {props.t('viewMemories')}
          </button>
        </div>
      ) : null}
      <div className="record-layout">
        <div className="record-main panel">
          <label htmlFor="speaker">{props.t('navPeople')}</label>
          <select
            id="speaker"
            value={personId}
            disabled={dirty}
            onChange={(event) => {
              setPersonId(event.target.value);
              setSources([]);
              setPrompts([]);
            }}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
          <label htmlFor="ownQuestion">{props.t('question')}</label>
          <textarea
            id="ownQuestion"
            value={question}
            disabled={recording || starting}
            maxLength={500}
            placeholder={props.t('questionPlaceholder')}
            onChange={(event) => setQuestion(event.target.value)}
          />
          {captureError !== undefined ? (
            <p role="alert" className="error notice">
              {captureError}
            </p>
          ) : null}
          <div className={recording ? 'record-station is-recording' : 'record-station'}>
            <div className="mic-orbit">
              <Icon name="mic" />
            </div>
            <p role="status">
              {props.t(recording ? 'recordingNow' : blob !== undefined ? 'review' : 'readyRecord')}
            </p>
            <strong className="record-timer">
              {Math.floor(seconds / 60)
                .toString()
                .padStart(2, '0')}
              :{(seconds % 60).toString().padStart(2, '0')}
            </strong>
            <div className="actions">
              {recording ? (
                <button
                  type="button"
                  className="stop-button"
                  onClick={() => {
                    if (recorder.current?.state === 'recording') recorder.current.stop();
                  }}
                >
                  <span aria-hidden="true">■</span>
                  {props.t('stop')}
                </button>
              ) : blob === undefined ? (
                <button
                  type="button"
                  className="record-button"
                  disabled={starting || personId === ''}
                  onClick={() => void props.run(start)}
                >
                  <span aria-hidden="true">●</span>
                  {props.t(starting ? 'working' : 'record')}
                </button>
              ) : null}
            </div>
          </div>
          {blob !== undefined ? (
            <div className="record-review">
              {preview !== undefined ? (
                <audio src={preview} controls aria-label={props.t('review')} />
              ) : null}
              <label htmlFor="words">{props.t('optionalWords')}</label>
              <textarea
                id="words"
                value={words}
                maxLength={8000}
                onChange={(event) => setWords(event.target.value)}
                aria-describedby="words-help"
              />
              <p id="words-help" className="muted">
                {props.t('wordsHelp')}
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() =>
                    void props.run(async () => {
                      if (blob.size === 0)
                        throw new Error('No audio was captured. Please record again.');
                      await window.kinlore.saveCapturedAnswer({
                        personId,
                        language: props.language,
                        question: question.trim() || props.t('untitledStory'),
                        spokenWords: words.trim(),
                        mediaBase64: await blobToBase64(blob),
                        extension: extensionFor(blob),
                        durationMs: duration,
                        ...(activePrompt === undefined ? {} : { promptId: activePrompt.id }),
                      });
                      setBlob(undefined);
                      setPreview(undefined);
                      setWords('');
                      setSaved(true);
                      setSeconds(0);
                    })
                  }
                >
                  {props.t('saveRecording')}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    if (window.confirm(props.t('discardRecording'))) {
                      setBlob(undefined);
                      setPreview(undefined);
                      setSeconds(0);
                    }
                  }}
                >
                  {props.t('discard')}
                </button>
              </div>
            </div>
          ) : (
            <p className="record-hint muted">{props.t('recordingHelp')}</p>
          )}
        </div>
        <div className="question-sidebar">
          <section className="question-card">
            <p className="eyebrow">{props.t('promptIdea')}</p>
            <h3>{props.t('beginTitle')}</h3>
            <p>{props.t('beginBody')}</p>
            <button
              type="button"
              className="secondary"
              disabled={recording || starting}
              onClick={() =>
                void props.run(async () => {
                  const next = await window.kinlore.nextPrompts({
                    language: props.language,
                    personId,
                  });
                  setPrompts(next);
                })
              }
            >
              {props.t('localQuestions')}
            </button>
            {prompts.map((prompt) => (
              <button
                type="button"
                className={
                  question === prompt.text ? 'question-option selected' : 'question-option'
                }
                key={prompt.id}
                disabled={recording || starting}
                onClick={() => setQuestion(prompt.text)}
              >
                {prompt.text}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </section>
          {!dirty ? (
            <>
              <label htmlFor="interview-persona">{props.t('personaLabel')}</label>
              <textarea
                id="interview-persona"
                maxLength={1000}
                value={persona}
                placeholder={props.t('personaPlaceholder')}
                onChange={(event) => {
                  setPersona(event.target.value);
                  setPrompts([]);
                }}
                aria-describedby="persona-help"
              />
              <p id="persona-help" className="muted">
                {props.t('personaHelp')}
              </p>
              <SourcePicker
                library={props.library}
                value={sources}
                onChange={setSources}
                personId={personId}
                t={props.t}
              />
              <LlmAssist
                key={JSON.stringify(request)}
                request={request}
                library={props.library}
                t={props.t}
                onResult={(result) => {
                  if (result.task === 'interview')
                    setPrompts(
                      result.questions.map((text, index) => ({
                        id: `ai-${index}`,
                        language: props.language,
                        topic: 'suggestion',
                        text,
                      })),
                    );
                }}
              />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Library(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [search, setSearch] = useState('');
  const people = consented(props.library, 'recording');
  const [personId, setPersonId] = useState(people[0]?.id ?? '');
  return (
    <section className="panel">
      <h2>{props.t('navLibrary')}</h2>
      <p className="muted">{props.t('importHelp')}</p>
      {people.length === 0 ? <p className="notice">{props.t('importNeedsPerson')}</p> : null}
      <label htmlFor="importPerson">{props.t('navPeople')}</label>
      <select
        id="importPerson"
        value={personId}
        onChange={(event) => {
          setPersonId(event.target.value);
        }}
      >
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.displayName}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={personId === ''}
        onClick={() => {
          void props.run(async () => {
            const paths = await window.kinlore.selectImports();
            if (paths.length === 0 || personId === '') {
              return;
            }
            await window.kinlore.importSelected({ paths, personIds: [personId] });
          });
        }}
      >
        {props.t('import')}
      </button>
      <label htmlFor="memory-search">{props.t('searchMemories')}</label>
      <input
        id="memory-search"
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <RecordingList
        library={{
          ...props.library,
          recordings: props.library.recordings.filter((recording) =>
            `${recording.title} ${props.library.people
              .filter((person) => recording.personIds.includes(person.id))
              .map((person) => person.displayName)
              .join(' ')}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
          ),
        }}
        t={props.t}
      />
    </section>
  );
}

function RecordingList(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
}): JSX.Element {
  if (props.library.recordings.length === 0) {
    return <p className="muted">{props.t('nothing')}</p>;
  }
  return (
    <ul className="stack">
      {props.library.recordings.map((recording) => (
        <li key={recording.id}>
          <RecordingRow recording={recording} library={props.library} />
        </li>
      ))}
    </ul>
  );
}

export function RecordingRow(props: {
  recording: Recording;
  library: LibrarySnapshot;
}): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);
  const sealed = isRecordingSealed(props.recording, new Date());
  useEffect(() => {
    if (sealed) {
      return;
    }
    let active = true;
    void window.kinlore
      .mediaUrl(props.recording.mediaRelativePath)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [props.recording.mediaRelativePath, sealed]);
  const transcript = props.library.transcripts.find(
    (item) => item.recordingId === props.recording.id,
  );
  return (
    <article className="card">
      <h3>{props.recording.title}</h3>
      {props.recording.occasion !== undefined ? (
        <p className="muted">{props.recording.occasion}</p>
      ) : null}
      {sealed ? <p className="muted">{props.recording.sealedUntil}</p> : null}
      {sealed || transcript === undefined ? null : (
        <blockquote>{transcript.segments.map((segment) => segment.text).join(' ')}</blockquote>
      )}
      {!sealed && src !== null ? <Player src={src} startMs={0} endMs={0} /> : null}
    </article>
  );
}

function ClipList(props: { library: LibrarySnapshot; clips: AskClip[] }): JSX.Element {
  return (
    <div className="stack">
      {props.clips.map((clip) => (
        <ClipCard key={clip.segmentId} library={props.library} clip={clip} />
      ))}
    </div>
  );
}

function ClipCard(props: { library: LibrarySnapshot; clip: AskClip }): JSX.Element {
  const recording = props.library.recordings.find((item) => item.id === props.clip.recordingId);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (recording === undefined) {
      return;
    }
    let active = true;
    void window.kinlore
      .mediaUrl(recording.mediaRelativePath)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [recording]);
  return (
    <article className="card">
      {props.clip.speakerName !== undefined ? <h3>{props.clip.speakerName}</h3> : null}
      {props.clip.question !== undefined ? <p className="muted">{props.clip.question}</p> : null}
      <blockquote>{props.clip.text}</blockquote>
      {src !== null ? (
        <Player src={src} startMs={props.clip.startMs} endMs={props.clip.endMs} />
      ) : null}
    </article>
  );
}

function Ask(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [sources, setSources] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [clips, setClips] = useState<AskClip[] | undefined>(undefined);
  const [unknown, setUnknown] = useState(false);
  return (
    <section className="panel">
      <h2>{props.t('navAsk')}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            const response = await window.kinlore.ask({ question });
            if (response.kind === 'unknown') {
              setClips(undefined);
              setUnknown(true);
              return;
            }
            setUnknown(false);
            setClips(response.clips);
          });
        }}
      >
        <label htmlFor="ask">{props.t('askPrompt')}</label>
        <input
          id="ask"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
        />
        <button type="submit">{props.t('ask')}</button>
      </form>
      <SourcePicker library={props.library} value={sources} onChange={setSources} t={props.t} />
      <LlmAssist
        key={JSON.stringify([question, sources, props.language])}
        request={{ task: 'ask', language: props.language, question, recordingIds: sources }}
        library={props.library}
        t={props.t}
        disabled={question.trim() === '' || sources.length === 0}
        onResult={(result) => {
          if (result.task === 'ask') {
            setUnknown(result.response.kind === 'unknown');
            setClips(result.response.kind === 'clips' ? result.response.clips : undefined);
          }
        }}
      />
      {unknown ? <p>{props.t('unknown')}</p> : null}
      {clips !== undefined ? <ClipList library={props.library} clips={clips} /> : null}
    </section>
  );
}

function Family(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<FamilyAsk | undefined>(undefined);
  return (
    <section className="panel">
      <h2>{props.t('navFamily')}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            setResult(await window.kinlore.askFamily(question));
          });
        }}
      >
        <label htmlFor="familyAsk">{props.t('familyPrompt')}</label>
        <input
          id="familyAsk"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
        />
        <button type="submit">{props.t('ask')}</button>
      </form>
      {result !== undefined && result.distinctVoices >= 2 ? <p>{props.t('separate')}</p> : null}
      {result?.memories.map((memory) => (
        <article key={memory.personId} className="card">
          <h3>{memory.displayName}</h3>
          {memory.response.kind === 'unknown' ? (
            <p className="muted">{props.t('unknown')}</p>
          ) : (
            <ClipList library={props.library} clips={memory.response.clips} />
          )}
        </article>
      ))}
    </section>
  );
}

function Stories(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; summary: string }>,
    draftState({ title: '', summary: '' }, props.library.recordings[0]?.id ?? ''),
  );
  const { title, summary } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (title: string): void => dispatchDraft({ type: 'edit', patch: { title } });
  const setSummary = (summary: string): void => dispatchDraft({ type: 'edit', patch: { summary } });
  return (
    <section className="panel">
      <h2>{props.t('navStories')}</h2>
      <p className="muted">{props.t('storyHint')}</p>
      {props.library.stories.map((story) => (
        <article key={story.id} className="card">
          <h3>{story.title}</h3>
          {story.summary !== undefined ? <p>{story.summary}</p> : null}
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            const now = stamp();
            await window.kinlore.saveStory({
              id: crypto.randomUUID(),
              title,
              personIds: [],
              recordingIds: [recordingId],
              ...(summary.trim() === '' ? {} : { summary: summary.trim() }),
              createdAt: now,
              updatedAt: now,
            });
            dispatchDraft({ type: 'clear' });
          });
        }}
      >
        <label htmlFor="storyTitle">{props.t('title')}</label>
        <input
          id="storyTitle"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="summary">{props.t('notes')}</label>
        <textarea
          id="summary"
          maxLength={4000}
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
        />
        <RecordingSelect
          library={props.library}
          t={props.t}
          id="storyRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <LlmAssist
          key={JSON.stringify([recordingId, props.language])}
          request={{
            task: 'story',
            language: props.language,
            recordingIds: recordingId === '' ? [] : [recordingId],
          }}
          library={props.library}
          t={props.t}
          disabled={recordingId === ''}
          onResult={(result) => {
            if (result.task === 'story') {
              dispatchDraft({
                type: 'apply',
                fields: { title: result.draft.title, summary: result.draft.summary },
              });
            }
          }}
        />
        <button type="submit" disabled={title.trim() === '' || recordingId === ''}>
          {props.t('save')}
        </button>
      </form>
    </section>
  );
}

function RecordingSelect(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <label className="source-label" htmlFor={props.id}>
      {props.t('sourceLabel')}
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        <option value="">—</option>
        {props.library.recordings.map((recording) => (
          <option key={recording.id} value={recording.id}>
            {recording.title}
          </option>
        ))}
      </select>
    </label>
  );
}

function Keepsakes(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <section className="panel">
      <h2>{props.t('navKeepsakes')}</h2>
      <p className="muted">{props.t('keepsakeHint')}</p>
      {props.library.keepsakes.map((keepsake) => (
        <article key={keepsake.id} className="card">
          <h3>{keepsake.title}</h3>
          {keepsake.notes !== undefined ? <p>{keepsake.notes}</p> : null}
          <button
            type="button"
            onClick={() => {
              void props.run(async () => {
                const paths = await window.kinlore.selectImports();
                const source = paths[0];
                if (source === undefined) {
                  return;
                }
                await window.kinlore.attachKeepsakeMedia({
                  keepsakeId: keepsake.id,
                  sourcePath: source,
                });
              });
            }}
          >
            {props.t('import')}
          </button>
          {keepsake.mediaRelativePath !== undefined ? (
            <KeepsakeImage relativePath={keepsake.mediaRelativePath} />
          ) : null}
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            const now = stamp();
            await window.kinlore.saveKeepsake({
              id: crypto.randomUUID(),
              title,
              personIds: [],
              ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
              createdAt: now,
              updatedAt: now,
            });
            setTitle('');
            setNotes('');
          });
        }}
      >
        <label htmlFor="keepTitle">{props.t('title')}</label>
        <input
          id="keepTitle"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="keepNotes">{props.t('notes')}</label>
        <textarea
          id="keepNotes"
          maxLength={4000}
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
        <button type="submit" disabled={title.trim() === ''}>
          {props.t('save')}
        </button>
      </form>
    </section>
  );
}

function KeepsakeImage(props: { relativePath: string }): JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void window.kinlore
      .mediaUrl(props.relativePath)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch(() => {
        if (active) setSrc(null);
      });
    return () => {
      active = false;
    };
  }, [props.relativePath]);
  if (src === null) {
    return null;
  }
  return <img src={src} alt="" />;
}

function Cookbook(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; ingredients: string; steps: string }>,
    draftState({ title: '', ingredients: '', steps: '' }, props.library.recordings[0]?.id ?? ''),
  );
  const { title, ingredients, steps } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (title: string): void => dispatchDraft({ type: 'edit', patch: { title } });
  const setIngredients = (ingredients: string): void =>
    dispatchDraft({ type: 'edit', patch: { ingredients } });
  const setSteps = (steps: string): void => dispatchDraft({ type: 'edit', patch: { steps } });
  return (
    <section className="panel">
      <h2>{props.t('navCookbook')}</h2>
      <p className="muted">{props.t('recipeHint')}</p>
      {props.library.recipes.map((recipe) => (
        <article key={recipe.id} className="card">
          <h3>{recipe.title}</h3>
          <ul>
            {recipe.ingredients.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ol>
            {recipe.steps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            const now = stamp();
            await window.kinlore.saveRecipe({
              id: crypto.randomUUID(),
              title,
              personIds: [],
              recordingIds: [recordingId],
              ingredients: lines(ingredients),
              steps: lines(steps),
              createdAt: now,
              updatedAt: now,
            });
            dispatchDraft({ type: 'clear' });
          });
        }}
      >
        <label htmlFor="recipeTitle">{props.t('title')}</label>
        <input
          id="recipeTitle"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="ingredients">{props.t('ingredients')}</label>
        <textarea
          id="ingredients"
          value={ingredients}
          onChange={(event) => {
            setIngredients(event.target.value);
          }}
        />
        <label htmlFor="steps">{props.t('steps')}</label>
        <textarea
          id="steps"
          value={steps}
          onChange={(event) => {
            setSteps(event.target.value);
          }}
        />
        <RecordingSelect
          library={props.library}
          t={props.t}
          id="recipeRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <LlmAssist
          key={JSON.stringify([recordingId, props.language])}
          request={{
            task: 'recipe',
            language: props.language,
            recordingIds: recordingId === '' ? [] : [recordingId],
          }}
          library={props.library}
          t={props.t}
          disabled={recordingId === ''}
          onResult={(result) => {
            if (result.task === 'recipe') {
              dispatchDraft({
                type: 'apply',
                fields: {
                  title: result.draft.title,
                  ingredients: result.draft.ingredients.join('\n'),
                  steps: result.draft.steps.join('\n'),
                },
              });
            }
          }}
        />
        <button type="submit" disabled={title.trim() === '' || recordingId === ''}>
          {props.t('save')}
        </button>
      </form>
    </section>
  );
}

function Timeline(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; occurredOn: string; notes: string }>,
    draftState({ title: '', occurredOn: '', notes: '' }, ''),
  );
  const { title, occurredOn, notes } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (title: string): void => dispatchDraft({ type: 'edit', patch: { title } });
  const setOccurredOn = (occurredOn: string): void =>
    dispatchDraft({ type: 'edit', patch: { occurredOn } });
  const setNotes = (notes: string): void => dispatchDraft({ type: 'edit', patch: { notes } });
  return (
    <section className="panel">
      <h2>{props.t('navTimeline')}</h2>
      <p className="muted">{props.t('timelineHint')}</p>
      {props.library.timeline.map((event) => (
        <article key={event.id} className="card">
          <h3>{event.title}</h3>
          {event.occurredOn !== undefined ? <p className="muted">{event.occurredOn}</p> : null}
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            const now = stamp();
            await window.kinlore.saveTimelineEvent({
              id: crypto.randomUUID(),
              title,
              personIds: [],
              recordingIds: recordingId === '' ? [] : [recordingId],
              ...(occurredOn === '' ? {} : { occurredOn }),
              ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
              createdAt: now,
              updatedAt: now,
            });
            dispatchDraft({ type: 'clear' });
          });
        }}
      >
        <label htmlFor="eventTitle">{props.t('title')}</label>
        <input
          id="eventTitle"
          required
          maxLength={200}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="occurredOn">{props.t('date')}</label>
        <input
          id="occurredOn"
          type="date"
          value={occurredOn}
          placeholder="1998-01-14"
          onChange={(event) => {
            setOccurredOn(event.target.value);
          }}
        />
        <label htmlFor="event-notes">{props.t('notes')}</label>
        <textarea
          id="event-notes"
          maxLength={4000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
        <RecordingSelect
          library={props.library}
          t={props.t}
          id="eventRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <LlmAssist
          key={JSON.stringify([recordingId, props.language])}
          request={{
            task: 'timeline',
            language: props.language,
            recordingIds: recordingId === '' ? [] : [recordingId],
          }}
          library={props.library}
          t={props.t}
          disabled={recordingId === ''}
          onResult={(result) => {
            if (result.task === 'timeline') {
              dispatchDraft({
                type: 'apply',
                fields: {
                  title: result.draft.title,
                  occurredOn: result.draft.occurredOn ?? '',
                  notes: result.draft.notes,
                },
              });
            }
          }}
        />
        <button type="submit" disabled={title.trim() === ''}>
          {props.t('save')}
        </button>
      </form>
    </section>
  );
}

function Sealed(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [recordingId, setRecordingId] = useState(props.library.recordings[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [occasion, setOccasion] = useState('');
  const sealed = props.library.recordings.filter(
    (recording) =>
      recording.sealedUntil !== undefined && Date.parse(recording.sealedUntil) > Date.now(),
  );
  return (
    <section className="panel">
      <h2>{props.t('navSealed')}</h2>
      <p className="muted">{props.t('sealHint')}</p>
      {sealed.map((recording) => (
        <article key={recording.id} className="card">
          <h3>{recording.title}</h3>
          <p>
            {recording.occasion ?? ''} {recording.sealedUntil}
          </p>
        </article>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            await window.kinlore.sealRecording({
              id: recordingId,
              sealedUntil: new Date(date).toISOString(),
              ...(occasion.trim() === '' ? {} : { occasion: occasion.trim() }),
            });
          });
        }}
      >
        <RecordingSelect
          library={props.library}
          t={props.t}
          id="sealRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <label htmlFor="sealDate">{props.t('date')}</label>
        <input
          id="sealDate"
          required
          type="datetime-local"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
          }}
        />
        <label htmlFor="occasion">{props.t('occasion')}</label>
        <input
          id="occasion"
          value={occasion}
          onChange={(event) => {
            setOccasion(event.target.value);
          }}
        />
        <button
          type="submit"
          disabled={
            recordingId === '' ||
            !Number.isFinite(Date.parse(date)) ||
            Date.parse(date) <= Date.now()
          }
        >
          {props.t('save')}
        </button>
      </form>
    </section>
  );
}

function Settings(props: {
  archive: ArchiveStatus;
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [passphrase, setPassphrase] = useState('');
  const [recovery, setRecovery] = useState<string>();
  return (
    <section className="panel">
      <h2>{props.t('protectArchive')}</h2>
      {props.archive.encrypted ? <p className="key-status">{props.t('encryptedLabel')}</p> : null}
      <h3>{props.t('encrypt')}</h3>
      <p className="muted">{props.t('encryptHint')}</p>
      {recovery !== undefined ? (
        <article className="card">
          <p>{props.t('recovery')}</p>
          <p className="recovery">{recovery}</p>
          <button
            type="button"
            onClick={() => {
              setRecovery(undefined);
            }}
          >
            {props.t('savedKey')}
          </button>
        </article>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            if (!props.archive.unlocked) {
              const status = props.archive.encrypted
                ? await window.kinlore.unlockArchive(passphrase)
                : undefined;
              if (status === undefined) {
                throw new Error(props.t('locked'));
              }
              setPassphrase('');
              return;
            }
            if (props.archive.encrypted) {
              await window.kinlore.lockArchive();
              return;
            }
            const result = await window.kinlore.enableEncryption(passphrase);
            setRecovery(result.recoveryKey);
            setPassphrase('');
          });
        }}
      >
        <label htmlFor="passphrase">{props.t('passphrase')}</label>
        <input
          id="passphrase"
          type="password"
          value={passphrase}
          onChange={(event) => {
            setPassphrase(event.target.value);
          }}
          autoComplete="off"
        />
        <div className="actions">
          {props.archive.unlocked && !props.archive.encrypted ? (
            <button type="submit">{props.t('encrypt')}</button>
          ) : null}
          {props.archive.encrypted && props.archive.unlocked ? (
            <button type="submit">{props.t('lock')}</button>
          ) : null}
          {props.archive.encrypted && !props.archive.unlocked ? (
            <button type="submit">{props.t('unlock')}</button>
          ) : null}
        </div>
      </form>
      {props.archive.encrypted && !props.archive.unlocked ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const field = event.currentTarget.elements.namedItem('recovery');
            const value = field instanceof HTMLInputElement ? field.value : '';
            void props.run(async () => {
              await window.kinlore.unlockArchiveWithRecovery(value);
              if (field instanceof HTMLInputElement) field.value = '';
            });
          }}
        >
          <label htmlFor="recovery">{props.t('recoveryKey')}</label>
          <input id="recovery" name="recovery" autoComplete="off" />
          <button type="submit">{props.t('unlock')}</button>
        </form>
      ) : null}
      <details>
        <summary>{props.t('engine')}</summary>
        <p className="muted">{props.t('voiceOff')}</p>
      </details>
    </section>
  );
}
