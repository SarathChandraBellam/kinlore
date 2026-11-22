import { useEffect, useState, type JSX } from 'react';
import type { ArchiveStatus, EngineStatus, LibrarySnapshot } from '@kinlore/ipc-contract';
import { OpenRouterSettings } from '../assistance-ui.js';
import { CopyButton } from '../components/CopyButton.js';
import { Icon } from '../components/Icons.js';
import { StatusBanner } from '../components/StatusBanner.js';
import type { RunWorkFn, TranslateFn } from './shared.js';

export function SettingsPage(props: {
  archive: ArchiveStatus;
  library: LibrarySnapshot;
  t: TranslateFn;
  run: RunWorkFn;
  onArchive: (action: 'create' | 'open', folder: boolean) => void;
}): JSX.Element {
  const [passphrase, setPassphrase] = useState('');
  const [recovery, setRecovery] = useState<string>();
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [engineStatus, setEngineStatus] = useState<EngineStatus>();

  useEffect(() => {
    if (typeof window === 'undefined' || window.kinlore?.engineStatus === undefined) {
      return;
    }
    let active = true;
    void window.kinlore
      .engineStatus()
      .then((status) => {
        if (active) setEngineStatus(status);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const statusTone =
    props.archive.rootPath === undefined
      ? 'tone-muted'
      : props.archive.encrypted && props.archive.unlocked
        ? 'tone-success'
        : 'tone-warning';

  const statusKey =
    props.archive.rootPath === undefined
      ? 'statusNoArchive'
      : props.archive.encrypted
        ? props.archive.unlocked
          ? 'statusEncryptedUnlocked'
          : 'statusEncryptedLocked'
        : 'statusLegacy';

  return (
    <div className="settings-grid">
      {/* 1. Archive Location */}
      <section className="panel settings-card">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">01</p>
            <h3>{props.t('archiveLocation')}</h3>
          </div>
          <span className={`status-pill ${statusTone}`}>{props.t(statusKey)}</span>
        </div>
        <div className="path-card">
          <p className="archive-path">{props.archive.rootPath ?? props.t('archiveHelp')}</p>
          {props.archive.rootPath !== undefined ? (
            <CopyButton
              text={props.archive.rootPath}
              label={props.t('copyPath')}
              copiedLabel={props.t('copied')}
            />
          ) : null}
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => props.onArchive('open', true)}>
            <Icon name="folder" size={16} />
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
      </section>

      {/* 2. Encryption & Access */}
      <section className="panel settings-card">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">02</p>
            <h3>{props.t('settingsAccessTitle')}</h3>
          </div>
          {props.archive.encrypted ? (
            <span className="status-pill tone-info">
              <Icon name="shield" size={14} />
              {props.t('encryptedLabel')}
            </span>
          ) : null}
        </div>
        <p className="muted">{props.t('encryptHint')}</p>

        {recovery !== undefined ? (
          <article className="recovery-step">
            <p>{props.t('recovery')}</p>
            <div className="recovery-box">
              <p className="recovery">{recovery}</p>
              <CopyButton
                text={recovery}
                label={props.t('copyKey')}
                copiedLabel={props.t('copied')}
              />
            </div>
            <label className="check-row acknowledge-row">
              <input
                type="checkbox"
                checked={recoveryAcknowledged}
                onChange={(event) => setRecoveryAcknowledged(event.target.checked)}
              />
              <span>{props.t('acknowledgeRecoveryKey')}</span>
            </label>
            <button
              type="button"
              disabled={!recoveryAcknowledged}
              onClick={() => {
                setRecovery(undefined);
                setRecoveryAcknowledged(false);
              }}
            >
              <Icon name="check" size={16} />
              {props.t('savedKey')}
            </button>
          </article>
        ) : null}

        {props.archive.rootPath === undefined ? (
          <StatusBanner tone="info" message={props.t('archiveHelp')} />
        ) : (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void props.run(async () => {
                  if (!props.archive.unlocked) {
                    if (!props.archive.encrypted) {
                      throw new Error(props.t('locked'));
                    }
                    await window.kinlore.unlockArchive(passphrase);
                    setPassphrase('');
                    return;
                  }
                  if (props.archive.encrypted) {
                    await window.kinlore.lockArchive();
                    return;
                  }
                  const result = await window.kinlore.enableEncryption(passphrase);
                  setRecoveryAcknowledged(false);
                  setRecovery(result.recoveryKey);
                  setPassphrase('');
                });
              }}
            >
              {!(props.archive.encrypted && props.archive.unlocked) ? (
                <>
                  <label htmlFor="passphrase">{props.t('passphrase')}</label>
                  <input
                    id="passphrase"
                    type="password"
                    required
                    minLength={props.archive.unlocked && !props.archive.encrypted ? 8 : 1}
                    maxLength={1024}
                    value={passphrase}
                    onChange={(event) => {
                      setPassphrase(event.target.value);
                    }}
                    autoComplete="off"
                  />
                </>
              ) : null}
              <div className="actions">
                {props.archive.unlocked && !props.archive.encrypted ? (
                  <button type="submit">
                    <Icon name="shield" size={16} />
                    {props.t('encrypt')}
                  </button>
                ) : null}
                {props.archive.encrypted && props.archive.unlocked ? (
                  <button type="submit" className="secondary">
                    <Icon name="lock" size={16} />
                    {props.t('lock')}
                  </button>
                ) : null}
                {props.archive.encrypted && !props.archive.unlocked ? (
                  <button type="submit">
                    <Icon name="unlock" size={16} />
                    {props.t('unlock')}
                  </button>
                ) : null}
              </div>
            </form>

            {props.archive.encrypted && !props.archive.unlocked ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void props.run(async () => {
                    await window.kinlore.unlockArchiveWithRecovery(recoveryInput.trim());
                    setRecoveryInput('');
                  });
                }}
              >
                <label htmlFor="recovery">{props.t('recoveryKey')}</label>
                <input
                  id="recovery"
                  name="recovery"
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  autoComplete="off"
                />
                <button type="submit" className="secondary" disabled={recoveryInput.trim() === ''}>
                  <Icon name="unlock" size={16} />
                  {props.t('unlockWithRecovery')}
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>

      {/* 3. Optional OpenRouter Assistance */}
      <OpenRouterSettings t={props.t} />

      {/* 4. Local Engines & Privacy Guarantee */}
      <section className="panel settings-card">
        <div className="panel-header-row">
          <div>
            <p className="eyebrow">04</p>
            <h3>{props.t('settingsLocalEnginesTitle')}</h3>
          </div>
          <span className="status-pill tone-info">
            <Icon name="shield" size={14} />
            {props.t('localOnlyStatus')}
          </span>
        </div>
        <p className="muted">{props.t('privacyGuaranteeBody')}</p>
        <dl className="meta-dl">
          <div>
            <dt>{props.t('speechEngineStatus')}</dt>
            <dd>{props.t('unavailableStatus')}</dd>
          </div>
          <div>
            <dt>{props.t('voiceEngineStatus')}</dt>
            <dd>
              {engineStatus === undefined || engineStatus.voiceEngineId === 'none'
                ? props.t('unavailableStatus')
                : engineStatus.voiceEngineId}
            </dd>
          </div>
        </dl>
        <p className="muted field-help">{props.t('engine')}</p>
        <p className="muted field-help">{props.t('voiceOff')}</p>
      </section>
    </div>
  );
}
