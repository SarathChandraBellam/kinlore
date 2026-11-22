import { useEffect, useRef, type JSX } from 'react';
import { Icon } from './Icons.js';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (node === null || !props.open) return;
    if (typeof node.showModal === 'function' && !node.open) {
      node.showModal();
    }
    return () => {
      if (typeof node.close === 'function' && node.open) {
        node.close();
      }
    };
  }, [props.open]);

  if (!props.open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="archive-dialog confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      onCancel={(event) => {
        event.preventDefault();
        props.onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          props.onCancel();
        }
      }}
    >
      <div className="dialog-header">
        <span className={props.tone === 'danger' ? 'dialog-badge danger' : 'dialog-badge'}>
          <Icon name="alert" size={20} />
        </span>
        <div>
          <h2 id="confirm-dialog-title">{props.title}</h2>
          <p id="confirm-dialog-message" className="muted">
            {props.message}
          </p>
        </div>
      </div>
      <div className="actions dialog-actions">
        <button type="button" className="secondary" autoFocus onClick={props.onCancel}>
          {props.cancelLabel}
        </button>
        <button
          type="button"
          className={props.tone === 'danger' ? 'danger-button' : undefined}
          onClick={props.onConfirm}
        >
          {props.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
