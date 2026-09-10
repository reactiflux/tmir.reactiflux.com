export interface ProfileLink {
  label: string;
  href: string;
}
export interface PersonProfile {
  episodesUrl?: string;
  links: ProfileLink[];
}

// Verified against https://tmir.transistor.fm/people on 2026-09-10.
// Keep full link lists here; presentation selects up to three. No runtime fetch.
const profiles: Record<string, PersonProfile> = {
  // These guests have no Transistor person profile; use their verified appearance.
  "Elizabeth Woolf": {
    episodesUrl: "https://share.transistor.fm/s/1d256264",
    links: [],
  },
  "Omer Kenet": {
    episodesUrl: "https://share.transistor.fm/s/002daf8d",
    links: [],
  },
  "Mark Erikson": {
    episodesUrl: "https://tmir.transistor.fm/people/mark-erikson",
    links: [
      {
        label: "X",
        href: "https://x.com/acemarke",
      },
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/acemarke.dev",
      },
      {
        label: "GitHub",
        href: "https://github.com/markerikson",
      },
      {
        label: "Website",
        href: "https://blog.isquaredsoftware.com",
      },
    ],
  },
  "Mo Javad": {
    episodesUrl: "https://tmir.transistor.fm/people/mo-javad",
    links: [
      {
        label: "X",
        href: "https://x.com/mo__javad",
      },
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/mojavad.bsky.social",
      },
      {
        label: "GitHub",
        href: "https://github.com/mojavad",
      },
    ],
  },
  "Ankita Kulkarni": {
    episodesUrl: "https://tmir.transistor.fm/people/ankita-kulkarni",
    links: [
      {
        label: "YouTube",
        href: "https://www.youtube.com/@Kulkarniankita",
      },
      {
        label: "GitHub",
        href: "https://github.com/kulkarniankita",
      },
      {
        label: "Website",
        href: "https://www.kulkarniankita.com/",
      },
    ],
  },
  "Carl Vitullo": {
    episodesUrl: "https://tmir.transistor.fm/people/carl-vitullo",
    links: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/vcarl.com",
      },
      {
        label: "GitHub",
        href: "https://github.com/vcarl",
      },
      {
        label: "Website",
        href: "https://vcarl.com",
      },
    ],
  },
  itsMapleLeaf: {
    episodesUrl: "https://tmir.transistor.fm/people/itsmapleleaf",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/itsMapleLeaf",
      },
      {
        label: "Website",
        href: "https://mapleleaf.dev",
      },
    ],
  },
  "Jenny Truong": {
    episodesUrl: "https://tmir.transistor.fm/people/jenny-truong",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/jenny-tru",
      },
    ],
  },
  "Joshua Comeau": {
    episodesUrl: "https://tmir.transistor.fm/people/joshua-comeau",
    links: [
      {
        label: "Threads",
        href: "https://www.threads.com/@joshwcomeau",
      },
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/joshwcomeau.com",
      },
      {
        label: "GitHub",
        href: "https://github.com/joshwcomeau",
      },
      {
        label: "Website",
        href: "https://www.joshwcomeau.com/",
      },
    ],
  },
  "Lenz Weber-Tronic": {
    episodesUrl: "https://tmir.transistor.fm/people/lenz-weber-tronic",
    links: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/phry.dev",
      },
      {
        label: "GitHub",
        href: "https://github.com/phryneas",
      },
      {
        label: "Website",
        href: "https://phryneas.de",
      },
    ],
  },
  "Matt Pocock": {
    episodesUrl: "https://tmir.transistor.fm/people/matt-pocock",
    links: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/mattpocock.com",
      },
      {
        label: "YouTube",
        href: "https://www.youtube.com/@MattPocockAI",
      },
      {
        label: "GitHub",
        href: "https://github.com/mattpocock",
      },
      {
        label: "Website",
        href: "https://totaltypescript.com",
      },
    ],
  },
  "Michelle Bakels": {
    episodesUrl: "https://tmir.transistor.fm/people/michelle-bakels",
    links: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/michelle.blue",
      },
      {
        label: "GitHub",
        href: "https://github.com/michellebakels",
      },
      {
        label: "Website",
        href: "https://www.michellebakels.com/",
      },
    ],
  },
  "Peter Shershov": {
    episodesUrl: "https://tmir.transistor.fm/people/peter-shershov",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/PeterShershov",
      },
    ],
  },
  Retsam19: {
    episodesUrl: "https://tmir.transistor.fm/people/retsam19",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/Retsam",
      },
    ],
  },
  "Sunil Pai": {
    episodesUrl: "https://tmir.transistor.fm/people/sunil-pai",
    links: [
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/threepointone.bsky.social",
      },
      {
        label: "GitHub",
        href: "https://github.com/threepointone",
      },
      {
        label: "Website",
        href: "https://sunilpai.dev",
      },
    ],
  },
  "Swizec Teller": {
    episodesUrl: "https://tmir.transistor.fm/people/swizec-teller",
    links: [
      {
        label: "X",
        href: "https://x.com/swizec",
      },
      {
        label: "Bluesky",
        href: "https://bsky.app/profile/did:plc:n4a3xmmqu4adsids6osixlxk",
      },
      {
        label: "YouTube",
        href: "https://www.youtube.com/swizecteller",
      },
      {
        label: "GitHub",
        href: "https://github.com/Swizec",
      },
      {
        label: "Website",
        href: "https://swizec.com",
      },
    ],
  },
  "Tejas Kumar": {
    episodesUrl: "https://tmir.transistor.fm/people/tejas-kumar",
    links: [
      {
        label: "YouTube",
        href: "https://youtube.com/@tejask",
      },
      {
        label: "GitHub",
        href: "https://github.com/TejasQ",
      },
      {
        label: "Website",
        href: "https://tejaskumar.com/",
      },
    ],
  },
  "Tom Raviv": {
    episodesUrl: "https://tmir.transistor.fm/people/tom-raviv",
    links: [
      {
        label: "GitHub",
        href: "https://github.com/tomrav",
      },
      {
        label: "Website",
        href: "https://dazl.dev",
      },
    ],
  },
};

const aliases: Record<string, string> = {
  Mo: "Mo Javad",
  "Josh Comeau": "Joshua Comeau",
  MapleLeaf: "itsMapleLeaf",
};
export const canonicalPersonName = (name: string) => aliases[name] ?? name;

export function personProfile(name: string, href?: string): PersonProfile {
  const profile = profiles[canonicalPersonName(name)];
  const links = [...(profile?.links ?? [])];
  const isEpisodesUrl = (url: string) =>
    /^https:\/\/tmir\.transistor\.fm\/people\/[^/?#]+\/?$/.test(url);
  if (
    href &&
    !isEpisodesUrl(href) &&
    !links.some(
      (link) => link.href.replace(/\/$/, "") === href.replace(/\/$/, ""),
    )
  ) {
    links.push({ label: "Website", href });
  }
  const priority = ["Website", "Bluesky", "GitHub"];
  const rank = (label: string) =>
    priority.includes(label) ? priority.indexOf(label) : priority.length;
  return {
    episodesUrl:
      profile?.episodesUrl ?? (href && isEpisodesUrl(href) ? href : undefined),
    links: links.sort((a, b) => rank(a.label) - rank(b.label)).slice(0, 3),
  };
}
