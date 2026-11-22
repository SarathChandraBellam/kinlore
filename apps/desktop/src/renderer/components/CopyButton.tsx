import { useEffect, useRef, useState, type JSX } from 'react';
import { Icon } from './Icons.js';

export function CopyButton(props: {
  text: string;
  label: string;
  copiedLabel: string;
  className?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  async function handleCopy(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
        await navigator.clipboard.writeText(props.text);
      }
      setCopied(true);
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={props.className ?? 'secondary copy-button'}
      onClick={() => void handleCopy()}
    >
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      <span>{copied ? props.copiedLabel : props.label}</span>
    </button>
  );
}
