import { useEffect, useRef, useState, type JSX } from 'react';
import type { CopyKey } from './i18n.js';
import { invocationMessage } from './archive-flow.js';

export function ExistingArchive(props: {
  rootPath: string;
  t: (key: CopyKey) => string;
  onOpen: () => Promise<void>;
  onChoose: () => void;
  onReplace: () => void;
  onClose: () => void;
}): JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="archive-dialog"
      aria-labelledby="existing-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) props.onClose();
      }}
    >
      <p className="eyebrow">Kinlore</p>
      <h2 id="existing-title">{props.t('existingTitle')}</h2>
      <p>{props.t('existingHelp')}</p>
      <p className="archive-path">{props.rootPath}</p>
      <fieldset disabled={busy}>
        <div className="existing-actions">
          <button
            type="button"
            autoFocus
            onClick={() => {
              if (busy) return;
              setBusy(true);
              setError(undefined);
              void props.onOpen().catch((caught: unknown) => {
                setError(invocationMessage(caught));
                setBusy(false);
              });
            }}
          >
            {props.t(busy ? 'working' : 'openArchive')}
          </button>
          <button type="button" className="secondary" onClick={props.onChoose}>
            {props.t('chooseFolder')}
          </button>
          <button type="button" className="secondary" onClick={props.onReplace}>
            {props.t('replaceArchive')}
          </button>
          <button type="button" className="text-button" onClick={props.onClose}>
            {props.t('cancel')}
          </button>
        </div>
      </fieldset>
      <p className="muted">{props.t('replaceHelp')}</p>
      {error !== undefined ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </dialog>
  );
}
