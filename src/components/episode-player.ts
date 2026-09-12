/** Self-contained so static episode documents and React use identical behavior. */
export function enhanceEpisodeHeader(header: HTMLDivElement | null) {
  if (!header) return;
  const audio = header.querySelector("audio");
  const ui = header.querySelector<HTMLElement>(".episode-controls");
  const play = header.querySelector<HTMLButtonElement>(".episode-play");
  const seek = header.querySelector<HTMLInputElement>(".episode-progress");
  const speed = header.querySelector<HTMLButtonElement>(".episode-speed");
  const status = header.querySelector<HTMLElement>(".playback-status");
  const elapsed = header.querySelector<HTMLElement>("[data-elapsed]");
  const duration = header.querySelector<HTMLElement>("[data-duration]");
  if (
    !audio ||
    !ui ||
    !play ||
    !seek ||
    !speed ||
    !status ||
    !elapsed ||
    !duration
  )
    return;
  const controller = new AbortController();
  const options = { signal: controller.signal };
  let dragging = false;
  const time = (value: number) => {
    const n = Math.max(0, Math.floor(value || 0));
    const h = Math.floor(n / 3600),
      m = Math.floor(n / 60) % 60,
      s = n % 60;
    return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s).padStart(2, "0")}`;
  };
  const state = () => {
    play.textContent = audio.paused ? "▶" : "Ⅱ";
    play.setAttribute(
      "aria-label",
      audio.paused ? "Play episode" : "Pause episode",
    );
  };
  const update = () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.max = String(audio.duration);
      duration.textContent = time(audio.duration);
    }
    if (!dragging) seek.value = String(audio.currentTime);
    seek.setAttribute("aria-valuetext", time(Number(seek.value)));
    elapsed.textContent = time(audio.currentTime);
  };
  const fail = () => {
    status.hidden = false;
    status.textContent =
      "Audio could not play. Try again or open the audio link.";
    state();
  };
  play.addEventListener(
    "click",
    async () => {
      if (!audio.paused) {
        audio.pause();
        return;
      }
      status.hidden = true;
      try {
        await audio.play();
      } catch {
        fail();
      }
    },
    options,
  );
  seek.addEventListener(
    "input",
    () => {
      dragging = true;
      seek.setAttribute("aria-valuetext", time(Number(seek.value)));
    },
    options,
  );
  seek.addEventListener(
    "change",
    () => {
      audio.currentTime = Number(seek.value);
      dragging = false;
      update();
    },
    options,
  );
  speed.addEventListener(
    "click",
    () => {
      const rates = [1, 1.25, 1.5, 1.75, 2, 0.75];
      audio.playbackRate =
        rates[(rates.indexOf(audio.playbackRate) + 1) % rates.length];
    },
    options,
  );
  audio.addEventListener(
    "ratechange",
    () => {
      speed.textContent = `${audio.playbackRate}×`;
      speed.setAttribute(
        "aria-label",
        `Playback speed: ${audio.playbackRate} times`,
      );
    },
    options,
  );
  for (const event of ["play", "pause", "ended"])
    audio.addEventListener(event, state, options);
  for (const event of ["timeupdate", "loadedmetadata", "durationchange"])
    audio.addEventListener(event, update, options);
  audio.addEventListener("error", fail, options);
  audio.controls = false;
  audio.hidden = true;
  ui.hidden = false;
  update();
  state();
  return () => {
    controller.abort();
    audio.controls = true;
    audio.hidden = false;
    ui.hidden = true;
  };
}

export const PLAYER_SCRIPT = `document.querySelectorAll('.episode-header').forEach(${enhanceEpisodeHeader.toString()});`;
