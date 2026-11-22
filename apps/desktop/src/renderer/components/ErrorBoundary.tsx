import { Component, type ErrorInfo, type JSX, type ReactNode } from 'react';
import { Icon } from './Icons.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  body?: string;
  reloadLabel?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export function ErrorFallback(props: {
  title: string;
  body: string;
  reloadLabel: string;
  onReload: () => void;
}): JSX.Element {
  return (
    <div className="error-boundary-shell" role="alert">
      <section className="panel error-boundary-card">
        <span className="dialog-badge danger">
          <Icon name="alert" size={22} />
        </span>
        <h2>{props.title}</h2>
        <p className="muted">{props.body}</p>
        <div className="actions">
          <button type="button" onClick={props.onReload}>
            {props.reloadLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally omit logging archive state or user details.
  }

  private handleReload = (): void => {
    this.setState({ hasError: false });
    if (this.props.onReset !== undefined) {
      this.props.onReset();
      return;
    }
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
    }
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          title={this.props.title ?? 'Something unexpected happened'}
          body={
            this.props.body ??
            'Your archive files remain safely on your computer. Reload this view to continue.'
          }
          reloadLabel={this.props.reloadLabel ?? 'Reload view'}
          onReload={this.handleReload}
        />
      );
    }
    return this.props.children;
  }
}
