import { useEffect, useRef, useState, type JSX } from 'react';
import { isRecordingSealed } from '@kinlore/core';
import type {
  LibrarySnapshot,
  LlmPreview,
  LlmRequest,
  LlmResult,
  OpenRouterConfig,
} from '@kinlore/ipc-contract';
import { invocationMessage } from './archive-flow.js';
import { Icon } from './components/Icons.js';
import { StatusBanner } from './components/StatusBanner.js';
import type { CopyKey } from './i18n.js';

type Translate = (key: CopyKey) => string;

function message(error: unknown): string {
  return invocationMessage(error);
}

export function SourcePicker(props: {
  library: LibrarySnapshot;
  value: string[];
  onChange: (ids: string[]) => void;
  t: Translate;
  personId?: string;
}): JSX.Element {
  const recordings = props.library.recordings.filter(
    (recording) =>
      !isRecordingSealed(recording, new Date()) &&
      (props.personId === undefined || recording.personIds.includes(props.personId)) &&
      props.library.transcripts.some(
        (transcript) => transcript.recordingId === recording.id && transcript.segments.length > 0,
      ),
  );
  return (
    <details className="source-picker">
      <summary>
        <span>{props.t('chooseSources')}</span>
        <span className="count">{props.value.length}</span>
      </summary>
      <p className="muted">{props.t('sourcesHelp')}</p>
      {recordings.length === 0 ? (
        <p className="muted">{props.t('noSources')}</p>
      ) : (
        <div className="source-list">
          {recordings.map((recording) => (
            <label className="check-row" key={recording.id}>
              <input
                type="checkbox"
                checked={props.value.includes(recording.id)}
                disabled={!props.value.includes(recording.id) && props.value.length >= 8}
                onChange={(event) =>
                  props.onChange(
                    event.target.checked
                      ? [...props.value, recording.id]
                      : props.value.filter((id) => id !== recording.id),
                  )
                }
              />
              <span>{recording.title}</span>
            </label>
          ))}
        </div>
      )}
    </details>
  );
}

/** Mount with a key based on the request so changed inputs discard stale previews/results. */
export function LlmAssist(props: {
  request: LlmRequest;
  library: LibrarySnapshot;
  t: Translate;
  onResult: (result: LlmResult) => void;
  disabled?: boolean;
}): JSX.Element {
  const [preview, setPreview] = useState<LlmPreview>();
  const [result, setResult] = useState<LlmResult>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const active = useRef(true);
  const inFlight = useRef(false);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (preview !== undefined) previewHeading.current?.focus();
  }, [preview]);

  async function perform(work: () => Promise<void>): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await work();
    } catch (caught) {
      if (active.current) setError(message(caught));
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  }

  const draft = result !== undefined && 'draft' in result ? result.draft : undefined;

  return (
    <div className="ai-assist">
      <div className="ai-label">
        <Icon name="sparkle" size={16} />
        <span>{props.t('optionalAi')}</span>
      </div>
      <p className="muted">{props.t('aiHelp')}</p>
      {preview === undefined ? (
        <button
          type="button"
          className="secondary"
          disabled={busy || props.disabled}
          onClick={() =>
            void perform(async () => {
              setResult(undefined);
              setApplied(false);
              const next = await window.kinlore.prepareLlm(props.request);
              if (active.current) setPreview(next);
            })
          }
        >
          <Icon name="sparkle" size={15} />
          {busy ? props.t('working') : props.t('previewRequest')}
        </button>
      ) : (
        <section className="request-preview" aria-labelledby="request-heading">
          <h3 id="request-heading" tabIndex={-1} ref={previewHeading}>
            {props.t('reviewRequest')}
          </h3>
          <p className="muted">{props.t('destinationHelp')}</p>
          <dl className="meta-dl">
            <div>
              <dt>{props.t('modelLabel')}</dt>
              <dd>{preview.model}</dd>
            </div>
            <div>
              <dt>{props.t('destination')}</dt>
              <dd>{preview.destination}</dd>
            </div>
          </dl>
          <label htmlFor="outbound-text">{props.t('exactText')}</label>
          <textarea
            id="outbound-text"
            className="outbound-text"
            readOnly
            value={preview.text}
            rows={10}
          />
          <div className="actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const token = preview.token;
                  setPreview(undefined);
                  const next = await window.kinlore.runLlm({ token, approved: true });
                  if (!active.current) return;
                  setResult(next);
                  if (next.task === 'interview' || next.task === 'ask') props.onResult(next);
                })
              }
            >
              {props.t('sendRequest')}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setPreview(undefined)}
            >
              {props.t('cancel')}
            </button>
          </div>
        </section>
      )}
      {busy ? (
        <p role="status" className="muted field-help">
          {props.t('working')}
        </p>
      ) : null}
      {error !== undefined ? <StatusBanner tone="error" message={error} /> : null}
      {draft !== undefined ? (
        <article className="draft-card">
          <p className="eyebrow">{props.t('draftLabel')}</p>
          <h3>{draft.title}</h3>
          {'summary' in draft ? <p>{draft.summary}</p> : null}
          {'notes' in draft ? <p>{draft.notes}</p> : null}
          {'occurredOn' in draft && draft.occurredOn !== undefined ? (
            <p className="pill-badge">{draft.occurredOn}</p>
          ) : null}
          {'ingredients' in draft ? (
            <>
              <ul>
                {draft.ingredients.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
              <ol>
                {draft.steps.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ol>
            </>
          ) : null}
          <p className="muted">
            {props.t('sourceLabel')}:{' '}
            {draft.recordingIds
              .map(
                (id) =>
                  props.library.recordings.find((recording) => recording.id === id)?.title ?? id,
              )
              .join(', ')}
          </p>
          <p className="muted">{props.t('draftHelp')}</p>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={applied}
              onClick={() => {
                if (result !== undefined) {
                  props.onResult(result);
                  setApplied(true);
                }
              }}
            >
              <Icon name="check" size={15} />
              {props.t('applyDraft')}
            </button>
          </div>
          {applied ? <StatusBanner tone="success" message={props.t('draftApplied')} /> : null}
        </article>
      ) : null}
    </div>
  );
}

