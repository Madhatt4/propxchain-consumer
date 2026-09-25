/**
 * First-run state for the dashboard welcome cards and the demo property.
 *
 * Deliberately NOT reusing the existing `onboardingComplete` key: that one gates
 * the role-selection/payment pages before the dashboard, and is set by the buyer
 * join path. Overloading it would make dismissing a welcome modal look like a
 * completed signup.
 *
 * Keys are scoped per principal so a shared device does not leak one user's
 * "seen it" state onto the next.
 */

const WELCOME_PREFIX = 'propxchain.welcomeCards.dismissed.v1';
const DEMO_PREFIX = 'propxchain.demoProperty.dismissed.v1';

function keyFor(prefix: string, principalId: string | null | undefined): string {
  return principalId ? `${prefix}.${principalId}` : prefix;
}

/** localStorage throws in private mode and when storage is full — never let that break the dashboard. */
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) {
      window.localStorage.setItem(key, 'true');
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Non-fatal: the user sees the cards again next visit, which is the safe failure.
  }
}

export function hasSeenWelcomeCards(principalId: string | null | undefined): boolean {
  return readFlag(keyFor(WELCOME_PREFIX, principalId));
}

export function markWelcomeCardsSeen(principalId: string | null | undefined): void {
  writeFlag(keyFor(WELCOME_PREFIX, principalId), true);
}

/** Used by Help → "Show the welcome guide again". */
export function resetWelcomeCards(principalId: string | null | undefined): void {
  writeFlag(keyFor(WELCOME_PREFIX, principalId), false);
}

export function hasDismissedDemoProperty(principalId: string | null | undefined): boolean {
  return readFlag(keyFor(DEMO_PREFIX, principalId));
}

export function dismissDemoProperty(principalId: string | null | undefined): void {
  writeFlag(keyFor(DEMO_PREFIX, principalId), true);
}
