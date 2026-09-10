import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { Document } from "../components/Document";
import { SITE_NAME } from "../content/site.ts";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: SITE_NAME }] }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <Document head={<HeadContent />} scripts={<Scripts />}>
      {children}
    </Document>
  );
}
