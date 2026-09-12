import { NewsletterForm } from "./NewsletterForm";
import { BUTTONDOWN_URL } from "../content/newsletter.ts";

export const PODCAST_FEED = "https://feeds.transistor.fm/this-month-in-react";
export const REACTIFLUX_DISCORD = "https://discord.gg/reactiflux";

export function PodcastLinks() {
  return (
    <div className="podcast-destinations">
      <a href="https://podcasts.apple.com/us/podcast/this-month-in-react/id1661733526">
        Apple Podcasts <span aria-hidden="true">↗</span>
      </a>
      <a href="https://open.spotify.com/show/4g3Le83YfsMeI8Fq3cpPeH">
        Spotify <span aria-hidden="true">↗</span>
      </a>
      <a href={PODCAST_FEED}>
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
