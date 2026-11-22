import { useEffect, useState, type FormEvent, type JSX } from 'react';
import type { PreferredLanguage } from '@kinlore/core';
import type { ArchiveStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { invocationMessage } from '../archive-flow.js';
import { Icon } from '../components/Icons.js';
import { StatusBanner } from '../components/StatusBanner.js';
import { RecordingList } from './MemoriesPage.js';
import { consented, type RunWorkFn, type Section, type TranslateFn } from './shared.js';

export interface HomeProps {
  t: TranslateFn;
  archive: ArchiveStatus;
  library: LibrarySnapshot;
  language?: PreferredLanguage;
  onNavigate: (section: Section) => void;
  onArchive: (action: 'create' | 'open', folder: boolean) => void;
  run?: RunWorkFn;
  onLock?: () => Promise<void>;
}

const WAVE_BARS = [22, 40, 28, 58, 82, 48, 100, 64, 38, 72, 44, 26, 52, 32, 18];

export function HomePage(props: HomeProps): JSX.Element {
  const { t, archive, library } = props;
  const [useRecovery, setUseRecovery] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [unlockError, setUnlockError] = useState<string>();
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (archive.unlocked) {
      setUseRecovery(false);
      setUnlockError(undefined);
    }
  }, [archive.unlocked]);

  const ready = consented(library, 'recording').length > 0;
  const next: Section =
    !archive.encrypted || !archive.unlocked ? 'settings' : ready ? 'interview' : 'people';
  const recentRecordings = [...library.recordings]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3);

  async function executeWork(work: () => Promise<void>): Promise<void> {
    setUnlockError(undefined);
    if (props.run !== undefined) {
      await props.run(work);
      return;
    }
    setUnlocking(true);
    try {
      await work();
    } catch (caught) {
      setUnlockError(invocationMessage(caught));
    } finally {
      setUnlocking(false);
    }
  }

  async function handleUnlockSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (useRecovery) {
      const value = recoveryKey.trim();
      if (value === '') return;
      await executeWork(async () => {
        await window.kinlore.unlockArchiveWithRecovery(value);
        setRecoveryKey('');
        setUseRecovery(false);
      });
      return;
    }
    if (passphrase === '') return;
    await executeWork(async () => {
      await window.kinlore.unlockArchive(passphrase);
      setPassphrase('');
    });
  }

  if (archive.rootPath === undefined) {
    return (
      <div className="home-stack">
        <section className="welcome-hero">
          <div className="hero-copy">
            <p className="eyebrow">{t('firstSteps')}</p>
            <h2>{t('welcomeTitle')}</h2>
            <p>{t('welcomeBody')}</p>
            <div className="actions hero-actions">
              <button type="button" onClick={() => props.onArchive('create', false)}>
                <Icon name="shield" size={18} />
                {t('startArchive')}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => props.onArchive('open', true)}
              >
                <Icon name="folder" size={18} />
                {t('openArchive')}
              </button>
            </div>
            <p className="muted field-help">{t('createStepReady')}</p>
          </div>
          <div className="voice-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="voice-disc">
              <Icon name="mic" size={44} />
            </div>
            <div className="voice-wave">
              {WAVE_BARS.map((height, index) => (
                <i key={index} style={{ height }} />
              ))}
            </div>
          </div>
        </section>

        <div className="journey-grid">
          {[
            {
              icon: 'people' as const,
              title: 'familySpace' as const,
              body: 'firstPersonHelp' as const,
            },
            { icon: 'mic' as const, title: 'recordStory' as const, body: 'recordingHelp' as const },
            {
              icon: 'book' as const,
              title: 'memoriesSpace' as const,
              body: 'privateHelp' as const,
            },
          ].map((item, index) => (
            <article key={item.title} className="journey-card">
              <div className="journey-card-top">
                <span className="journey-icon">
                  <Icon name={item.icon} size={20} />
                </span>
                <span className="step-number">0{index + 1}</span>
              </div>
              <h3>{t(item.title)}</h3>
              <p>{t(item.body)}</p>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (archive.encrypted && !archive.unlocked) {
    return (
      <div className="home-stack">
        <section className="panel unlock-hero-card">
          <div className="panel-header-row">
            <span className="status-pill tone-warning">
              <Icon name="lock" size={14} />
              {t('statusEncryptedLocked')}
            </span>
            <span className="archive-path muted">{archive.rootPath}</span>
          </div>
          <h2>{t('unlockHomeTitle')}</h2>
          <p className="muted">{t('unlockHomeBody')}</p>
          <form onSubmit={(event) => void handleUnlockSubmit(event)}>
            <fieldset disabled={unlocking}>
              {useRecovery ? (
                <>
                  <label htmlFor="home-recovery-key">{t('recoveryKey')}</label>
                  <input
                    id="home-recovery-key"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    required
                    value={recoveryKey}
                    onChange={(event) => setRecoveryKey(event.target.value)}
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <label htmlFor="home-passphrase">{t('passphrase')}</label>
                  <input
                    id="home-passphrase"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={passphrase}
                    onChange={(event) => setPassphrase(event.target.value)}
                    autoFocus
                  />
                </>
              )}
              <div className="actions">
                <button type="submit">
                  <Icon name="unlock" size={16} />
                  {t(useRecovery ? 'unlockWithRecovery' : 'unlock')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setUseRecovery((current) => !current);
                    setUnlockError(undefined);
                  }}
                >
                  {t(useRecovery ? 'usePassphrase' : 'useRecoveryKey')}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => props.onArchive('open', true)}
                >
                  <Icon name="folder" size={16} />
                  {t('chooseFolder')}
                </button>
              </div>
            </fieldset>
          </form>
          {unlockError !== undefined ? <StatusBanner tone="error" message={unlockError} /> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="home-stack">
      <section className="panel archive-status-bar">
        <div className="archive-status-info">
          <span
            className={archive.encrypted ? 'status-pill tone-success' : 'status-pill tone-warning'}
          >
            <Icon name={archive.encrypted ? 'shield' : 'alert'} size={14} />
            {t(archive.encrypted ? 'statusEncryptedUnlocked' : 'statusLegacy')}
          </span>
          <span className="archive-path">{archive.rootPath}</span>
        </div>
        <div className="actions">
          {archive.encrypted ? (
            <button
              type="button"
              className="secondary"
              onClick={() => {
                if (props.onLock !== undefined) {
                  void props.onLock();
                  return;
                }
                void executeWork(async () => {
                  await window.kinlore.lockArchive();
                });
              }}
            >
              <Icon name="lock" size={16} />
              {t('lock')}
            </button>
          ) : (
            <button type="button" onClick={() => props.onNavigate('settings')}>
              <Icon name="shield" size={16} />
              {t('encrypt')}
            </button>
          )}
        </div>
      </section>

      {!archive.encrypted ? (
        <StatusBanner
          tone="warning"
          title={t('encryptionRequired')}
          message={t('encryptionRequiredHelp')}
          actionLabel={t('goToSettings')}
          onAction={() => props.onNavigate('settings')}
        />
      ) : null}

      <div className="metric-grid">
        {(
          [
            {
              target: 'people' as const,
              value: library.people.length,
              label: 'peopleCount' as const,
              icon: 'people' as const,
            },
            {
              target: 'library' as const,
              value: library.recordings.length,
              label: 'recordingsCount' as const,
              icon: 'mic' as const,
            },
            {
              target: 'stories' as const,
              value: library.stories.length,
              label: 'storiesCount' as const,
              icon: 'story' as const,
            },
            {
              target: 'keepsakes' as const,
              value: library.keepsakes.length,
              label: 'keepsakesCount' as const,
              icon: 'photo' as const,
            },
          ] as const
        ).map((item) => (
          <button
            type="button"
            key={item.label}
            className="metric-card"
            onClick={() => props.onNavigate(item.target)}
          >
            <span className="metric-icon">
              <Icon name={item.icon} size={18} />
            </span>
            <strong className="tabular">{item.value.toString().padStart(2, '0')}</strong>
            <span>{t(item.label)}</span>
          </button>
        ))}
      </div>

      <div className="home-action-grid">
        <section className="panel next-step-card">
          <p className="eyebrow">{t('nextStep')}</p>
          <h3>
            {t(!archive.encrypted ? 'encryptionRequired' : ready ? 'beginTitle' : 'addFirstPerson')}
          </h3>
          <p className="muted">
            {t(
              !archive.encrypted
                ? 'encryptionRequiredHelp'
                : ready
                  ? 'beginBody'
                  : 'firstPersonHelp',
            )}
          </p>
          <div className="actions">
            <button type="button" onClick={() => props.onNavigate(next)}>
              <Icon name={ready ? 'mic' : 'people'} size={16} />
              {t(!archive.encrypted ? 'encrypt' : ready ? 'recordStory' : 'addPerson')}
            </button>
          </div>
        </section>

        <section className="panel quick-actions-card">
          <p className="eyebrow">{t('quickActions')}</p>
          <div className="quick-actions-list">
            <button
              type="button"
              className="secondary"
              disabled={!archive.encrypted}
              onClick={() => props.onNavigate('interview')}
            >
              <Icon name="mic" size={16} />
              {t('recordStory')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!archive.encrypted}
              onClick={() => props.onNavigate('library')}
            >
              <Icon name="upload" size={16} />
              {t('importFilesAction')}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!archive.encrypted}
              onClick={() => props.onNavigate('ask')}
            >
              <Icon name="search" size={16} />
              {t('askQuestionAction')}
            </button>
          </div>
        </section>
      </div>

      <section className="recent-memories-block">
        <div className="section-heading">
          <h3>{t('recentMemories')}</h3>
          {library.recordings.length > 0 ? (
            <button
              type="button"
              className="text-button"
              onClick={() => props.onNavigate('library')}
            >
              {t('viewMemories')}
              <Icon name="chevron" size={16} />
            </button>
          ) : null}
        </div>
        {recentRecordings.length > 0 ? (
          <RecordingList
            library={{ ...library, recordings: recentRecordings }}
            t={t}
            {...(props.language === undefined ? {} : { language: props.language })}
          />
        ) : (
          <section className="empty-state panel">
            <Icon name="book" size={28} />
            <h3>{t(library.people.length === 0 ? 'addFirstPerson' : 'beginTitle')}</h3>
            <p>{t(library.people.length === 0 ? 'firstPersonHelp' : 'beginBody')}</p>
            <button type="button" className="secondary" onClick={() => props.onNavigate(next)}>
              {t(ready ? 'recordStory' : 'addPerson')}
            </button>
          </section>
        )}
      </section>
    </div>
  );
}

export { HomePage as Home };
