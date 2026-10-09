import { NewsletterForm } from "./NewsletterForm";
import { BUTTONDOWN_URL } from "../content/newsletter.ts";

export const PODCAST_FEED = "https://feeds.transistor.fm/this-month-in-react";
export const REACTIFLUX_DISCORD = "https://discord.gg/reactiflux";

export function PodcastLinks() {
  // data-analytics-platform is read by the delegated click listener in
  // src/lib/analytics.ts; it reports subscribe_link_clicked instead of a
  // bare outbound_link_clicked for these three.
  return (
    <div className="podcast-destinations">
      <a
        href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526"
        data-analytics-platform="apple"
      >
        Apple Podcasts <span aria-hidden="true">↗</span>
      </a>
      <a
        href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH"
        data-analytics-platform="spotify"
      >
        Spotify <span aria-hidden="true">↗</span>
      </a>
      <a href={PODCAST_FEED} data-analytics-platform="rss">
        Podcast RSS <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

export function EmailSubscription({ inputId }: { inputId: string }) {
  return (
    <section
      className="email-subscription"
      id="subscribe"
      aria-labelledby={`${inputId}-heading`}
    >
      <p className="eyebrow">Delivered directly</p>
      <h2 id={`${inputId}-heading`}>
        {BUTTONDOWN_URL
          ? "Get new episodes by email."
          : "Follow the show notes."}
      </h2>
      <p>
        {BUTTONDOWN_URL
          ? "We’ll email you when we publish, with the episode’s outline and links."
          : "Get each episode’s outline and links in your feed reader."}
      </p>
      {BUTTONDOWN_URL && (
        <NewsletterForm
          className="subscription-form"
          id={inputId}
          label="Your email address"
          placeholder="you@example.com"
          submitLabel="Subscribe by email"
          row
        />
      )}
    </section>
  );
}

export function LiveRecording() {
  return (
    <section
      className="live-recording"
      id="live"
      aria-labelledby="live-heading"
    >
      <p className="eyebrow">Recorded live in Reactiflux</p>
      <h2 id="live-heading">Be there for the conversation.</h2>
      <p>
        Join the Reactiflux Discord for recording announcements and listen along
        live.
      </p>
      <a href={REACTIFLUX_DISCORD}>
        Join the Discord <span aria-hidden="true">↗</span>
      </a>
    </section>
  );
}
