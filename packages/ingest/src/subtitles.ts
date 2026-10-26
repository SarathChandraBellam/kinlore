export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

function timestampToMs(value: string): number {
  const match = /^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(value.trim());
  if (match === null) {
    throw new Error('Subtitle timestamp is invalid');
  }
  const hours = Number(match[1] ?? '0');
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const fraction = match[4] ?? '0';
  const millis = Number(fraction.padEnd(3, '0'));
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function cuesFromBlocks(blocks: string[]): Cue[] {
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== '' && line !== 'WEBVTT');
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) {
      continue;
    }
    const timing = lines[timingIndex];
    if (timing === undefined) {
      continue;
    }
    const [start, end] = timing.split('-->').map((part) => part.trim().split(/\s+/)[0] ?? '');
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .trim();
    if (start === undefined || end === undefined || text === '') {
      continue;
    }
    cues.push({ startMs: timestampToMs(start), endMs: timestampToMs(end), text });
  }
  if (cues.length === 0) {
    throw new Error('Subtitle file has no cues');
  }
  return cues;
}

export function parseSubtitles(contents: string): Cue[] {
  const trimmed = contents.replace(/^\uFEFF/, '').trim();
  if (trimmed === '') {
    throw new Error('Subtitle file has no cues');
  }
  return cuesFromBlocks(trimmed.split(/\r?\n\r?\n/));
}
