import { useEffect, useReducer, useState, type JSX } from 'react';
import { isRecordingSealed } from '@kinlore/core';
import type { AskClip, PreferredLanguage, Recording } from '@kinlore/core';
import type { LibrarySnapshot } from '@kinlore/ipc-contract';
import { LlmAssist, SourcePicker } from '../assistance-ui.js';
import { Icon } from '../components/Icons.js';
import { MediaPlayer } from '../components/MediaPlayer.js';
import { StatusBanner } from '../components/StatusBanner.js';
import { draftState, reviewedDraftReducer } from '../experience-state.js';
import {
  CitedRecordingsRow,
  ClipList,
  RecordingSelect,
  consented,
  defaultTranslate,
  derivePersonIdsFromRecording,
  formatDateTime,
  formatDayString,
  formatDuration,
  lines,
  originCopyKey,
  personNamesForIds,
  stamp,
  useMediaUrl,
  type RunWorkFn,
  type Section,
  type TranslateFn,
} from './shared.js';

export type MemorySection =
  'library' | 'ask' | 'stories' | 'keepsakes' | 'cookbook' | 'timeline' | 'sealed';

const MEMORY_TABS: readonly {
  id: MemorySection;
  key:
    | 'allRecordings'
    | 'navAsk'
    | 'navStories'
    | 'navKeepsakes'
    | 'navCookbook'
    | 'navTimeline'
    | 'navSealed';
}[] = [
  { id: 'library', key: 'allRecordings' },
  { id: 'ask', key: 'navAsk' },
  { id: 'stories', key: 'navStories' },
  { id: 'keepsakes', key: 'navKeepsakes' },
  { id: 'cookbook', key: 'navCookbook' },
  { id: 'timeline', key: 'navTimeline' },
  { id: 'sealed', key: 'navSealed' },
];

export function RecordingRow(props: {
  recording: Recording;
  library: LibrarySnapshot;
  t?: TranslateFn;
  language?: PreferredLanguage;
}): JSX.Element {
  const t = props.t ?? defaultTranslate;
  const language = props.language ?? 'en';
  const sealed = isRecordingSealed(props.recording, new Date());
  const src = useMediaUrl(props.recording.mediaRelativePath, sealed);
  const transcript = props.library.transcripts.find(
    (item) => item.recordingId === props.recording.id,
  );
  const hasTranscript = transcript !== undefined && transcript.segments.length > 0;
  const speakers = personNamesForIds(props.library, props.recording.personIds);
  const dateLabel = formatDateTime(
    props.recording.recordedAt ?? props.recording.createdAt,
    language,
  );
  const durationLabel = formatDuration(props.recording.durationMs);
  const sealDateLabel = sealed
    ? formatDateTime(props.recording.sealedUntil, language, true)
    : undefined;

  return (
    <article className={sealed ? 'card recording-card is-sealed' : 'card recording-card'}>
      <div className="recording-card-header">
        <div>
          <h3>{props.recording.title}</h3>
          <div className="card-meta-row">
            {speakers.map((name) => (
              <span className="speaker-chip" key={name}>
                {name}
              </span>
            ))}
            <span className="pill-badge">{t(originCopyKey(props.recording.origin))}</span>
            {dateLabel !== undefined ? <span className="meta-text">{dateLabel}</span> : null}
            {durationLabel !== undefined ? (
              <span className="meta-text tabular">{durationLabel}</span>
            ) : null}
          </div>
        </div>
        {sealed ? (
          <span className="status-pill tone-warning">
            <Icon name="seal" size={14} />
            {t('sealedActiveBadge')}
          </span>
        ) : (
          <span className={hasTranscript ? 'status-pill tone-success' : 'status-pill tone-muted'}>
            {t(hasTranscript ? 'transcriptReady' : 'noTranscript')}
          </span>
        )}
      </div>
      {props.recording.occasion !== undefined ? (
        <p className="muted field-help">{props.recording.occasion}</p>
      ) : null}
      {sealed ? (
        <p className="muted seal-until-line">
          <Icon name="lock" size={14} />
          <span>
            {t('sealedLabel')}
            {sealDateLabel !== undefined ? `: ${sealDateLabel}` : ''}
          </span>
        </p>
      ) : null}
      {!sealed && hasTranscript ? (
        <blockquote>{transcript.segments.map((segment) => segment.text).join(' ')}</blockquote>
      ) : null}
      {!sealed && src !== null ? (
        <MediaPlayer
          src={src}
          mediaRelativePath={props.recording.mediaRelativePath}
          title={props.recording.title}
        />
      ) : null}
    </article>
  );
}

