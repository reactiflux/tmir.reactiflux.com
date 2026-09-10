// Episodes bundled into the server build, for server functions that run at
// request time where content/ is not on disk. Scripts keep using load.ts.
import { episodeOrder } from "./load.ts";
import { parseEpisode } from "./parse.ts";

const files = import.meta.glob("/content/episodes/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const episodes = Object.entries(files)
  .map(([path, markdown]) => parseEpisode(markdown, path.slice(18, -3)))
  .sort(episodeOrder);
