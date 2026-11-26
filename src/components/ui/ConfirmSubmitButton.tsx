"use client";

/**
 * A submit button that asks before it fires, wrapped in its own form.
 *
 * This exists because two admin pages had the confirm inline:
 *
 *   <button type="submit" onClick={(e) => { if (!confirm(…)) e.preventDefault(); }}>
 *
 * inside a *server* component. Next.js cannot serialize an event handler
 * across that boundary, so it threw while rendering and both pages returned
 * 500 — not a button that failed to warn, but no page at all. The handler
 * needs a client boundary; this is it, in one place rather than two.
 *
 * The confirm is a courtesy to the operator and nothing more. Every action
 * passed in here calls requirePermission() itself, because a dialog a browser owns
 * is not a rule a server enforces (§19.6).
 */
export function ConfirmSubmitButton({
  action,
  confirmText,
  label,
  className,
}: {
  action: () => Promise<void>;
  confirmText: string;
  label: string;
  className: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (!confirm(confirmText)) e.preventDefault();
        }}
      >
        {label}
      </button>
    </form>
  );
}
