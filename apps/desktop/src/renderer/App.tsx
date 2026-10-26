import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react';
import type {
  AskClip,
  ConsentScope,
  FamilyAsk,
  InterviewPrompt,
  OutboundDisclosure,
  PreferredLanguage,
  Recording,
} from '@kinlore/core';
import type { ArchiveStatus, EngineStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { translate, type CopyKey } from './i18n.js';
import { blobToBase64, extensionFor } from './recording.js';

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

const NAV: { id: Section; key: CopyKey }[] = [
  { id: 'home', key: 'navHome' },
  { id: 'people', key: 'navPeople' },
  { id: 'interview', key: 'navInterview' },
  { id: 'library', key: 'navLibrary' },
  { id: 'ask', key: 'navAsk' },
  { id: 'family', key: 'navFamily' },
  { id: 'stories', key: 'navStories' },
  { id: 'keepsakes', key: 'navKeepsakes' },
  { id: 'cookbook', key: 'navCookbook' },
  { id: 'timeline', key: 'navTimeline' },
  { id: 'sealed', key: 'navSealed' },
  { id: 'settings', key: 'navSettings' },
];

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
  return error instanceof Error ? error.message : 'Something went wrong';
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
    void reload().catch((caught: unknown) => {
      setError(errorMessage(caught));
    });
  }, [reload]);

  async function run(work: () => Promise<void>): Promise<void> {
    try {
      setError(undefined);
      await work();
      await reload();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function useFolder(action: 'create' | 'open', rootPath: string): Promise<void> {
    const status =
      action === 'create'
        ? await window.kinlore.createArchive(rootPath)
        : await window.kinlore.openArchive(rootPath);
    setArchive(status);
    if (status.unlocked) {
      setLibrary(await window.kinlore.loadLibrary());
    }
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

  return (
    <div className="shell">
      <aside>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>Kinlore</h1>
        <label className="language" htmlFor="language">
          <select
            id="language"
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value as PreferredLanguage);
            }}
          >
            <option value="en">English</option>
            <option value="te">తెలుగు</option>
            <option value="hi">हिन्दी</option>
            <option value="ta">தமிழ்</option>
          </select>
        </label>
        <nav>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'nav current' : 'nav'}
              onClick={() => {
                setSection(item.id);
              }}
            >
              {t(item.key)}
            </button>
          ))}
        </nav>
      </aside>
      <main className="page">
        <p className="lede">{t('lede')}</p>
        {archive.rootPath !== undefined ? <p className="status">{archive.rootPath}</p> : null}
        {error !== undefined ? <p className="error">{error}</p> : null}
        {section === 'home' ? (
          <Home
            t={t}
            archive={archive}
            onArchive={(action, folder) => void onArchive(action, folder)}
          />
        ) : null}
        {!archive.unlocked && section !== 'home' ? <p className="muted">{t('locked')}</p> : null}
        {archive.unlocked && section === 'people' ? (
          <People library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'interview' ? (
          <Interview library={library} language={language} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'library' ? (
          <Library library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'ask' ? <Ask library={library} t={t} run={run} /> : null}
        {archive.unlocked && section === 'family' ? <Family library={library} t={t} /> : null}
        {archive.unlocked && section === 'stories' ? (
          <Stories library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'keepsakes' ? (
          <Keepsakes library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'cookbook' ? (
          <Cookbook library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'timeline' ? (
          <Timeline library={library} t={t} run={run} />
        ) : null}
        {archive.unlocked && section === 'sealed' ? (
          <Sealed library={library} t={t} run={run} />
        ) : null}
        {section === 'settings' ? (
          <Settings archive={archive} library={library} t={t} run={run} />
        ) : null}
      </main>
    </div>
  );
}

function Home(props: {
  t: (key: CopyKey) => string;
  archive: ArchiveStatus;
  onArchive: (action: 'create' | 'open', folder: boolean) => void;
}): JSX.Element {
  return (
    <section className="panel">
      <h2>{props.t('navHome')}</h2>
      <p>{props.t('home')}</p>
      {props.archive.encrypted && !props.archive.unlocked ? (
        <p className="muted">{props.t('locked')}</p>
      ) : null}
      <div className="actions">
        <button type="button" onClick={() => props.onArchive('create', false)}>
          {props.t('createDefault')}
        </button>
        <button type="button" onClick={() => props.onArchive('open', false)}>
          {props.t('openDefault')}
        </button>
        <button type="button" onClick={() => props.onArchive('create', true)}>
          {props.t('createFolder')}
        </button>
        <button type="button" onClick={() => props.onArchive('open', true)}>
          {props.t('openFolder')}
        </button>
      </div>
    </section>
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
    { scope: 'export', key: 'exportOk' },
    { scope: 'generated-voice', key: 'voiceOk' },
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
      {props.library.people.length === 0 ? <p className="muted">{props.t('nothing')}</p> : null}
      {props.library.people.map((person) => (
        <article key={person.id} className="card">
          <h3>{person.displayName}</h3>
          <div className="actions">
            {scopes.map((item) => {
              const granted = props.library.consents.some(
                (consent) =>
                  consent.personId === person.id && consent.scope === item.scope && consent.granted,
              );
              return (
                <button
                  key={item.scope}
                  type="button"
                  className={granted ? 'nav current' : 'nav'}
                  onClick={() => {
                    void props.run(async () => {
                      const existing = props.library.consents.find(
                        (consent) => consent.personId === person.id && consent.scope === item.scope,
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
                >
                  {props.t(item.key)}
                </button>
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
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <button type="submit">{props.t('addPerson')}</button>
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
}): JSX.Element {
  const people = consented(props.library, 'recording');
  const [personId, setPersonId] = useState(people[0]?.id ?? '');
  const [prompts, setPrompts] = useState<InterviewPrompt[]>([]);
  const [question, setQuestion] = useState('');
  const [words, setWords] = useState('');
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | undefined>(undefined);

  async function suggest(): Promise<void> {
    await props.run(async () => {
      const next = await window.kinlore.nextPrompts(
        personId === '' ? { language: props.language } : { language: props.language, personId },
      );
      setPrompts(next);
      const first = next[0];
      if (first !== undefined) {
        setQuestion(first.text);
      }
    });
  }

  async function start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    media.onstop = () => {
      setBlob(new Blob(chunks, { type: media.mimeType || 'audio/webm' }));
      for (const track of stream.getTracks()) {
        track.stop();
      }
    };
    media.start();
    setRecorder(media);
    setRecording(true);
  }

  const activePrompt = prompts.find((prompt) => prompt.text === question);

  return (
    <section className="panel">
      <h2>{props.t('navInterview')}</h2>
      <p className="muted">{props.t('spoken')}</p>
      {people.length === 0 ? <p className="muted">{props.t('consentHint')}</p> : null}
      <label htmlFor="speaker">{props.t('navPeople')}</label>
      <select
        id="speaker"
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
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void suggest();
          }}
        >
          {props.t('suggest')}
        </button>
      </div>
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          className={question === prompt.text ? 'nav current' : 'nav'}
          onClick={() => {
            setQuestion(prompt.text);
          }}
        >
          {prompt.text}
        </button>
      ))}
      <label htmlFor="ownQuestion">{props.t('ownQuestion')}</label>
      <textarea
        id="ownQuestion"
        value={question}
        onChange={(event) => {
          setQuestion(event.target.value);
        }}
      />
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            void props.run(start);
          }}
          disabled={recording || personId === ''}
        >
          {props.t('record')}
        </button>
        <button
          type="button"
          onClick={() => {
            recorder?.stop();
            setRecording(false);
          }}
          disabled={!recording}
        >
          {props.t('stop')}
        </button>
      </div>
      <label htmlFor="words">{props.t('wordsLabel')}</label>
      <textarea
        id="words"
        value={words}
        onChange={(event) => {
          setWords(event.target.value);
        }}
      />
      <button
        type="button"
        onClick={() => {
          void props.run(async () => {
            if (
              blob === undefined ||
              personId === '' ||
              question.trim() === '' ||
              words.trim() === ''
            ) {
              throw new Error(props.t('spoken'));
            }
            const mediaBase64 = await blobToBase64(blob);
            await window.kinlore.saveCapturedAnswer({
              personId,
              language: props.language,
              question: question.trim(),
              spokenWords: words.trim(),
              mediaBase64,
              extension: extensionFor(blob),
              ...(activePrompt !== undefined ? { promptId: activePrompt.id } : {}),
            });
            setWords('');
            setBlob(undefined);
          });
        }}
      >
        {props.t('saveWords')}
      </button>
    </section>
  );
}

function Library(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const people = consented(props.library, 'recording');
  const [personId, setPersonId] = useState(people[0]?.id ?? '');
  return (
    <section className="panel">
      <h2>{props.t('navLibrary')}</h2>
      <p className="muted">{props.t('importHelp')}</p>
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
      <RecordingList library={props.library} t={props.t} />
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

function RecordingRow(props: { recording: Recording; library: LibrarySnapshot }): JSX.Element {
  const [src, setSrc] = useState<string | null>(null);
  const sealed =
    props.recording.sealedUntil !== undefined &&
    Date.parse(props.recording.sealedUntil) > Date.now();
  useEffect(() => {
    if (sealed) {
      return;
    }
    void window.kinlore.mediaUrl(props.recording.mediaRelativePath).then((url) => {
      setSrc(url);
    });
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
      {transcript === undefined ? null : (
        <blockquote>{transcript.segments.map((segment) => segment.text).join(' ')}</blockquote>
      )}
      {src !== null ? <Player src={src} startMs={0} endMs={0} /> : null}
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
    void window.kinlore.mediaUrl(recording.mediaRelativePath).then((url) => {
      setSrc(url);
    });
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
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
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
      {unknown ? <p>{props.t('unknown')}</p> : null}
      {clips !== undefined ? <ClipList library={props.library} clips={clips} /> : null}
    </section>
  );
}

function Family(props: { library: LibrarySnapshot; t: (key: CopyKey) => string }): JSX.Element {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<FamilyAsk | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <section className="panel">
      <h2>{props.t('navFamily')}</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void window.kinlore
            .askFamily(question)
            .then((family) => {
              setError(undefined);
              setResult(family);
            })
            .catch((caught: unknown) => {
              setError(errorMessage(caught));
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
      {error !== undefined ? <p className="error">{error}</p> : null}
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
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [recordingId, setRecordingId] = useState(props.library.recordings[0]?.id ?? '');
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
            setTitle('');
            setSummary('');
          });
        }}
      >
        <label htmlFor="storyTitle">{props.t('title')}</label>
        <input
          id="storyTitle"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="summary">{props.t('notes')}</label>
        <textarea
          id="summary"
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value);
          }}
        />
        <RecordingSelect
          library={props.library}
          id="storyRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <button type="submit">{props.t('save')}</button>
      </form>
    </section>
  );
}

function RecordingSelect(props: {
  library: LibrarySnapshot;
  id: string;
  value: string;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
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
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="keepNotes">{props.t('notes')}</label>
        <textarea
          id="keepNotes"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
        <button type="submit">{props.t('save')}</button>
      </form>
    </section>
  );
}

function KeepsakeImage(props: { relativePath: string }): JSX.Element | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    void window.kinlore.mediaUrl(props.relativePath).then((url) => {
      setSrc(url);
    });
  }, [props.relativePath]);
  if (src === null) {
    return null;
  }
  return <img src={src} alt="" />;
}

function Cookbook(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [steps, setSteps] = useState('');
  const [recordingId, setRecordingId] = useState(props.library.recordings[0]?.id ?? '');
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
            setTitle('');
            setIngredients('');
            setSteps('');
          });
        }}
      >
        <label htmlFor="recipeTitle">{props.t('title')}</label>
        <input
          id="recipeTitle"
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
          id="recipeRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <button type="submit">{props.t('save')}</button>
      </form>
    </section>
  );
}

