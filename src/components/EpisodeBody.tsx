import { PersonIdentity } from "./PersonIdentity";
import type { Episode, OutlineItem } from "../content/parse.ts";
import { splitTitleLink } from "../content/slug.ts";
import { hms, isoDuration, toSeconds } from "../content/time.ts";

/** One delegated listener seeks the page's single <audio> from any [data-seconds]. */
export const SEEK_SCRIPT = `document.addEventListener("click",async e=>{
const t=e.target.closest("[data-seconds]");if(!t)return;
const a=document.querySelector("audio");if(!a)return;
const s=Number(t.dataset.seconds);if(!Number.isFinite(s))return;
e.preventDefault();a.currentTime=s;
try{await a.play()}catch{}});`;

/**
 * Marks the outline entries for the transcript sections currently on screen with
 * aria-current="true" and keeps that block centred in the outline's scroller
 * (unless the reader is pointing at or focused inside it). Also publishes the
 * sticky player's height as --header-block-size so scroll anchoring clears it.
 */
export const OUTLINE_SCRIPT = `(()=>{
const toc=document.querySelector(".toc");
const head=document.querySelector(".episode-header");
if(head)new ResizeObserver(([e])=>{
  document.documentElement.style.setProperty("--header-block-size",\`\${e.target.offsetHeight}px\`)}).observe(head);
const disclosure=document.querySelector(".chapter-disclosure");
if(disclosure){const narrow=matchMedia("(max-width: 56rem)");
const size=()=>{disclosure.open=!narrow.matches};size();narrow.addEventListener("change",size);
toc.addEventListener("click",e=>{if(narrow.matches&&e.target.closest('a[href^="#"]'))disclosure.open=false});}
if(!toc)return;
const heads=[...document.querySelectorAll(".transcript h2[id]")];
if(!heads.length)return;
const links=heads.map(h=>toc.querySelector(\`a[href="#\${h.id}"]\`));
const vis=new Set();let hover=false;
toc.addEventListener("mouseenter",()=>{hover=true});
toc.addEventListener("mouseleave",()=>{hover=false});
const update=()=>{
  const top=head?Math.max(0,head.getBoundingClientRect().bottom):0;
  const last=heads.findLastIndex(h=>h.getBoundingClientRect().top<=top);
  let first=-1,end=-1;
  heads.forEach((h,i)=>{
    const a=links[i];if(!a)return;
    if(vis.has(h.id)||i===last){a.setAttribute("aria-current","true");if(first<0)first=i;end=i}
    else a.removeAttribute("aria-current");
  });
  if(first<0||hover||toc.matches(":focus-within"))return;
  const a=links[first],b=links[end];if(!a||!b)return;
  const r=toc.getBoundingClientRect();
  const mid=(a.getBoundingClientRect().top+b.getBoundingClientRect().bottom)/2-r.top+toc.scrollTop;
  const max=toc.scrollHeight-toc.clientHeight;
  toc.scrollTop=Math.max(0,Math.min(mid-toc.clientHeight/2,max));
};
const obs=new IntersectionObserver(es=>{
  for(const e of es)e.isIntersecting?vis.add(e.target.id):vis.delete(e.target.id);
  update();
},{rootMargin:"0px 0px -60% 0px"});
for(const h of heads)obs.observe(h);
})();`;

/**
 * Fetches the announcement post's reply thread from the public Bluesky API and
 * appends it to #comments. Response shape per app.bsky.feed.getPostThread:
 * { thread: { $type: "app.bsky.feed.defs#threadViewPost", post, replies[] } },
 * each post carrying author.displayName / author.handle, record.text,
 * record.createdAt and indexedAt. thread.post also carries the reply/repost/
 * quote/like counts. app.bsky.feed.getQuotes returns { posts: PostView[] };
 * each quote post is rendered as a top-level comment with its own thread.
 * Every fetch fails silently and independently.
 */
export const COMMENTS_SCRIPT = `(async()=>{
const el=document.getElementById("comments");if(!el)return;
const uri=el.dataset.thread;if(!uri)return;
const API="https://public.api.bsky.app/xrpc/app.bsky.feed.";
const repliesSlot=el.appendChild(document.createElement("div"));
const quotesSlot=el.appendChild(document.createElement("div"));
const get=async path=>{const r=await fetch(API+path);if(!r.ok)throw r.status;return r.json()};
const thread=(u,depth)=>get(\`getPostThread?uri=\${encodeURIComponent(u)}&depth=\${depth}\`);
const when=new Intl.DateTimeFormat(undefined,{dateStyle:"medium"});
const plural=new Intl.PluralRules("en");
const item=post=>{
  const a=post.author??{},rec=post.record??{};
  const li=document.createElement("li");
  const who=document.createElement("p");who.className="reply-author";
  const link=document.createElement("a");
  link.href=\`https://bsky.app/profile/\${a.handle||a.did||""}\`;
  link.rel="noreferrer";
  link.textContent=\`\${a.displayName||a.handle||""} @\${a.handle||""}\`;
  who.append(link);
  const body=document.createElement("p");body.className="reply-text";
  body.textContent=rec.text||"";
  const time=document.createElement("time");time.className="reply-date";
  const created=rec.createdAt||post.indexedAt||"";
  time.dateTime=created;time.textContent=created?when.format(new Date(created)):"";
  li.append(who,body,time);
  return li;
};
const render=replies=>{
  const ol=document.createElement("ol");ol.className="replies";
  for(const r of replies??[]){
    if(!r?.post)continue;
    const li=item(r.post);
    const kids=render(r.replies);if(kids)li.append(kids);
    ol.append(li);
  }
  return ol.children.length?ol:null;
};
const counts=post=>{
  const parts=[];
  for(const[key,one,many]of[["replyCount","reply","replies"],["repostCount","repost","reposts"],
    ["quoteCount","quote","quotes"],["likeCount","like","likes"]]){
    const n=post[key]||0;
    if(n)parts.push(\`\${n} \${plural.select(n)==="one"?one:many}\`);
  }
  const p=el.querySelector("p");
  if(!parts.length||!p)return;
  const summary=document.querySelector("[data-reaction-count]");
  if(summary){summary.textContent=parts.join(" · ");return}
  const span=document.createElement("span");span.className="count";
  span.textContent=\` · \${parts.join(" · ")}\`;
  p.append(span);
};
// The two top-level reads are independent; either may fail on its own.
const[main,quotes]=await Promise.allSettled([
  thread(uri,6),get(\`getQuotes?uri=\${encodeURIComponent(uri)}&limit=10\`)]);
const t=main.value?.thread;
if(t?.$type==="app.bsky.feed.defs#threadViewPost"){
  counts(t.post??{});
  const list=render(t.replies);if(list)repliesSlot.append(list);
}
const posts=quotes.value?.posts;
if(posts?.length){
  const h=document.createElement("h3");h.textContent="Quote posts";
  const ol=document.createElement("ol");ol.className="replies";
  quotesSlot.append(h,ol);
  await Promise.allSettled(posts.map(async p=>{
    const li=ol.appendChild(item(p));
    const kids=render((await thread(p.uri,3))?.thread?.replies);
    if(kids)li.append(kids);
  }));
}
})();`;