export function RecordingList(props: {
  library: LibrarySnapshot;
  t: TranslateFn;
  language?: PreferredLanguage;
  emptyMessage?: string;
}): JSX.Element {
  if (props.library.recordings.length === 0) {
    return <p className="muted">{props.emptyMessage ?? props.t('nothing')}</p>;
  }
  return (
    <ul className="stack">
      {props.library.recordings.map((recording) => (
        <li key={recording.id}>
          <RecordingRow
            recording={recording}
            library={props.library}
            t={props.t}
            {...(props.language === undefined ? {} : { language: props.language })}
          />
        </li>
      ))}
    </ul>
  );
}

function RecordingsView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
  onNavigate: (section: Section) => void;
}): JSX.Element {
  const [search, setSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const people = consented(props.library, 'recording');
  const [personId, setPersonId] = useState(people[0]?.id ?? '');

  useEffect(() => {
    if (people.length === 0) {
      if (personId !== '') setPersonId('');
      return;
    }
    if (!people.some((person) => person.id === personId)) {
      setPersonId(people[0]?.id ?? '');
    }
  }, [people, personId]);

  const effectivePersonId = people.some((person) => person.id === personId)
    ? personId
    : (people[0]?.id ?? '');

  const now = new Date();
  const query = search.trim().toLocaleLowerCase();
  const filteredRecordings = [...props.library.recordings]
    .sort((a, b) => (b.recordedAt ?? b.createdAt).localeCompare(a.recordedAt ?? a.createdAt))
    .filter((recording) => {
      if (speakerFilter !== '' && !recording.personIds.includes(speakerFilter)) {
        return false;
      }
      if (query === '') {
        return true;
      }
      const speakerNames = personNamesForIds(props.library, recording.personIds).join(' ');
      const sealed = isRecordingSealed(recording, now);
      const transcriptText = sealed
        ? ''
        : (props.library.transcripts
            .find((item) => item.recordingId === recording.id)
            ?.segments.map((segment) => segment.text)
            .join(' ') ?? '');
      return `${recording.title} ${speakerNames} ${transcriptText}`
        .toLocaleLowerCase()
        .includes(query);
    });

  return (
    <div className="memories-recordings">
      <section className="panel import-panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('import')}</h3>
            <p className="muted">{props.t('importHelp')}</p>
          </div>
        </div>
        {people.length === 0 ? (
          <StatusBanner
            tone="info"
            message={props.t('importNeedsPerson')}
            actionLabel={props.t('goToFamily')}
            onAction={() => props.onNavigate('people')}
          />
        ) : (
          <div className="inline-controls">
            <div className="control-grow">
              <label htmlFor="importPerson">{props.t('filterSpeaker')}</label>
              <select
                id="importPerson"
                value={effectivePersonId}
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
            </div>
            <button
              type="button"
              disabled={effectivePersonId === ''}
              onClick={() => {
                void props.run(async () => {
                  const paths = await window.kinlore.selectImports();
                  if (paths.length === 0 || effectivePersonId === '') {
                    return;
                  }
                  await window.kinlore.importSelected({
                    paths,
                    personIds: [effectivePersonId],
                  });
                });
              }}
            >
              <Icon name="upload" size={16} />
              {props.t('import')}
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="filter-bar">
          <div className="search-field control-grow">
            <label htmlFor="memory-search">{props.t('searchMemories')}</label>
            <div className="input-with-icon">
              <Icon name="search" size={16} />
              <input
                id="memory-search"
                type="search"
                value={search}
                placeholder={props.t('searchPlaceholder')}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="filter-select">
            <label htmlFor="memory-speaker-filter">{props.t('filterSpeaker')}</label>
            <select
              id="memory-speaker-filter"
              value={speakerFilter}
              onChange={(event) => setSpeakerFilter(event.target.value)}
            >
              <option value="">{props.t('allSpeakers')}</option>
              {props.library.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <RecordingList
          library={{ ...props.library, recordings: filteredRecordings }}
          t={props.t}
          language={props.language}
          emptyMessage={props.t(props.library.recordings.length === 0 ? 'nothing' : 'noMatches')}
        />
      </section>
    </div>
  );
}

function AskView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [sources, setSources] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('');
  const [clips, setClips] = useState<AskClip[] | undefined>(undefined);
  const [unknown, setUnknown] = useState(false);

  return (
    <section className="panel">
      <h3>{props.t('navAsk')}</h3>
      <p className="muted">{props.t('allAskHelp')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim() === '') return;
          void props.run(
            async () => {
              const response = await window.kinlore.ask({
                question: question.trim(),
                ...(speakerFilter === '' ? {} : { personId: speakerFilter }),
              });
              if (response.kind === 'unknown') {
                setClips(undefined);
                setUnknown(true);
                return;
              }
              setUnknown(false);
              setClips(response.clips);
            },
            { silent: true },
          );
        }}
      >
        <div className="inline-controls">
          <div className="control-grow">
            <label htmlFor="ask">{props.t('askPrompt')}</label>
            <input
              id="ask"
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
              }}
            />
          </div>
          <div className="filter-select">
            <label htmlFor="ask-speaker">{props.t('filterSpeaker')}</label>
            <select
              id="ask-speaker"
              value={speakerFilter}
              onChange={(event) => {
                setSpeakerFilter(event.target.value);
                setSources([]);
              }}
            >
              <option value="">{props.t('allSpeakers')}</option>
              {props.library.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={question.trim() === ''}>
          <Icon name="search" size={16} />
          {props.t('ask')}
        </button>
      </form>
      {unknown ? <StatusBanner tone="info" message={props.t('unknown')} /> : null}
      {clips !== undefined ? <ClipList library={props.library} clips={clips} /> : null}
      <SourcePicker
        library={props.library}
        value={sources}
        onChange={setSources}
        t={props.t}
        {...(speakerFilter === '' ? {} : { personId: speakerFilter })}
      />
      <LlmAssist
        key={JSON.stringify([question, sources, props.language, speakerFilter])}
        request={{
          task: 'ask',
          language: props.language,
          question,
          recordingIds: sources,
          ...(speakerFilter === '' ? {} : { personId: speakerFilter }),
        }}
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
    </section>
  );
}

