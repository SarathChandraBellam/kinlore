import type { JSX, ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'people'
  | 'mic'
  | 'book'
  | 'settings'
  | 'lock'
  | 'unlock'
  | 'shield'
  | 'search'
  | 'upload'
  | 'photo'
  | 'sparkle'
  | 'calendar'
  | 'recipe'
  | 'story'
  | 'seal'
  | 'copy'
  | 'check'
  | 'alert'
  | 'folder'
  | 'close'
  | 'pause'
  | 'play'
  | 'stop'
  | 'chevron';

function renderPaths(name: IconName): ReactNode {
  switch (name) {
    case 'home':
      return <path d="M3 10.5 12 3l9 7.5M5 9.5V21h5.5v-6.5h3V21H19V9.5" />;
    case 'people':
      return (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
    case 'mic':
      return (
        <>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
          <path d="M12 19v3M8 22h8" />
        </>
      );
    case 'book':
      return (
        <path d="M12 6C8.5 3.5 4.5 3.8 2 5v15c3-1.2 6.8-1 10 1 3.2-2 7-2.2 10-1V5c-2.5-1.2-6.5-1.5-10 1v15" />
      );
    case 'settings':
      return (
        <>
          <path d="M4 7h16M4 17h16M9 4v6M15 14v6" />
        </>
      );
    case 'lock':
      return (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      );
    case 'unlock':
      return (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 7.6-1.7" />
        </>
      );
    case 'shield':
      return (
        <>
          <path d="M12 3 4 6.5v5.3c0 4.8 3.4 8.7 8 10.2 4.6-1.5 8-5.4 8-10.2V6.5L12 3Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case 'search':
      return (
        <>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </>
      );
    case 'upload':
      return (
        <>
          <path d="M12 15V4m0 0-4 4m4-4 4 4" />
          <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </>
      );
    case 'photo':
      return (
        <>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </>
      );
    case 'sparkle':
      return (
        <path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6.5 12 .9 2.1L21.5 18l-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
      );
    case 'calendar':
      return (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </>
      );
    case 'recipe':
      return (
        <>
          <path d="M6 4v7a3 3 0 0 0 6 0V4M9 4v17M18 4v17M15 9h3" />
        </>
      );
    case 'story':
      return (
        <>
          <path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v5h5M8 12h7M8 16h5" />
        </>
      );
    case 'seal':
      return (
        <>
          <circle cx="12" cy="10" r="5" />
          <path d="m9.5 14.5-1.5 6.5 4-2 4 2-1.5-6.5" />
        </>
      );
    case 'copy':
      return (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </>
      );
    case 'check':
      return <path d="m5 12.5 4.2 4.2L19 7" />;
    case 'alert':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16.5h.01" />
        </>
      );
    case 'folder':
      return (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      );
    case 'close':
      return <path d="m6 6 12 12M18 6 6 18" />;
    case 'pause':
      return (
        <>
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </>
      );
    case 'play':
      return <path d="M7 5v14l11-7-11-7Z" />;
    case 'stop':
      return <rect x="6" y="6" width="12" height="12" rx="2" />;
    case 'chevron':
      return <path d="m9 6 6 6-6 6" />;
  }
}

export function Icon(props: { name: IconName; size?: number; className?: string }): JSX.Element {
  const size = props.size ?? 20;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      {renderPaths(props.name)}
    </svg>
  );
}
