// Native audio controls, nothing more. The [data-seconds] seek listener lives
// in EpisodeBody's SEEK_SCRIPT, on the episode documents that actually render
// timestamps; the home page has no [data-seconds] element to click.
export function Player({
  audioUrl,
  title,
}: {
  audioUrl?: string;
  title: string;
}) {
  if (!audioUrl) return null;
  return (
    <div className="player" data-pagefind-ignore="">
      <audio
        controls
        preload="none"
        src={audioUrl}
        aria-label={`Play ${title}`}
      />
    </div>
  );
}