function Timeline(props: {
  library: LibrarySnapshot;
  t: (key: CopyKey) => string;
  run: (work: () => Promise<void>) => Promise<void>;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [occurredOn, setOccurredOn] = useState('');
  const [recordingId, setRecordingId] = useState('');
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
              createdAt: now,
              updatedAt: now,
            });
            setTitle('');
          });
        }}
      >
        <label htmlFor="eventTitle">{props.t('title')}</label>
        <input
          id="eventTitle"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <label htmlFor="occurredOn">{props.t('date')}</label>
        <input
          id="occurredOn"
          value={occurredOn}
          placeholder="1998-01-14"
          onChange={(event) => {
            setOccurredOn(event.target.value);
          }}
        />
        <RecordingSelect
          library={props.library}
          id="eventRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <button type="submit">{props.t('save')}</button>
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
          id="sealRecording"
          value={recordingId}
          onChange={setRecordingId}
        />
        <label htmlFor="sealDate">{props.t('date')}</label>
        <input
          id="sealDate"
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
        <button type="submit">{props.t('save')}</button>
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
  const [engine, setEngine] = useState<EngineStatus | undefined>(undefined);
  const [passphrase, setPassphrase] = useState('');
  const [recovery, setRecovery] = useState<string | undefined>(undefined);
  const [secret, setSecret] = useState('');
  const [stored, setStored] = useState(false);
  const [disclosure, setDisclosure] = useState<OutboundDisclosure | undefined>(undefined);
  const [remote, setRemote] = useState<string | undefined>(undefined);
  const [voice, setVoice] = useState<string | undefined>(undefined);
  const personId = props.library.people[0]?.id;

  useEffect(() => {
    void window.kinlore.engineStatus().then(setEngine);
    void window.kinlore.secretStatus('transcribe').then((status) => {
      setStored(status.stored);
    });
  }, []);

  return (
    <section className="panel">
      <h2>{props.t('navSettings')}</h2>
      <p>{props.t('engine')}</p>
      {engine !== undefined ? (
        <p className="muted">
          {engine.speechEngineId} · {engine.runsLocally ? 'local' : 'remote'}
        </p>
      ) : null}
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
            });
          }}
        >
          <label htmlFor="recovery">{props.t('recoveryKey')}</label>
          <input id="recovery" name="recovery" autoComplete="off" />
          <button type="submit">{props.t('unlock')}</button>
        </form>
      ) : null}
      <h3>{props.t('secretFile')}</h3>
      <p className="muted">{stored ? props.t('secretFile') : props.t('nothing')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void props.run(async () => {
            await window.kinlore.saveSecret('transcribe', secret);
            setSecret('');
            setStored(true);
          });
        }}
      >
        <label htmlFor="apiKey">API key</label>
        <input
          id="apiKey"
          type="password"
          value={secret}
          onChange={(event) => {
            setSecret(event.target.value);
          }}
          autoComplete="off"
        />
        <button type="submit">{props.t('save')}</button>
      </form>
      <h3>{props.t('outbound')}</h3>
      <button
        type="button"
        onClick={() => {
          void props.run(async () => {
            setDisclosure(await window.kinlore.showOutbound('transcribe'));
            const result = await window.kinlore.runRemoteStep({
              purpose: 'transcribe',
              approved: true,
              host: 'none',
            });
            setRemote(result.message);
          });
        }}
      >
        {props.t('ask')}
      </button>
      {disclosure !== undefined ? (
        <ul>
          {disclosure.wouldLeaveIfRemote.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {remote !== undefined ? <p>{remote}</p> : null}
      <h3>{props.t('voiceOff')}</h3>
      {personId !== undefined ? (
        <button
          type="button"
          onClick={() => {
            void props.run(async () => {
              const decision = await window.kinlore.voiceDecision({ personId, enabled: true });
              setVoice(decision.allowed ? 'labeled' : decision.reason);
            });
          }}
        >
          {props.t('voiceOk')}
        </button>
      ) : null}
      {voice !== undefined ? <p className="muted">{voice}</p> : null}
    </section>
  );
}
