import type { JSX, SyntheticEvent } from 'react';

const VIDEO_EXT_PATTERN = /\.(mp4|mov|mkv)(?:[?#].*)?$/i;

export interface MediaPlayerProps {
  src: string;
  mediaRelativePath?: string;
  title?: string;
  startMs?: number;
  endMs?: number;
}

export function isVideoMediaPath(pathOrUrl: string): boolean {
  return VIDEO_EXT_PATTERN.test(pathOrUrl);
}

export function MediaPlayer(props: MediaPlayerProps): JSX.Element {
  const startMs = props.startMs ?? 0;
  const endMs = props.endMs ?? 0;
  const isVideo = isVideoMediaPath(props.mediaRelativePath ?? props.src);

  function handleLoadedMetadata(event: SyntheticEvent<HTMLMediaElement>): void {
    if (startMs > 0) {
      event.currentTarget.currentTime = startMs / 1000;
    }
  }

  function handlePlay(event: SyntheticEvent<HTMLMediaElement>): void {
    const media = event.currentTarget;
    const currentMs = media.currentTime * 1000;
    if (startMs > 0 && currentMs < startMs) {
      media.currentTime = startMs / 1000;
    } else if (endMs > startMs && currentMs >= endMs) {
      media.currentTime = startMs / 1000;
    }
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLMediaElement>): void {
    if (endMs > startMs && event.currentTarget.currentTime * 1000 >= endMs) {
      event.currentTarget.pause();
    }
  }

  if (isVideo) {
    return (
      <video
        className="media-player media-video"
        src={props.src}
        controls
        preload="metadata"
        aria-label={props.title}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handlePlay}
        onTimeUpdate={handleTimeUpdate}
      />
    );
  }

  return (
    <audio
      className="media-player media-audio"
      src={props.src}
      controls
      preload="metadata"
      aria-label={props.title}
      onLoadedMetadata={handleLoadedMetadata}
      onPlay={handlePlay}
      onTimeUpdate={handleTimeUpdate}
    />
  );
}
