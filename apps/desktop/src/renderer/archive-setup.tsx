import { useEffect, useRef, useState, type JSX } from 'react';
import type { EncryptedArchiveResult } from '@kinlore/ipc-contract';
import { invocationMessage } from './archive-flow.js';
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
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
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
      <p className="eyebrow">Kinlore · {props.t('encryptedLabel')}</p>
      <h2 id="archive-dialog-title">
        {props.t(recovery === undefined ? 'protectArchive' : 'recoveryTitle')}
      </h2>
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
              <p className="muted">{props.t('passphraseHelp')}</p>
              <div className="actions">
                <button type="submit">
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
        <>
          <p>{props.t('recovery')}</p>
          {backupPath !== undefined ? (
            <>
              <p>{props.t('backupSaved')}</p>
              <p className="archive-path">{backupPath}</p>
            </>
          ) : null}
          <p className="recovery">{recovery}</p>
          <button type="button" onClick={() => props.onClose(true)}>
            {props.t('savedKey')}
          </button>
        </>
      )}
      {error !== undefined ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </dialog>
  );
}
