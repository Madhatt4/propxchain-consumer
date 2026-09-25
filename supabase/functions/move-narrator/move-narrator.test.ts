/**
 * Unit tests for the move-narrator pure logic (no network / no Deno.env).
 * Run: deno test supabase/functions/move-narrator/move-narrator.test.ts
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { parseEmail } from './delivery.ts';
import { ValidationError, validateMonitorFireRequest, validateRequest } from './validate.ts';

const VALID_FIRE = {
  action: 'fire',
  transaction: {
    txId: 'tx_1',
    url: 'https://app.propxchain.com/transaction/tx_1/flow',
    role: 'seller',
    propertyAddress: 'High Street, Sandy, SG19 1AG',
    previousBlocker: 'awaiting_buyer',
  },
  getNextStep: {
    blocker: 'hmlr_not_fetched',
    blockerLabel: 'HMLR title register not yet fetched',
    urgency: 'soon',
    why: 'Confirms ownership before contract drafting.',
    partial: false,
    options: [{ action: 'fetch_hmlr_title', displayLabel: 'Fetch HMLR title register', whyThis: 'Pulls the register' }],
  },
};

Deno.test('parseEmail extracts subject and body from front-matter', () => {
  const md = '---\nsubject: "Your Sandy sale is moving"\nto_role: "seller"\n---\n\nHi there,\n\nThe body.';
  const { subject, body } = parseEmail(md);
  assertEquals(subject, 'Your Sandy sale is moving');
  assertEquals(body, 'Hi there,\n\nThe body.');
});

Deno.test('parseEmail falls back when no front-matter present', () => {
  const { subject, body } = parseEmail('Just a plain body, no front matter.');
  assertEquals(subject, 'An update on your move');
  assertEquals(body, 'Just a plain body, no front matter.');
});

Deno.test('validateRequest accepts a well-formed fire action', () => {
  const r = validateRequest(VALID_FIRE);
  assertEquals(r.action, 'fire');
  if (r.action === 'fire') assertEquals(r.transaction.role, 'seller');
});

Deno.test('validateRequest rejects an unknown action', () => {
  assertThrows(() => validateRequest({ action: 'explode' }), ValidationError, 'action must be one of');
});

Deno.test('validateRequest rejects a bad role', () => {
  const bad = { ...VALID_FIRE, transaction: { ...VALID_FIRE.transaction, role: 'lawyer' } };
  assertThrows(() => validateRequest(bad), ValidationError, 'role must be');
});

Deno.test('validateRequest rejects a bad urgency', () => {
  const bad = { ...VALID_FIRE, getNextStep: { ...VALID_FIRE.getNextStep, urgency: 'urgent' } };
  assertThrows(() => validateRequest(bad), ValidationError, 'urgency must be');
});

Deno.test('validateRequest requires sessionId for status', () => {
  assertThrows(() => validateRequest({ action: 'status' }), ValidationError, 'sessionId');
});

// NOTE: this action never accepted a `recipient` field — audit 2026-07-25,
// finding #2 removed it before this test was written (a caller-chosen
// recipient made this function an open relay). Fixed pre-existing test rot
// that referenced the removed field; see validate.ts's own note above
// validateRequest for the security context.
Deno.test('validateRequest ignores a body-supplied recipient for deliver (no such field)', () => {
  const r = validateRequest({ action: 'deliver', sessionId: 'sesn_1', recipient: { email: 'a@b.com' } });
  if (r.action === 'deliver') {
    assertEquals(r.sessionId, 'sesn_1');
    assertEquals(Object.prototype.hasOwnProperty.call(r, 'recipient'), false);
  }
});

Deno.test('validateRequest carries an optional txId for status (telemetry-only)', () => {
  const r = validateRequest({ action: 'status', sessionId: 'sesn_1', txId: 'tx_1' });
  if (r.action === 'status') assertEquals(r.txId, 'tx_1');
});

Deno.test('validateRequest omits txId for status when not supplied', () => {
  const r = validateRequest({ action: 'status', sessionId: 'sesn_1' });
  if (r.action === 'status') assertEquals(r.txId, undefined);
});

Deno.test('validateRequest carries an optional txId for deliver (telemetry-only)', () => {
  const r = validateRequest({ action: 'deliver', sessionId: 'sesn_1', txId: 'tx_1' });
  if (r.action === 'deliver') assertEquals(r.txId, 'tx_1');
});

// --- blocker/previousBlocker whitelist (chunk 2 precondition #2) -----------
// Real key shapes sourced from next_step.mo (grep `blocker = `): no_solicitor,
// no_title_number, hmlr_not_fetched, artifacts_missing, counterparty_idle,
// none — all snake_case, well under 64 chars.

Deno.test('validateRequest accepts a fire action with real blocker key shapes', () => {
  const r = validateRequest({
    ...VALID_FIRE,
    transaction: { ...VALID_FIRE.transaction, previousBlocker: 'no_solicitor' },
    getNextStep: { ...VALID_FIRE.getNextStep, blocker: 'counterparty_idle' },
  });
  if (r.action === 'fire') {
    assertEquals(r.transaction.previousBlocker, 'no_solicitor');
    assertEquals(r.getNextStep.blocker, 'counterparty_idle');
  }
});

Deno.test('validateRequest allows an empty previousBlocker (first-ever blocker)', () => {
  const r = validateRequest({
    ...VALID_FIRE,
    transaction: { ...VALID_FIRE.transaction, previousBlocker: '' },
  });
  if (r.action === 'fire') assertEquals(r.transaction.previousBlocker, '');
});

Deno.test('validateRequest rejects a getNextStep.blocker over 64 chars', () => {
  const bad = { ...VALID_FIRE, getNextStep: { ...VALID_FIRE.getNextStep, blocker: 'a'.repeat(65) } };
  assertThrows(() => validateRequest(bad), ValidationError, 'blocker');
});

Deno.test('validateRequest rejects a getNextStep.blocker with uppercase/dashes', () => {
  const bad = { ...VALID_FIRE, getNextStep: { ...VALID_FIRE.getNextStep, blocker: 'Hmlr-Not-Fetched' } };
  assertThrows(() => validateRequest(bad), ValidationError, 'blocker');
});

Deno.test('validateRequest rejects an empty getNextStep.blocker', () => {
  const bad = { ...VALID_FIRE, getNextStep: { ...VALID_FIRE.getNextStep, blocker: '' } };
  assertThrows(() => validateRequest(bad), ValidationError);
});

Deno.test('validateRequest rejects a previousBlocker with a bad charset', () => {
  const bad = { ...VALID_FIRE, transaction: { ...VALID_FIRE.transaction, previousBlocker: 'no solicitor!' } };
  assertThrows(() => validateRequest(bad), ValidationError, 'previousBlocker');
});

Deno.test('validateRequest rejects a previousBlocker over 64 chars', () => {
  const bad = { ...VALID_FIRE, transaction: { ...VALID_FIRE.transaction, previousBlocker: 'a'.repeat(65) } };
  assertThrows(() => validateRequest(bad), ValidationError, 'previousBlocker');
});

// --- validateMonitorFireRequest (monitor_fire, chunk 2) ---------------------

const VALID_MONITOR_FIRE = {
  action: 'monitor_fire',
  txId: 'tx_1',
  previousBlocker: 'no_solicitor',
  blocker: 'hmlr_not_fetched',
  urgency: 'soon',
};

Deno.test('validateMonitorFireRequest accepts a well-formed request', () => {
  const r = validateMonitorFireRequest(VALID_MONITOR_FIRE);
  assertEquals(r.action, 'monitor_fire');
  assertEquals(r.txId, 'tx_1');
  assertEquals(r.previousBlocker, 'no_solicitor');
  assertEquals(r.blocker, 'hmlr_not_fetched');
  assertEquals(r.urgency, 'soon');
});

Deno.test('validateMonitorFireRequest allows an empty previousBlocker', () => {
  const r = validateMonitorFireRequest({ ...VALID_MONITOR_FIRE, previousBlocker: '' });
  assertEquals(r.previousBlocker, '');
});

Deno.test('validateMonitorFireRequest rejects a missing txId', () => {
  const bad = { ...VALID_MONITOR_FIRE, txId: undefined };
  assertThrows(() => validateMonitorFireRequest(bad), ValidationError, 'txId');
});

Deno.test('validateMonitorFireRequest rejects an empty blocker', () => {
  const bad = { ...VALID_MONITOR_FIRE, blocker: '' };
  assertThrows(() => validateMonitorFireRequest(bad), ValidationError);
});

Deno.test('validateMonitorFireRequest rejects a bad urgency', () => {
  const bad = { ...VALID_MONITOR_FIRE, urgency: 'urgent' };
  assertThrows(() => validateMonitorFireRequest(bad), ValidationError, 'urgency');
});

Deno.test('validateMonitorFireRequest rejects a wrong action', () => {
  assertThrows(() => validateMonitorFireRequest({ ...VALID_MONITOR_FIRE, action: 'fire' }), ValidationError, 'monitor_fire');
});

Deno.test('validateMonitorFireRequest rejects a blocker with a bad charset', () => {
  const bad = { ...VALID_MONITOR_FIRE, blocker: 'HMLR_NOT_FETCHED' };
  assertThrows(() => validateMonitorFireRequest(bad), ValidationError);
});
