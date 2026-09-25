// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * The reason a user-initiated action failed, shown where the user clicked.
 *
 * Exists because the alternative kept winning. A handler that catches, calls
 * `logger.error` and unsticks the button produces a screen that is
 * indistinguishable from a dead button — so a real outage reads as a broken
 * control and nobody reports it as an outage. Groundsure ordering failed
 * against the live API for over two months in 2026 for exactly this reason:
 * every failure path logged to a console nobody had open.
 *
 * A sweep on 2026-08-30 found 111 catch blocks in this app that only log. Most
 * are background loads, where silence is defensible. This component is for the
 * ones that are not: the user pressed something and it did not happen.
 *
 * Deliberately dumb — no dismiss button, no icon, no severity levels. It
 * renders nothing when there is nothing to say, so it costs one line at the
 * call site. Anything more and the cheap option goes back to being silence.
 *
 * `role="alert"` so it is announced, not merely drawn: a failure the user
 * cannot see is the bug being fixed here.
 */
export default function ActionError({
  message,
  className = '',
}: {
  /** Null or empty renders nothing — safe to leave mounted. */
  message?: string | null;
  className?: string;
}): React.ReactElement | null {
  // Callers pass service payloads straight through (`result.error || '…'`), and
  // a misbehaving API can make that an object or a number. React throws
  // "Objects are not valid as a React child" on those, which would turn a
  // handled failure into a blank screen — strictly worse than the silence this
  // component exists to replace. Guarded here rather than at each call site so
  // it holds for every caller, including future ones.
  if (typeof message !== 'string' || message.trim() === '') return null;

  return (
    <p
      role="alert"
      className={[
        'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700',
        'dark:border-red-800/40 dark:bg-red-900/10 dark:text-red-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {message}
    </p>
  );
}

/**
 * Turn an unknown thrown value into something worth showing a user.
 *
 * Callers reach for `err.message` and get "Failed to fetch" or
 * "[object Object]". A fallback that names what the user was trying to do is
 * more useful than a network library's internal wording, so the fallback is
 * the default and the thrown message is only used when it looks like prose
 * somebody wrote on purpose.
 */
export function actionErrorMessage(err: unknown, fallback: string): string {
  // Accepts a thrown value OR a service's `result.error` field, so both the
  // catch path and the `success: false` path normalise the same way. Without
  // that, `result.error || fallback` would render a literal "[object Object]"
  // string (truthy, so it passes) while an actual object was hidden — two
  // behaviours for one concept.
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : null;
  if (raw) {
    const m = raw.trim();
    // The constructor name lives on `name`, not `message` — a TypeError's
    // message is bare ("x is not a function"), which reads to a user as
    // gibberish rather than as an error type.
    const isRuntimeFault =
      err instanceof Error && /^(TypeError|ReferenceError|SyntaxError|RangeError)$/.test(err.name);
    const looksInternal =
      isRuntimeFault ||
      /^\[object/.test(m) ||
      /^Failed to fetch$/i.test(m) ||
      /^NetworkError/i.test(m);
    // Long is not the same as useless: "Cannot sign off: searches X, Y and Z
    // are missing…" is exactly what the user needs. Truncate rather than drop,
    // and only fall back for shapes that carry no meaning at all.
    if (!looksInternal) return m.length > 200 ? `${m.slice(0, 200).trimEnd()}…` : m;
  }
  return fallback;
}
