import type { Episode, OutlineItem } from "../content/parse.ts";
import { splitTitleLink } from "../content/slug.ts";
import { hms, isoDuration, toSeconds } from "../content/time.ts";

/** One delegated listener seeks the page's single <audio> from any [data-seconds]. */
export const SEEK_SCRIPT = `document.addEventListener("click",function(e){
var t=e.target.closest("[data-seconds]");if(!t)return;
var a=document.querySelector("audio");if(!a)return;
var s=Number(t.dataset.seconds);if(!isFinite(s))return;
e.preventDefault();a.currentTime=s;
var p=a.play();if(p&&p.catch)p.catch(function(){})});`;

/**
 * Marks the outline entries for the transcript sections currently on screen with
 * aria-current="true" and keeps that block centred in the outline's scroller
 * (unless the reader is pointing at or focused inside it). Also publishes the
 * sticky header's height as --header-block-size so scroll anchoring clears it.
 */
export const OUTLINE_SCRIPT = `(function(){
var toc=document.querySelector(".toc");
var head=document.querySelector(".episode-header");
if(head&&window.ResizeObserver)new ResizeObserver(function(e){
  document.documentElement.style.setProperty("--header-block-size",e[0].target.offsetHeight+"px")}).observe(head);
if(!toc||!window.IntersectionObserver)return;
var heads=[].slice.call(document.querySelectorAll(".transcript h2[id]"));
if(!heads.length)return;
var links=heads.map(function(h){return toc.querySelector('a[href="#'+h.id+'"]')});
var vis={},hover=false;
toc.addEventListener("mouseenter",function(){hover=true});
toc.addEventListener("mouseleave",function(){hover=false});
function update(){
  var top=head?head.getBoundingClientRect().bottom:0,last=-1,first=-1,end=-1;
  for(var i=0;i<heads.length;i++)if(heads[i].getBoundingClientRect().top<=top)last=i;
  for(var i=0;i<heads.length;i++){
    var on=vis[heads[i].id]||i===last;
    var a=links[i];if(!a)continue;
    if(on){a.setAttribute("aria-current","true");if(first<0)first=i;end=i}
    else a.removeAttribute("aria-current");
  }
  if(first<0||hover||toc.matches(":focus-within"))return;
  var a=links[first],b=links[end];if(!a||!b)return;
  var r=toc.getBoundingClientRect();
  var mid=(a.getBoundingClientRect().top+b.getBoundingClientRect().bottom)/2-r.top+toc.scrollTop;
  var max=toc.scrollHeight-toc.clientHeight;
  toc.scrollTop=Math.max(0,Math.min(mid-toc.clientHeight/2,max));
}
var obs=new IntersectionObserver(function(es){
  for(var i=0;i<es.length;i++)vis[es[i].target.id]=es[i].isIntersecting;
  update();
},{rootMargin:"0px 0px -60% 0px"});
for(var i=0;i<heads.length;i++)obs.observe(heads[i]);
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
export const COMMENTS_SCRIPT = `(function(){
var el=document.getElementById("comments");if(!el)return;
var uri=el.dataset.thread;if(!uri)return;
var API="https://public.api.bsky.app/xrpc/app.bsky.feed.";
var repliesSlot=document.createElement("div");el.appendChild(repliesSlot);
var quotesSlot=document.createElement("div");el.appendChild(quotesSlot);
function get(path){
  return fetch(API+path).then(function(r){return r.ok?r.json():Promise.reject(r.status)});
}
function item(post){
  var a=post.author||{},rec=post.record||{};
  var li=document.createElement("li");
  var who=document.createElement("p");who.className="reply-author";
  var link=document.createElement("a");
  link.href="https://bsky.app/profile/"+(a.handle||a.did||"");
  link.rel="noreferrer";
  link.textContent=(a.displayName||a.handle||"")+" @"+(a.handle||"");
  who.appendChild(link);
  var body=document.createElement("p");body.className="reply-text";
  body.textContent=rec.text||"";
  var when=document.createElement("time");when.className="reply-date";
  var created=rec.createdAt||post.indexedAt||"";
  when.dateTime=created;when.textContent=created.slice(0,10);
  li.appendChild(who);li.appendChild(body);li.appendChild(when);
  return li;
}
function render(replies){
  if(!replies||!replies.length)return null;
  var ol=document.createElement("ol");ol.className="replies";
  for(var i=0;i<replies.length;i++){
    var r=replies[i];if(!r||!r.post)continue;
    var li=item(r.post);
    var kids=render(r.replies);if(kids)li.appendChild(kids);
    ol.appendChild(li);
  }
  return ol.children.length?ol:null;
}
function counts(post){
  var parts=[],names=[["replyCount","reply","replies"],["repostCount","repost","reposts"],
    ["quoteCount","quote","quotes"],["likeCount","like","likes"]];
  for(var i=0;i<names.length;i++){
    var n=post[names[i][0]]||0;
    if(n)parts.push(n+" "+(n===1?names[i][1]:names[i][2]));
  }
  if(!parts.length)return;
  var p=el.querySelector("p");if(!p)return;
  var span=document.createElement("span");span.className="count";
  span.textContent=" · "+parts.join(" · ");
  p.appendChild(span);
}
get("getPostThread?uri="+encodeURIComponent(uri)+"&depth=6")
.then(function(d){
  var t=d&&d.thread;
  if(!t||t.$type!=="app.bsky.feed.defs#threadViewPost")return;
  counts(t.post||{});
  var list=render(t.replies);if(list)repliesSlot.appendChild(list);
})
.catch(function(){});
get("getQuotes?uri="+encodeURIComponent(uri)+"&limit=10")
.then(function(d){
  var posts=d&&d.posts;if(!posts||!posts.length)return;
  var h=document.createElement("h3");h.textContent="Quote posts";
  quotesSlot.appendChild(h);
  var ol=document.createElement("ol");ol.className="replies";
  quotesSlot.appendChild(ol);
  posts.forEach(function(p){
    var li=item(p);ol.appendChild(li);
    get("getPostThread?uri="+encodeURIComponent(p.uri)+"&depth=3")
    .then(function(d2){
      var t=d2&&d2.thread;if(!t)return;
      var kids=render(t.replies);if(kids)li.appendChild(kids);
    }).catch(function(){});
  });
})
.catch(function(){});
})();`;

export function Outline({ items }: { items: OutlineItem[] }) {
  return (
    <ol className="outline">
      {items.map((item, i) => {
        const seconds = toSeconds(item.time);
        return (
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

export function EpisodeBody({ episode }: { episode: Episode }) {
  return (
    <div className="episode">
      <nav className="toc" aria-label="Episode outline" data-pagefind-ignore="">
        <h2>Outline</h2>
        <Outline items={episode.outline} />
      </nav>
      <div className="transcript" data-pagefind-body="">
        {episode.sections.map((section) => {
          const heading = splitTitleLink(section.title);
          return (
            <section key={section.anchor}>
              <h2 id={section.anchor}>
                {heading.url ? (
                  <a href={heading.url} rel="noreferrer">
                    {heading.text}
                  </a>
                ) : (
                  heading.text
                )}
              </h2>
              {section.segments.map((segment, i) => {
                const seconds = toSeconds(segment.time);
                return (
                  <p className="segment" key={i}>
                    {segment.speaker && (
                      <strong className="speaker">{segment.speaker}: </strong>
                    )}
                    {segment.text}
                    {seconds !== undefined && (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="ts"
                          data-seconds={seconds}
                        >
                          <time dateTime={isoDuration(seconds)}>
                            {hms(seconds)}
                          </time>
                        </button>
                      </>
                    )}
                  </p>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
