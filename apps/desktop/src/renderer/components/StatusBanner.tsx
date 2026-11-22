import type { JSX } from 'react';
import { Icon, type IconName } from './Icons.js';

export type BannerTone = 'info' | 'success' | 'error' | 'warning';

export interface StatusBannerProps {
  tone: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
  className?: string;
}

const TONE_ICON: Record<BannerTone, IconName> = {
  info: 'shield',
  success: 'check',
  error: 'alert',
  warning: 'alert',
};

export function StatusBanner(props: StatusBannerProps): JSX.Element {
  const role = props.tone === 'error' || props.tone === 'warning' ? 'alert' : 'status';
  const classes = ['status-banner', `tone-${props.tone}`, props.className ?? '']
    .filter((item) => item !== '')
    .join(' ');
  return (
    <section className={classes} role={role}>
      <span className="banner-icon" aria-hidden="true">
        <Icon name={TONE_ICON[props.tone]} size={18} />
      </span>
      <div className="banner-body">
        {props.title !== undefined ? <h3>{props.title}</h3> : null}
        <p>{props.message}</p>
      </div>
      {props.actionLabel !== undefined && props.onAction !== undefined ? (
        <button type="button" className="secondary banner-action" onClick={props.onAction}>
          {props.actionLabel}
        </button>
      ) : null}
      {props.onDismiss !== undefined ? (
        <button
          type="button"
          className="icon-button banner-dismiss"
          aria-label={props.dismissLabel ?? 'Dismiss'}
          onClick={props.onDismiss}
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </section>
  );
}
