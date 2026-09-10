"use client";
import { startTransition, useActionState } from "react";
import { BUTTONDOWN_URL, subscribe } from "../content/newsletter.ts";

/**
 * The home page and /about frame the same form differently — the CSS keys off
 * `.newsletter form` on one and `form.newsletter` on the other — so the shape
 * is prop-driven rather than duplicated along with the action wiring.
 *
 * Progressive enhancement: the form's `action` is Buttondown's own endpoint, so
 * a no-JS submit subscribes as before. The action runs from `onSubmit`, which
 * only exists once hydrated — passing it as `action`/`formAction` instead would
 * make React server-render `formAction="javascript:throw …"` and break the
 * no-JS path, because a TanStack server function has no form-post URL.
 */
export function NewsletterForm({
  id,
  label,
  submitLabel,
  className,
  placeholder,
  row,
}: {
  id: string;
  label: string;
  submitLabel: string;
  className?: string;
  placeholder?: string;
  row?: boolean;
}) {
  const [result, formAction, pending] = useActionState(
    async (
      _previous: { ok: boolean; message: string } | null,
      data: FormData,
    ) =>
      subscribe({ data }).catch(() => ({
        ok: false,
        message: "Subscription failed. Try again in a moment.",
      })),
    null,
  );

  const fields = (
    <>
      <input
        id={id}
        type="email"
        name="email"
        required
        autoComplete="email"
        placeholder={placeholder}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Subscribing…" : submitLabel}
      </button>
    </>
  );

  return (
    <form
      className={className}
      action={BUTTONDOWN_URL}
      method="post"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        event.preventDefault();
        startTransition(() => formAction(data));
      }}
    >
      <label htmlFor={id}>{label}</label>
      {row ? <div className="action-row">{fields}</div> : fields}
      {result && (
        <p className="form-status" role="status">
          {result.message}
        </p>
      )}
    </form>
  );
}
