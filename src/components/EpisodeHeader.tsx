import { hms } from "../content/time.ts";
import { enhanceEpisodeHeader } from "./episode-player.ts";

export { PLAYER_SCRIPT } from "./episode-player.ts";

/** Shared player markup; native controls remain available before enhancement. */
export function EpisodeHeader({
  audioUrl,
  title,
  duration,
}: {
  audioUrl?: string;
  title: string;
  duration?: number;
}) {
  if (!audioUrl) return null;
  return (
    <div
      ref={enhanceEpisodeHeader}
      className="episode-header"
      data-pagefind-ignore=""
    >
      <audio
        controls
        preload="none"
        src={audioUrl}
        aria-label={`Listen to ${title}`}
      />
      <div className="episode-controls" hidden>
        <button
          type="button"
          className="episode-play"
          aria-label="Play episode"
        >
          ▶
        </button>
        <span className="playback-time">
          <span data-elapsed="">0:00</span> /{" "}
          <span data-duration="">
            {duration !== undefined ? hms(duration) : "—"}
          </span>
        </span>
        <input
          className="episode-progress"
          type="range"
          min="0"
          max={duration || 0}
          step="1"
          defaultValue="0"
          aria-label="Playback position"
        />
        <button
          type="button"
          className="episode-speed"
          aria-label="Playback speed: 1 times"
        >
          1×
        </button>
        <a className="audio-download" href={audioUrl}>
          Audio ↗
        </a>
      </div>
      <p className="playback-status" role="status" hidden />
    </div>
  );
}
