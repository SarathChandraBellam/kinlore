import { useEffect, useReducer, useRef, useState, type JSX } from 'react';
import type { InterviewPrompt, PreferredLanguage } from '@kinlore/core';
import type { LibrarySnapshot } from '@kinlore/ipc-contract';
import { LlmAssist, SourcePicker } from '../assistance-ui.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { Icon } from '../components/Icons.js';
import { StatusBanner } from '../components/StatusBanner.js';
import { EMPTY_TAKE, takeReducer } from '../experience-state.js';
import { blobToBase64, extensionFor } from '../recording.js';
import { consented, type RunWorkFn, type TranslateFn } from './shared.js';

export function RecordPage(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
  onDirtyChange: (dirty: boolean) => void;
  onMemories: () => void;
  onGoFamily?: () => void;
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
  const [paused, setPaused] = useState(false);
  const [canPause, setCanPause] = useState(false);
  const [starting, setStarting] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [saved, setSaved] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [persona, setPersona] = useState('');
  const [sources, setSources] = useState<string[]>([]);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const mounted = useRef(true);
  const accumulatedMs = useRef(0);
  const segmentStartedAt = useRef(0);
  const pausedRef = useRef(false);
  const requesting = useRef(false);
  const takeGeneration = useRef(0);

  const dirty = recording || blob !== undefined || starting;
  const effectivePersonId = people.some((person) => person.id === personId)
    ? personId
    : (people[0]?.id ?? '');

  useEffect(() => {
    if (people.length === 0) {
      if (personId !== '') setPersonId('');
      return;
    }
    if (!people.some((person) => person.id === personId)) {
      setPersonId(people[0]?.id ?? '');
    }
  }, [people, personId]);

  useEffect(() => {
    props.onDirtyChange(dirty);
    return () => props.onDirtyChange(false);
  }, [dirty, props.onDirtyChange]);

  function stopMeter(): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current !== null) {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setMicLevel(0);
  }

  function startMeter(mediaStream: MediaStream): void {
    stopMeter();
    try {
      const AudioCtx = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
      if (AudioCtx === undefined) return;
      const context = new AudioCtx();
      const source = context.createMediaStreamSource(mediaStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = context;
      const samples = new Uint8Array(analyser.frequencyBinCount);

      const sampleFrame = (): void => {
        if (!mounted.current || recorder.current === null) return;
        if (pausedRef.current) {
          setMicLevel(0);
        } else {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (const sample of samples) {
            const centered = (sample - 128) / 128;
            sumSquares += centered * centered;
          }
          const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
          const level = Math.min(100, Math.round(rms * 280));
          setMicLevel(level);
        }
        rafRef.current = requestAnimationFrame(sampleFrame);
      };
      rafRef.current = requestAnimationFrame(sampleFrame);
    } catch {
      stopMeter();
    }
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      takeGeneration.current += 1;
      if (recorder.current !== null && recorder.current.state !== 'inactive') {
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stopMeter();
    };
  }, []);

  useEffect(() => {
    if (blob === undefined) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blob]);

  useEffect(() => {
    if (!recording || paused) return;
    const tick = window.setInterval(() => {
      const elapsed = accumulatedMs.current + (Date.now() - segmentStartedAt.current);
      setSeconds(Math.floor(elapsed / 1000));
    }, 250);
    return () => window.clearInterval(tick);
  }, [recording, paused]);

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
    if (
      requesting.current ||
      (recorder.current !== null && recorder.current.state !== 'inactive')
    ) {
      return;
    }
    requesting.current = true;
    const generation = ++takeGeneration.current;
    setStarting(true);
    setSaved(false);
    setPaused(false);
    pausedRef.current = false;
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
      const supportsPause = typeof media.pause === 'function' && typeof media.resume === 'function';
      setCanPause(supportsPause);
      const chunks: Blob[] = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      media.onstop = () => {
        mediaStream?.getTracks().forEach((track) => track.stop());
        stopMeter();
        if (!mounted.current || generation !== takeGeneration.current) return;
        const totalDuration = pausedRef.current
          ? accumulatedMs.current
          : accumulatedMs.current + (Date.now() - segmentStartedAt.current);
        recorder.current = null;
        setRecording(false);
        setPaused(false);
        pausedRef.current = false;
        setDuration(Math.max(0, totalDuration));
        setBlob(new Blob(chunks, { type: media.mimeType || 'audio/webm' }));
      };
      media.onerror = () => {
        mediaStream?.getTracks().forEach((track) => track.stop());
        stopMeter();
        if (mounted.current && generation === takeGeneration.current) {
          recorder.current = null;
          setRecording(false);
          setPaused(false);
          pausedRef.current = false;
          dispatchTake({ type: 'failed', message: props.t('captureFailed') });
        }
      };
      media.start();
      recorder.current = media;
      accumulatedMs.current = 0;
      segmentStartedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
      startMeter(mediaStream);
    } catch (error) {
      mediaStream?.getTracks().forEach((track) => track.stop());
      stopMeter();
      throw error;
    } finally {
      requesting.current = false;
      if (mounted.current) setStarting(false);
    }
  }

  function togglePause(): void {
    const media = recorder.current;
    if (media === null || !canPause) return;
    if (media.state === 'recording') {
      media.pause();
      accumulatedMs.current += Date.now() - segmentStartedAt.current;
      pausedRef.current = true;
      setPaused(true);
      setSeconds(Math.floor(accumulatedMs.current / 1000));
    } else if (media.state === 'paused') {
      media.resume();
      segmentStartedAt.current = Date.now();
      pausedRef.current = false;
      setPaused(false);
    }
  }

  const activePrompt = prompts.find((prompt) => prompt.text === question);
  const request = {
    task: 'interview' as const,
    language: props.language,
    ...(effectivePersonId === '' ? {} : { personId: effectivePersonId }),
    ...(question.trim() === '' ? {} : { question: question.trim() }),
    ...(persona.trim() === '' ? {} : { persona: persona.trim() }),
    recordingIds: sources,
  };

  if (people.length === 0) {
    return (
      <section className="empty-state panel">
        <Icon name="people" size={30} />
        <h3>{props.t('consentNeeded')}</h3>
        <p>{props.t('firstPersonHelp')}</p>
        {props.onGoFamily !== undefined ? (
          <button type="button" onClick={props.onGoFamily}>
            <Icon name="people" size={16} />
            {props.t('goToFamily')}
          </button>
        ) : null}
      </section>
    );
  }

  const currentStep = blob !== undefined ? 2 : recording ? 1 : 0;

  return (
    <section className="record-workspace">
      <ConfirmDialog
        open={confirmDiscardOpen}
        title={props.t('discard')}
        message={props.t('discardRecording')}
        confirmLabel={props.t('discard')}
        cancelLabel={props.t('cancel')}
        tone="danger"
        onCancel={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          setBlob(undefined);
          setPreview(undefined);
          setSeconds(0);
        }}
      />

      <ol className="record-steps">
        {(['setup', 'capture', 'review'] as const).map((step, index) => {
          const isCurrent = currentStep === index;
          const isComplete = currentStep > index;
          return (
            <li key={step} className={isCurrent ? 'active' : isComplete ? 'complete' : undefined}>
              <span>{isComplete ? <Icon name="check" size={13} /> : index + 1}</span>
              {props.t(step)}
            </li>
          );
        })}
      </ol>

      {saved ? (
        <div className="saved-moment panel" role="status">
          <span className="saved-check" aria-hidden="true">
            <Icon name="check" size={22} />
          </span>
          <h3>{props.t('savedRecording')}</h3>
          <p className="muted">{props.t('recordingSavedHelp')}</p>
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
            value={effectivePersonId}
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

          {captureError !== undefined ? <StatusBanner tone="error" message={captureError} /> : null}

          <div
            className={
              recording
                ? paused
                  ? 'record-station is-paused'
                  : 'record-station is-recording'
                : 'record-station'
            }
          >
            <div className="mic-orbit">
              <Icon name="mic" size={28} />
            </div>
            <p role="status">
              {props.t(
                recording
                  ? paused
                    ? 'recordingPaused'
                    : 'recordingNow'
                  : blob !== undefined
                    ? 'review'
                    : 'readyRecord',
              )}
            </p>
            <strong className="record-timer tabular">
              {Math.floor(seconds / 60)
                .toString()
                .padStart(2, '0')}
              :{(seconds % 60).toString().padStart(2, '0')}
            </strong>
            {recording ? (
              <div
                className="mic-meter"
                role="meter"
                aria-label={props.t('micLevelLabel')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={micLevel}
              >
                <div className="mic-meter-fill" style={{ width: `${micLevel}%` }} />
              </div>
            ) : null}
            <div className="actions">
              {recording ? (
                <>
                  {canPause ? (
                    <button type="button" className="secondary" onClick={togglePause}>
                      <Icon name={paused ? 'play' : 'pause'} size={16} />
                      {props.t(paused ? 'resume' : 'pause')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="stop-button"
                    onClick={() => {
                      if (recorder.current !== null && recorder.current.state !== 'inactive') {
                        recorder.current.stop();
                      }
                    }}
                  >
                    <Icon name="stop" size={16} />
                    {props.t('stop')}
                  </button>
                </>
              ) : blob === undefined ? (
                <button
                  type="button"
                  className="record-button"
                  disabled={starting || effectivePersonId === ''}
                  onClick={() => void props.run(start)}
                >
                  <Icon name="mic" size={16} />
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
              <p id="words-help" className="muted field-help">
                {props.t('wordsHelp')}
              </p>
              <div className="actions">
                <button
                  type="button"
                  onClick={() =>
                    void props.run(async () => {
                      if (blob.size === 0) {
                        throw new Error('No audio was captured. Please record again.');
                      }
                      await window.kinlore.saveCapturedAnswer({
                        personId: effectivePersonId,
                        language: props.language,
                        question: question.trim() || props.t('untitledStory'),
                        spokenWords: words.trim(),
                        mediaBase64: await blobToBase64(blob),
                        extension: extensionFor(blob),
                        durationMs: duration,
                        ...(activePrompt === undefined || activePrompt.id.startsWith('ai-')
                          ? {}
                          : { promptId: activePrompt.id }),
                      });
                      setBlob(undefined);
                      setPreview(undefined);
                      setWords('');
                      setSaved(true);
                      setSeconds(0);
                    })
                  }
                >
                  <Icon name="check" size={16} />
                  {props.t('saveRecording')}
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirmDiscardOpen(true)}
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
          <section className="question-card panel">
            <p className="eyebrow">{props.t('promptIdea')}</p>
            <h3>{props.t('beginTitle')}</h3>
            <p className="muted">{props.t('beginBody')}</p>
            <button
              type="button"
              className="secondary"
              disabled={recording || starting}
              onClick={() =>
                void props.run(
                  async () => {
                    const next = await window.kinlore.nextPrompts({
                      language: props.language,
                      personId: effectivePersonId,
                    });
                    setPrompts(next);
                  },
                  { silent: true },
                )
              }
            >
              <Icon name="book" size={16} />
              {props.t('localQuestions')}
            </button>
            <div className="question-deck">
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
                  <div className="question-option-body">
                    <span className="pill-badge">{prompt.topic}</span>
                    <span>{prompt.text}</span>
                  </div>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
          </section>

          {!dirty ? (
            <section className="panel persona-panel">
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
              <p id="persona-help" className="muted field-help">
                {props.t('personaHelp')}
              </p>
              <SourcePicker
                library={props.library}
                value={sources}
                onChange={setSources}
                personId={effectivePersonId}
                t={props.t}
              />
              <LlmAssist
                key={JSON.stringify(request)}
                request={request}
                library={props.library}
                t={props.t}
                onResult={(result) => {
                  if (result.task === 'interview') {
                    setPrompts(
                      result.questions.map((text, index) => ({
                        id: `ai-${index}`,
                        language: props.language,
                        topic: props.t('tailoredSuggestions'),
                        text,
                      })),
                    );
                  }
                }}
              />
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
