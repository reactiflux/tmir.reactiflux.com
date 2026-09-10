import type { LinkEntry, LinkMatch } from "../content/links.ts";
import { hms, monthYear } from "../content/time.ts";

const label = (mention: LinkEntry) =>
  `${mention.discussionUrl.includes("#") ? "Open discussion" : "Open episode"} · ${monthYear(mention.date)}${mention.time !== undefined ? ` · ${hms(mention.time)}` : ""}`;

/**
 * Rendered as an RSC from the /links loader, so only the matched page of rows
 * crosses the wire.
 */
export function LinkResults({ matches }: { matches: LinkMatch[] }) {
  const months = Map.groupBy(matches, (match) =>
    match.mentions[0].date.slice(0, 7),
  );
  return (
    <div id="resource-list">
      {[...months].map(([month, grouped]) => (
        <section
          key={month}
          className="resource-month"
          data-month={month}
          aria-labelledby={`month-${month}`}
        >
          <h3 id={`month-${month}`} className="resource-month-heading">
            <time dateTime={month}>{monthYear(`${month}-01`)}</time>
          </h3>
          <ol>
            {grouped.map(({ resource, mentions }) => (
              <li className="link-row" key={resource.id} id={resource.id}>
                <article className="resource-body">
                  <p className="resource-host">{resource.host}</p>
                  <h4 className="resource-title">
                    <a href={resource.url} rel="noreferrer">
                      {mentions[0].text}
                    </a>
                  </h4>
                  <div className="resource-context">
                    <a
                      className="primary-discussion"
                      href={mentions[0].discussionUrl}
                      title={mentions[0].episodeTitle}
                    >
                      {label(mentions[0])}
                    </a>
                    {mentions.length > 1 && (
                      <details className="resource-discussions">
                        <summary>
                          {mentions.length - 1} more discussion
                          {mentions.length === 2 ? "" : "s"}
                        </summary>
                        <ul>
                          {mentions.slice(1).map((mention) => (
                            <li
                              key={`${mention.episodeSlug}-${mention.discussionUrl}-${mention.time}`}
                              className="resource-mention"
                            >
                              <a
                                href={mention.discussionUrl}
                                title={mention.episodeTitle}
                              >
                                {label(mention)}
                              </a>
                              <p>{mention.text}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
