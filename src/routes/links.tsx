import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, OgTags, SITE_NAME, SITE_URL } from "../components/Document";

const FILTER_SCRIPT = `(function(){
var input=document.getElementById("link-filter");if(!input)return;
var rows=document.querySelectorAll(".link-row");
var groups=document.querySelectorAll(".link-group");
var count=document.getElementById("link-count");
function update(){
var q=input.value.trim().toLowerCase();
var visible=0;
for(var i=0;i<rows.length;i++){var hide=q!==""&&rows[i].dataset.text.indexOf(q)===-1;rows[i].hidden=hide;if(!hide)visible++;}
for(var j=0;j<groups.length;j++){groups[j].hidden=!groups[j].querySelector(".link-row:not([hidden])");}
if(count)count.textContent=visible+" of "+rows.length+" links";
}
input.addEventListener("input",update);
update();
})();`;

export const Route = createFileRoute("/links")({
  server: {
    handlers: {
      GET: async () => {
        const { loadEpisodes } = await import("../content/load.ts");
        const { buildLinkIndex, groupByHost } =
          await import("../content/links.ts");
        const { hms } = await import("../content/time.ts");
        const groups = groupByHost(buildLinkIndex(await loadEpisodes()));

        const html = renderToStaticMarkup(
          <Document
            head={
              <>
                <title>{`Links — ${SITE_NAME}`}</title>
                <meta
                  name="description"
                  content="Every link discussed on the show, grouped by site."
                />
                <link rel="canonical" href={`${SITE_URL}/links`} />
                <OgTags
                  title={`Links — ${SITE_NAME}`}
                  description="Every link discussed on the show, grouped by site."
                  url={`${SITE_URL}/links`}
                />
              </>
            }
            bodyClass="links-page"
            scripts={
              <script dangerouslySetInnerHTML={{ __html: FILTER_SCRIPT }} />
            }
          >
            <h1>Links</h1>
            <input
              id="link-filter"
              type="search"
              placeholder="Filter links…"
              aria-label="Filter links by text or host"
            />
            <p id="link-count" aria-live="polite" />
            {groups.map((group) => (
              <section className="link-group" key={group.host}>
                <h2>
                  {group.host}{" "}
                  <span className="count">{group.entries.length}</span>
                </h2>
                <ul>
                  {group.entries.map((entry, i) => (
                    <li
                      className="link-row"
                      key={`${entry.episodeSlug}-${i}`}
                      data-text={`${entry.text} ${entry.host}`.toLowerCase()}
                    >
                      <a href={entry.url} rel="noreferrer">
                        {entry.text}
                      </a>
                      <a
                        className="from"
                        href={`/episodes/${entry.episodeSlug}`}
                      >
                        {entry.episodeTitle}
                        {entry.time !== undefined && (
                          <span className="ts">{hms(entry.time)}</span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </Document>,
        );

        return new Response(`<!DOCTYPE html>${html}`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
