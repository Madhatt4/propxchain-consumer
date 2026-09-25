// Exchange and completion need the buyer side AND the seller side (security
// scan H6). transaction_manager answers the first side's call with ok and a
// "Waiting for the <other> side." message, and only the second call moves the
// deal on. This tells the two apart until the UI reads getCompletionConfirmations.
const WAITING_MARKER = 'Waiting for the ';

export function isWaitingForOtherSide(message: string | undefined): boolean {
  return typeof message === 'string' && message.includes(WAITING_MARKER);
}
