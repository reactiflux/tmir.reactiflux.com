import type { Episode } from "./parse.ts";
import { secondsToTimestamp, timestampToSeconds } from "./slug.ts";

const LAST_CUE_SECONDS = 5;
// Transcript timestamps are whole seconds and two segments can share one (or,
// where an outline drifts, run backwards), which would emit a zero-length or
// reversed cue that players and Transistor reject. One second is the smallest
// duration this format can express, so it's the floor.
const MIN_CUE_SECONDS = 1;

function cueTime(seconds: number): string {
  return `${secondsToTimestamp(seconds)},000`;
}

/** Episode -> SRT with `Speaker: text` cues, one cue per timestamped segment. */
export function toSrt(episode: Episode): string {
  const cues = episode.sections
    .flatMap((section) => section.segments)
    .filter((segment) => segment.time)
    .map((segment) => ({
      start: timestampToSeconds(segment.time!),
      text: segment.speaker
        ? `${segment.speaker}: ${segment.text}`
        : segment.text,
    }));

  return cues
    .map((cue, i) => {
      const end = Math.max(
        cue.start + MIN_CUE_SECONDS,
        cues[i + 1]?.start ?? cue.start + LAST_CUE_SECONDS,
      );
      return `${i + 1}\n${cueTime(cue.start)} --> ${cueTime(end)}\n${cue.text}\n`;
    })
    .join("\n");
}
