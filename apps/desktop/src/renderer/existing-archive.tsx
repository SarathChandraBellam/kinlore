import { useEffect, useRef, useState, type JSX } from 'react';
import { invocationMessage } from './archive-flow.js';
import { Icon } from './components/Icons.js';
import { StatusBanner } from './components/StatusBanner.js';
import type { CopyKey } from './i18n.js';

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
    if (node !== null && typeof node.showModal === 'function' && !node.open) {
      node.showModal();
    }
    return () => {
      if (node !== null && typeof node.close === 'function' && node.open) {
        node.close();
      }
    };
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
      <div className="dialog-header">
        <span className="dialog-badge">
          <Icon name="folder" size={20} />
        </span>
        <div>
          <p className="eyebrow">Kinlore</p>
          <h2 id="existing-title">{props.t('existingTitle')}</h2>
        </div>
      </div>
      <p>{props.t('existingHelp')}</p>
      <div className="path-card">
        <p className="archive-path">{props.rootPath}</p>
      </div>
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
            <Icon name="folder" size={16} />
            {props.t(busy ? 'working' : 'openArchive')}
          </button>
          <button type="button" className="secondary" onClick={props.onChoose}>
            {props.t('chooseFolder')}
          </button>
          <button type="button" className="secondary danger-outline" onClick={props.onReplace}>
            {props.t('replaceArchive')}
          </button>
          <button type="button" className="text-button" onClick={props.onClose}>
            {props.t('cancel')}
          </button>
        </div>
      </fieldset>
      <p className="muted field-help">{props.t('replaceHelp')}</p>
      {error !== undefined ? <StatusBanner tone="error" message={error} /> : null}
    </dialog>
  );
}