function StoriesView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const unsealedRecordings = props.library.recordings.filter(
    (item) => !isRecordingSealed(item, new Date()),
  );
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; summary: string }>,
    draftState({ title: '', summary: '' }, unsealedRecordings[0]?.id ?? ''),
  );
  const { title, summary } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { title: value } });
  const setSummary = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { summary: value } });

  useEffect(() => {
    const recordings = props.library.recordings.filter(
      (item) => !isRecordingSealed(item, new Date()),
    );
    if (recordings.length === 0) {
      if (recordingId !== '') dispatchDraft({ type: 'source', id: '' });
      return;
    }
    if (recordingId === '' || !recordings.some((item) => item.id === recordingId)) {
      dispatchDraft({ type: 'source', id: recordings[0]?.id ?? '' });
    }
  }, [props.library.recordings, recordingId]);

  return (
    <div className="two-col-grid">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('navStories')}</h3>
            <p className="muted">{props.t('storyHint')}</p>
          </div>
          <span className="pill-badge">{props.library.stories.length}</span>
        </div>
        {props.library.stories.length === 0 ? (
          <p className="muted">{props.t('nothing')}</p>
        ) : (
          <div className="stack">
            {props.library.stories.map((story) => {
              const speakers = personNamesForIds(props.library, story.personIds);
              return (
                <article key={story.id} className="card">
                  <h4>{story.title}</h4>
                  {speakers.length > 0 ? (
                    <div className="card-meta-row">
                      {speakers.map((name) => (
                        <span className="speaker-chip" key={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {story.summary !== undefined ? <p>{story.summary}</p> : null}
                  <CitedRecordingsRow
                    library={props.library}
                    recordingIds={story.recordingIds}
                    t={props.t}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel compose-panel">
        <h3>{props.t('addStoryTitle')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void props.run(async () => {
              const now = stamp();
              await window.kinlore.saveStory({
                id: crypto.randomUUID(),
                title: title.trim(),
                personIds: derivePersonIdsFromRecording(props.library, recordingId),
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
            <Icon name="story" size={16} />
            {props.t('save')}
          </button>
        </form>
      </section>
    </div>
  );
}

function KeepsakeImage(props: { relativePath: string; alt: string }): JSX.Element | null {
  const src = useMediaUrl(props.relativePath);
  if (src === null) {
    return null;
  }
  return <img className="keepsake-photo" src={src} alt={props.alt} />;
}

function KeepsakesView(props: {
  library: LibrarySnapshot;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [personId, setPersonId] = useState('');

  useEffect(() => {
    if (personId !== '' && !props.library.people.some((person) => person.id === personId)) {
      setPersonId('');
    }
  }, [props.library.people, personId]);

  return (
    <div className="two-col-grid">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('navKeepsakes')}</h3>
            <p className="muted">{props.t('keepsakeHint')}</p>
          </div>
          <span className="pill-badge">{props.library.keepsakes.length}</span>
        </div>
        {props.library.keepsakes.length === 0 ? (
          <p className="muted">{props.t('nothing')}</p>
        ) : (
          <div className="stack">
            {props.library.keepsakes.map((keepsake) => {
              const speakers = personNamesForIds(props.library, keepsake.personIds);
              return (
                <article key={keepsake.id} className="card">
                  <h4>{keepsake.title}</h4>
                  {speakers.length > 0 ? (
                    <div className="card-meta-row">
                      {speakers.map((name) => (
                        <span className="speaker-chip" key={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {keepsake.notes !== undefined ? <p>{keepsake.notes}</p> : null}
                  {keepsake.mediaRelativePath !== undefined ? (
                    <KeepsakeImage relativePath={keepsake.mediaRelativePath} alt={keepsake.title} />
                  ) : null}
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
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
                      <Icon name="photo" size={16} />
                      {props.t(
                        keepsake.mediaRelativePath !== undefined ? 'replacePhoto' : 'attachPhoto',
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel compose-panel">
        <h3>{props.t('addKeepsakeTitle')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void props.run(async () => {
              const now = stamp();
              await window.kinlore.saveKeepsake({
                id: crypto.randomUUID(),
                title: title.trim(),
                personIds: personId === '' ? [] : [personId],
                ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
                createdAt: now,
                updatedAt: now,
              });
              setTitle('');
              setNotes('');
              setPersonId('');
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
          <label htmlFor="keepPerson">{props.t('optionalPerson')}</label>
          <select
            id="keepPerson"
            value={personId}
            onChange={(event) => setPersonId(event.target.value)}
          >
            <option value="">{props.t('noPersonSelected')}</option>
            {props.library.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
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
            <Icon name="photo" size={16} />
            {props.t('save')}
          </button>
        </form>
      </section>
    </div>
  );
}

function CookbookView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const unsealedRecordings = props.library.recordings.filter(
    (item) => !isRecordingSealed(item, new Date()),
  );
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; ingredients: string; steps: string }>,
    draftState({ title: '', ingredients: '', steps: '' }, unsealedRecordings[0]?.id ?? ''),
  );
  const { title, ingredients, steps } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { title: value } });
  const setIngredients = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { ingredients: value } });
  const setSteps = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { steps: value } });

  useEffect(() => {
    const recordings = props.library.recordings.filter(
      (item) => !isRecordingSealed(item, new Date()),
    );
    if (recordings.length === 0) {
      if (recordingId !== '') dispatchDraft({ type: 'source', id: '' });
      return;
    }
    if (recordingId === '' || !recordings.some((item) => item.id === recordingId)) {
      dispatchDraft({ type: 'source', id: recordings[0]?.id ?? '' });
    }
  }, [props.library.recordings, recordingId]);

  return (
    <div className="two-col-grid">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('navCookbook')}</h3>
            <p className="muted">{props.t('recipeHint')}</p>
          </div>
          <span className="pill-badge">{props.library.recipes.length}</span>
        </div>
        {props.library.recipes.length === 0 ? (
          <p className="muted">{props.t('nothing')}</p>
        ) : (
          <div className="stack">
            {props.library.recipes.map((recipe) => {
              const speakers = personNamesForIds(props.library, recipe.personIds);
              return (
                <article key={recipe.id} className="card">
                  <h4>{recipe.title}</h4>
                  {speakers.length > 0 ? (
                    <div className="card-meta-row">
                      {speakers.map((name) => (
                        <span className="speaker-chip" key={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <ul>
                    {recipe.ingredients.map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  <ol>
                    {recipe.steps.map((item, index) => (
                      <li key={`${index}-${item}`}>{item}</li>
                    ))}
                  </ol>
                  <CitedRecordingsRow
                    library={props.library}
                    recordingIds={recipe.recordingIds}
                    t={props.t}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel compose-panel">
        <h3>{props.t('addRecipeTitle')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void props.run(async () => {
              const now = stamp();
              await window.kinlore.saveRecipe({
                id: crypto.randomUUID(),
                title: title.trim(),
                personIds: derivePersonIdsFromRecording(props.library, recordingId),
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
            <Icon name="recipe" size={16} />
            {props.t('save')}
          </button>
        </form>
      </section>
    </div>
  );
}

export function TimelineView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [reviewed, dispatchDraft] = useReducer(
    reviewedDraftReducer<{ title: string; occurredOn: string; notes: string }>,
    draftState({ title: '', occurredOn: '', notes: '' }, ''),
  );
  const { title, occurredOn, notes } = reviewed.fields;
  const recordingId = reviewed.sourceId;
  const setRecordingId = (id: string): void => dispatchDraft({ type: 'source', id });
  const setTitle = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { title: value } });
  const setOccurredOn = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { occurredOn: value } });
  const setNotes = (value: string): void =>
    dispatchDraft({ type: 'edit', patch: { notes: value } });

  useEffect(() => {
    const recordings = props.library.recordings.filter(
      (item) => !isRecordingSealed(item, new Date()),
    );
    if (recordingId !== '' && !recordings.some((recording) => recording.id === recordingId)) {
      dispatchDraft({ type: 'source', id: '' });
    }
  }, [props.library.recordings, recordingId]);

  const sortedEvents = [...props.library.timeline].sort((a, b) => {
    const aDate = a.occurredOn;
    const bDate = b.occurredOn;
    if (aDate !== undefined && bDate !== undefined) {
      const cmp = bDate.localeCompare(aDate);
      return cmp !== 0 ? cmp : b.createdAt.localeCompare(a.createdAt);
    }
    if (aDate !== undefined) return -1;
    if (bDate !== undefined) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="two-col-grid">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('navTimeline')}</h3>
            <p className="muted">{props.t('timelineHint')}</p>
          </div>
          <span className="pill-badge">{sortedEvents.length}</span>
        </div>
        {sortedEvents.length === 0 ? (
          <p className="muted">{props.t('nothing')}</p>
        ) : (
          <div className="stack">
            {sortedEvents.map((event) => {
              const speakers = personNamesForIds(props.library, event.personIds);
              const dateText = formatDayString(event.occurredOn, props.language);
              return (
                <article key={event.id} className="card timeline-card">
                  <div className="card-meta-row">
                    {dateText !== undefined ? (
                      <span className="status-pill tone-info">
                        <Icon name="calendar" size={14} />
                        {dateText}
                      </span>
                    ) : null}
                    {speakers.map((name) => (
                      <span className="speaker-chip" key={name}>
                        {name}
                      </span>
                    ))}
                  </div>
                  <h4>{event.title}</h4>
                  {event.notes !== undefined && event.notes.trim() !== '' ? (
                    <p className="timeline-notes">{event.notes}</p>
                  ) : null}
                  <CitedRecordingsRow
                    library={props.library}
                    recordingIds={event.recordingIds}
                    t={props.t}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel compose-panel">
        <h3>{props.t('addTimelineTitle')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void props.run(async () => {
              const now = stamp();
              await window.kinlore.saveTimelineEvent({
                id: crypto.randomUUID(),
                title: title.trim(),
                personIds: derivePersonIdsFromRecording(props.library, recordingId),
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
          <label htmlFor="occurredOn">{props.t('eventDate')}</label>
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
            <Icon name="calendar" size={16} />
            {props.t('save')}
          </button>
        </form>
      </section>
    </div>
  );
}

function SealedView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [recordingId, setRecordingId] = useState(props.library.recordings[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [occasion, setOccasion] = useState('');

  useEffect(() => {
    const recordings = props.library.recordings;
    if (recordings.length === 0) {
      if (recordingId !== '') setRecordingId('');
      return;
    }
    if (recordingId === '' || !recordings.some((item) => item.id === recordingId)) {
      setRecordingId(recordings[0]?.id ?? '');
    }
  }, [props.library.recordings, recordingId]);

  const sealed = props.library.recordings.filter((recording) =>
    isRecordingSealed(recording, new Date()),
  );

  return (
    <div className="two-col-grid">
      <section className="panel">
        <div className="panel-header-row">
          <div>
            <h3>{props.t('navSealed')}</h3>
            <p className="muted">{props.t('sealHint')}</p>
          </div>
          <span className="pill-badge">{sealed.length}</span>
        </div>
        {sealed.length === 0 ? (
          <p className="muted">{props.t('noSealedYet')}</p>
        ) : (
          <div className="stack">
            {sealed.map((recording) => {
              const sealDate = formatDateTime(recording.sealedUntil, props.language, true);
              const speakers = personNamesForIds(props.library, recording.personIds);
              return (
                <article key={recording.id} className="card">
                  <div className="recording-card-header">
                    <h4>{recording.title}</h4>
                    <span className="status-pill tone-warning">
                      <Icon name="seal" size={14} />
                      {props.t('sealedActiveBadge')}
                    </span>
                  </div>
                  {speakers.length > 0 ? (
                    <div className="card-meta-row">
                      {speakers.map((name) => (
                        <span className="speaker-chip" key={name}>
                          {name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {recording.occasion !== undefined ? <p>{recording.occasion}</p> : null}
                  <p className="muted seal-until-line">
                    <Icon name="lock" size={14} />
                    <span>
                      {props.t('sealedLabel')}
                      {sealDate !== undefined ? `: ${sealDate}` : ''}
                    </span>
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel compose-panel">
        <h3>{props.t('addSealTitle')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void props.run(async () => {
              await window.kinlore.sealRecording({
                id: recordingId,
                sealedUntil: new Date(date).toISOString(),
                ...(occasion.trim() === '' ? {} : { occasion: occasion.trim() }),
              });
              setDate('');
              setOccasion('');
            });
          }}
        >
          <RecordingSelect
            library={props.library}
            t={props.t}
            id="sealRecording"
            value={recordingId}
            onChange={setRecordingId}
            includeSealed
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
          <p className="muted field-help">{props.t('sealNeedsFutureDate')}</p>
          <label htmlFor="occasion">{props.t('occasion')}</label>
          <input
            id="occasion"
            maxLength={200}
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
            <Icon name="seal" size={16} />
            {props.t('save')}
          </button>
        </form>
      </section>
    </div>
  );
}

export function MemoriesPage(props: {
  section: MemorySection;
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
  onNavigate: (section: Section) => void;
}): JSX.Element {
  const sealedCount = props.library.recordings.filter((recording) =>
    isRecordingSealed(recording, new Date()),
  ).length;

  function tabCount(id: MemorySection): number | undefined {
    switch (id) {
      case 'library':
        return props.library.recordings.length;
      case 'stories':
        return props.library.stories.length;
      case 'keepsakes':
        return props.library.keepsakes.length;
      case 'cookbook':
        return props.library.recipes.length;
      case 'timeline':
        return props.library.timeline.length;
      case 'sealed':
        return sealedCount;
      case 'ask':
        return undefined;
    }
  }

  return (
    <div className="memories-workspace">
      <div className="subnav" role="tablist" aria-label={props.t('memoriesSpace')}>
        {MEMORY_TABS.map((tab) => {
          const count = tabCount(tab.id);
          const active = props.section === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={active}
              className={active ? 'current' : undefined}
              onClick={() => props.onNavigate(tab.id)}
            >
              <span>{props.t(tab.key)}</span>
              {count !== undefined ? <span className="subnav-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {props.section === 'library' ? (
        <RecordingsView
          library={props.library}
          language={props.language}
          t={props.t}
          run={props.run}
          onNavigate={props.onNavigate}
        />
      ) : null}
      {props.section === 'ask' ? (
        <AskView library={props.library} language={props.language} t={props.t} run={props.run} />
      ) : null}
      {props.section === 'stories' ? (
        <StoriesView
          library={props.library}
          language={props.language}
          t={props.t}
          run={props.run}
        />
      ) : null}
      {props.section === 'keepsakes' ? (
        <KeepsakesView library={props.library} t={props.t} run={props.run} />
      ) : null}
      {props.section === 'cookbook' ? (
        <CookbookView
          library={props.library}
          language={props.language}
          t={props.t}
          run={props.run}
        />
      ) : null}
      {props.section === 'timeline' ? (
        <TimelineView
          library={props.library}
          language={props.language}
          t={props.t}
          run={props.run}
        />
      ) : null}
      {props.section === 'sealed' ? (
        <SealedView library={props.library} language={props.language} t={props.t} run={props.run} />
      ) : null}
    </div>
  );
}