export function OpenRouterSettings(props: { t: Translate }): JSX.Element {
  const [config, setConfig] = useState<OpenRouterConfig>();
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(undefined);
    void window.kinlore
      .getOpenRouterConfig()
      .then((value) => {
        if (active) {
          setConfig(value);
          setModel(value.model);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(message(caught));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save(removeKey = false): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    setSaved(false);
    try {
      const next = await window.kinlore.saveOpenRouterConfig({
        model: removeKey ? (config?.model ?? model) : model.trim(),
        ...(removeKey ? { removeKey: true } : key.trim() === '' ? {} : { apiKey: key.trim() }),
      });
      setConfig(next);
      setModel(next.model);
      setKey('');
      setSaved(true);
    } catch (caught) {
      setError(message(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-card">
      <div className="panel-header-row">
        <div>
          <p className="eyebrow">{props.t('optionalAi')}</p>
          <h3>OpenRouter</h3>
        </div>
        <span className={config?.keyStored ? 'status-pill tone-success' : 'status-pill tone-muted'}>
          {props.t(config?.keyStored ? 'keySaved' : 'keyMissing')}
        </span>
      </div>
      <p className="muted">{props.t('aiHelp')}</p>
      <p className="muted">{props.t('secretFile')}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || config === undefined}>
          <label htmlFor="openrouter-model">{props.t('modelLabel')}</label>
          <input
            id="openrouter-model"
            value={model}
            onChange={(event) => {
              setModel(event.target.value);
              setSaved(false);
            }}
            placeholder="provider/model"
            required
            maxLength={200}
            aria-describedby="model-help"
          />
          <p id="model-help" className="muted field-help">
            {props.t('modelHelp')}
          </p>
          <label htmlFor="openrouter-key">{props.t('keyLabel')}</label>
          <input
            id="openrouter-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            maxLength={4096}
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setSaved(false);
            }}
            placeholder={config?.keyStored ? '••••••••' : ''}
          />
          <div className="actions">
            <button type="submit">{busy ? props.t('working') : props.t('save')}</button>
            {config?.keyStored ? (
              <button type="button" className="text-button" onClick={() => void save(true)}>
                {props.t('removeKey')}
              </button>
            ) : null}
          </div>
        </fieldset>
      </form>
      {error !== undefined ? (
        <StatusBanner
          tone="error"
          message={error}
          {...(config === undefined
            ? { actionLabel: props.t('retry'), onAction: () => setAttempt((value) => value + 1) }
            : {})}
        />
      ) : null}
      {saved ? <StatusBanner tone="success" message={props.t('settingsSaved')} /> : null}
    </section>
  );
}
