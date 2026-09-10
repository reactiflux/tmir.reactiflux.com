import { createFileRoute } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { Document, OgTags } from "../components/Document";
import { SITE_NAME, SITE_URL } from "../content/site.ts";

import { LinkLibrary, LINK_LIBRARY_SCRIPT } from "../components/LinkLibrary";

export const Route = createFileRoute("/links")({
  server: {
    handlers: {
      GET: async () => {
        const [{ loadEpisodes }, { buildLinkIndex, buildLinkResources }] =
          await Promise.all([
            import("../content/load.ts"),
            import("../content/links.ts"),
          ]);
        const resources = buildLinkResources(
          buildLinkIndex(await loadEpisodes()),
        );

        const html = renderToStaticMarkup(
          <Document
            head={
              <>
                <title>{`Links — ${SITE_NAME}`}</title>
                <meta
                  name="description"
                  content="Explore React subjects through the resources and conversations collected across the show’s history."
                />
                <link rel="canonical" href={`${SITE_URL}/links`} />
                <OgTags
                  title={`Links — ${SITE_NAME}`}
                  description="Explore React subjects through the resources and conversations collected across the show’s history."
                  url={`${SITE_URL}/links`}
                />
              </>
            }
            bodyClass="links-page"
            scripts={
              <script
                dangerouslySetInnerHTML={{ __html: LINK_LIBRARY_SCRIPT }}
              />
            }
          >
            <LinkLibrary resources={resources} />
          </Document>,
        );

        return new Response(`<!DOCTYPE html>${html}`, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      },
    },
  },
});
