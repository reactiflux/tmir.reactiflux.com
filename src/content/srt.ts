import type { Episode } from "./parse.ts";
import { secondsToTimestamp, timestampToSeconds } from "./slug.ts";

const LAST_CUE_SECONDS = 5;

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
      text: segment.speaker ? `${segment.speaker}: ${segment.text}` : segment.text,
    }));

  return cues
    .map((cue, i) => {
      const end = cues[i + 1]?.start ?? cue.start + LAST_CUE_SECONDS;
      return `${i + 1}\n${cueTime(cue.start)} --> ${cueTime(end)}\n${cue.text}\n`;
    })
    .join("\n");
}
