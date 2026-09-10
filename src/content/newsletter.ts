import { createServerFn } from "@tanstack/react-start";

const BUTTONDOWN_USER = import.meta.env.VITE_BUTTONDOWN_USER;

/**
 * Buttondown's public embed endpoint. It stays the form's `action` so the page
 * still subscribes without JavaScript; `subscribe` posts to the same URL from
 * the server when the form has hydrated, so the reader keeps the page.
 */
export const BUTTONDOWN_URL: string | undefined = BUTTONDOWN_USER
  ? `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USER}`
  : undefined;

export const subscribe = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => String(data.get("email") ?? ""))
  .handler(async ({ data: email }) => {
    if (!BUTTONDOWN_URL || !email.includes("@"))
      return { ok: false, message: "Enter a valid email address." };
    try {
      const res = await fetch(BUTTONDOWN_URL, {
        method: "POST",
        body: new URLSearchParams({ email }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      return {
        ok: false,
        message: "Subscription failed. Try again in a moment.",
      };
    }
    return { ok: true, message: "Almost there — check your inbox to confirm." };
  });