export function Outline({ items }: { items: OutlineItem[] }) {
  return (
    <ol className="outline">
      {items.map((item, i) => {
        const seconds = toSeconds(item.time);
        return (
          // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- outlines legitimately repeat an entry, so position is the only identity
          <li key={`${item.anchor}-${i}`}>
            {seconds !== undefined && (
              <>
                <button type="button" className="ts" data-seconds={seconds}>
                  {hms(seconds)}
                </button>{" "}
              </>
            )}
            <a href={`#${item.anchor}`}>{item.title}</a>
            {item.url && (
              <>
                {" "}
                <a
                  className="outbound"
                  href={item.url}
                  rel="noreferrer"
                  aria-label={`${item.title} (external link)`}
                >
                  &#8599;
                </a>
              </>
            )}
            {item.children.length > 0 && <Outline items={item.children} />}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * What an episode page has to say when there is no outline and no transcript —
 * the Office Hours and Spotlight archive imports, which never had either.
 * Without it the page would be a title and a player over an empty grid.
 */
function EpisodeSummary({ episode }: { episode: Episode }) {
  return (
    <div>
      {episode.people.length > 0 && (
        <section className="people">
          <h2>People</h2>
          <ul>
            {episode.people.map((person) => (
              <li key={person.name}>
                {person.img && (
                  <img
                    src={person.img}
                    alt={person.name}
                    width="48"
                    height="48"
                    loading="lazy"
                  />
                )}
                <div>
                  <PersonIdentity name={person.name} href={person.href} />
                  {person.role && <span className="role">{person.role}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function EpisodeBody({ episode }: { episode: Episode }) {
  // No transcript means no outline either: these are archive imports, not
  // half-published episodes. Render the summary instead of two empty shells.
  if (episode.sections.length === 0)
    return (
      <div className="episode">
        <EpisodeSummary episode={episode} />
      </div>
    );
  const chapterResources = new Map<string, OutlineItem[]>();
  function collectResources(items: OutlineItem[]) {
    for (const item of items) {
      if (item.url) {
        const resources = chapterResources.get(item.anchor) || [];
        resources.push(item);
        chapterResources.set(item.anchor, resources);
      }
      collectResources(item.children);
    }
  }
  collectResources(episode.outline);
  let previousSpeaker = "";
  return (
    <div className="episode">
      <nav className="toc" aria-label="Episode outline" data-pagefind-ignore="">
        <details className="chapter-disclosure" open>
          <summary>In this episode</summary>
          <Outline items={episode.outline} />
        </details>
      </nav>
      <div className="transcript" data-pagefind-body="">
        {episode.sections.map((section) => {
          const heading = splitTitleLink(section.title);
          const resources = chapterResources.get(section.anchor) || [];
          // Explicit heading links take precedence. Outline anchors also cover
          // chapters whose wording differs from the linked resource's title.
          const resourceUrl =
            heading.url ||
            resources.find((item) => item.title === heading.text)?.url ||
            resources[0]?.url;
          const headingText = /^tmir-\d{4}-\d{2}$/.test(heading.text)
            ? "Introduction"
            : heading.text;
          return (
            <section key={section.anchor}>
              <h2 id={section.anchor}>
                {resourceUrl ? (
                  <a href={resourceUrl} rel="noreferrer">
                    {headingText}
                  </a>
                ) : (
                  headingText
                )}
              </h2>
              {section.segments.map((segment) => {
                const seconds = toSeconds(segment.time);
                const showSpeaker =
                  !!segment.speaker && segment.speaker !== previousSpeaker;
                if (segment.speaker) previousSpeaker = segment.speaker;
                return (
                  <div
                    className="segment"
                    key={`${segment.time}-${segment.text}`}
                  >
                    <div className="segment-meta">
                      {showSpeaker && (
                        <span className="speaker">{segment.speaker}</span>
                      )}
                      {seconds !== undefined && (
                        <>
                          {" "}
                          <button
                            type="button"
                            className="ts"
                            data-seconds={seconds}
                            aria-label={`Play from ${hms(seconds)}`}
                          >
                            <time dateTime={isoDuration(seconds)}>
                              {hms(seconds)}
                            </time>
                          </button>
                        </>
                      )}
                    </div>
                    <p>{segment.text}</p>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
