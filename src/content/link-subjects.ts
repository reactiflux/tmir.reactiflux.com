export const LINK_SUBJECTS = [
  {
    id: "server-components",
    title: "Server Components",
    description: "RSCs, server actions, and early experiments",
    pattern:
      /\brscs?\b|server[- ]components?|server[- ]actions?|\bwaku\b|react2shell/i,
  },
  {
    id: "react-compiler",
    title: "React Compiler",
    description: "React Forget, adoption, and compiler releases",
    pattern: /react[- ](?:compiler|forget)|babel-plugin-react-compiler/i,
  },
  {
    id: "frameworks",
    title: "Frameworks & routing",
    description: "Next.js, Remix, TanStack, Astro, and alternatives",
    pattern:
      /\bnext(?:\.js|js|\s+\d)|nextjs\.org|\bremix\b|react[- ]router|tanstack.{0,10}(?:start|router)|\bastro\b|\bgatsby\b|\bwaku\b|\bsolid(?:js)?\b|\bsvelte\b|\bqwik\b|\bpreact\b|\bangular\b/i,
  },
  {
    id: "state-data",
    title: "State & data",
    description: "State management, fetching, and synchronization",
    pattern:
      /\bredux\b|\brtk\b|\bjotai\b|\bzustand\b|\bmobx\b|\bxstate\b|react[- ]query|tanstack.{0,10}query|\bswr\b|\bsignals?\b|state[- ]management|data[- ]fetching|\blocal[- ]first\b/i,
  },
  {
    id: "react-native",
    title: "React Native",
    description: "Expo, mobile development, and native platforms",
    pattern: /react[- ]native|\bexpo\b|\bhermes\b|\bskia\b|\bnitromodules\b/i,
  },
  {
    id: "tooling",
    title: "Tooling & TypeScript",
    description: "Build tools, runtimes, testing, and types",
    pattern:
      /\btypescript\b|\bts\s*\d|\bvite\b|\bvitest\b|\bwebpack\b|\bturbopack\b|\brspack\b|\brolldown\b|\brollup\b|\bbabel\b|\bbiome\b|\beslint\b|\bprettier\b|\b(?:bun|deno|nodejs|npm|pnpm|yarn|jest|playwright|storybook)\b|node\.js|\besm\b|\bdevtools\b/i,
  },
  {
    id: "web-platform",
    title: "The web platform",
    description: "JavaScript, CSS, browsers, and standards",
    pattern:
      /\btc39\b|\becmascript\b|\bcss\b|web[- ]components|\bwebkit\b|\bchromium\b|\bfirefox\b|\bsafari\b|\btemporal\b|\bdecorators\b|view[- ]transitions|\baccessibility\b|\ba11y\b|\bwasm\b|\bwebassembly\b/i,
  },
  {
    id: "performance",
    title: "Performance",
    description: "Rendering, profiling, benchmarks, and tradeoffs",
    pattern:
      /\bperformance\b|\bperf\b|\bbenchmarks?\b|\bmemoization\b|\bprofil(?:e|er|ing)\b|\bsuspense\b|\bconcurren(?:t|cy)\b|\bstreaming\b|\bhydration\b|\bvirtualiz/i,
  },
  {
    id: "open-source",
    title: "Maintaining open source",
    description: "Governance, funding, sustainability, and community",
    pattern:
      /open[- ]source|\bmaintainers?\b|\bgovernance\b|react[. -]foundation|\bfunding\b|\bsustainab|\bburnout\b|\blicens(?:e|ing)\b|\bfair[- ]source\b|\bcore[- ]team\b/i,
  },
] as const;

export type SubjectId = (typeof LINK_SUBJECTS)[number]["id"];
export type SubjectCorrection = { add?: SubjectId[]; remove?: SubjectId[] };

// Optional editorial corrections, keyed by the original source URL. These are
// deliberately separate from ingest-owned episode fields. A link can fit several subjects.
export const SUBJECT_CORRECTIONS: Record<string, SubjectCorrection> = {};

export function subjectsForLink(
  text: string,
  url: string,
  context: string[],
  correction = SUBJECT_CORRECTIONS[url],
): SubjectId[] {
  const haystack = [text, url, ...context].join(" ");
  const subjects = new Set<SubjectId>(
    LINK_SUBJECTS.filter((subject) => subject.pattern.test(haystack)).map(
      (subject) => subject.id,
    ),
  );
  return [
    ...subjects
      .union(new Set(correction?.add ?? []))
      .difference(new Set(correction?.remove ?? [])),
  ];
}
