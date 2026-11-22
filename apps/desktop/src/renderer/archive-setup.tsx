import { useEffect, useRef, useState, type JSX } from 'react';
import type { EncryptedArchiveResult } from '@kinlore/ipc-contract';
import { invocationMessage } from './archive-flow.js';
import { CopyButton } from './components/CopyButton.js';
import { Icon } from './components/Icons.js';
import { StatusBanner } from './components/StatusBanner.js';
import type { CopyKey } from './i18n.js';

export function ArchiveSetup(props: {
  t: (key: CopyKey) => string;
  onCreate: (passphrase: string) => Promise<EncryptedArchiveResult>;
  onClose: (created: boolean) => void;
  replacing?: boolean;
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recovery, setRecovery] = useState<string>();
  const [backupPath, setBackupPath] = useState<string>();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const element = dialog.current;
    if (element !== null && typeof element.showModal === 'function' && !element.open) {
      element.showModal();
    }
    return () => {
      if (element !== null && typeof element.close === 'function' && element.open) {
        element.close();
      }
    };
  }, []);

  async function create(): Promise<void> {
    if (inFlight.current) return;
    if (passphrase !== confirm) {
      setError(props.t('passphraseMismatch'));
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await props.onCreate(passphrase);
      setPassphrase('');
      setConfirm('');
      setAcknowledged(false);
      setRecovery(result.recoveryKey);
      setBackupPath(result.backupPath);
    } catch (caught) {
      setError(invocationMessage(caught));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="archive-dialog"
      aria-labelledby="archive-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy && recovery === undefined) props.onClose(false);
      }}
    >
      <div className="dialog-header">
        <span className="dialog-badge">
          <Icon name="shield" size={20} />
        </span>
        <div>
          <p className="eyebrow">Kinlore · {props.t('encryptedLabel')}</p>
          <h2 id="archive-dialog-title">
            {props.t(recovery === undefined ? 'protectArchive' : 'recoveryTitle')}
          </h2>
        </div>
      </div>
      {recovery === undefined ? (
        <>
          <p className="muted">{props.t(props.replacing ? 'replaceHelp' : 'protectHelp')}</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void create();
            }}
          >
            <fieldset disabled={busy}>
              <label htmlFor="new-passphrase">{props.t('passphrase')}</label>
              <input
                id="new-passphrase"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={1024}
                required
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                autoFocus
              />
              <label htmlFor="confirm-passphrase">{props.t('confirmPassphrase')}</label>
              <input
                id="confirm-passphrase"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
              <p className="muted field-help">{props.t('passphraseHelp')}</p>
              <div className="actions dialog-actions">
                <button type="submit">
                  <Icon name="lock" size={16} />
                  {props.t(
                    busy ? 'working' : props.replacing ? 'replaceArchive' : 'createEncrypted',
                  )}
                </button>
                <button type="button" className="text-button" onClick={() => props.onClose(false)}>
                  {props.t('cancel')}
                </button>
              </div>
            </fieldset>
          </form>
        </>
      ) : (
        <div className="recovery-step">
          <p>{props.t('recovery')}</p>
          {backupPath !== undefined ? (
            <div className="path-card">
              <p className="muted">{props.t('backupSaved')}</p>
              <p className="archive-path">{backupPath}</p>
            </div>
          ) : null}
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
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>{props.t('acknowledgeRecoveryKey')}</span>
          </label>
          <div className="actions dialog-actions">
            <button type="button" disabled={!acknowledged} onClick={() => props.onClose(true)}>
              <Icon name="check" size={16} />
              {props.t('savedKey')}
            </button>
          </div>
        </div>
      )}
      {error !== undefined ? <StatusBanner tone="error" message={error} /> : null}
    </dialog>
  );
}
