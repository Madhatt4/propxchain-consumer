// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Mainnet E2E verification for vetKD per-thread message encryption
 * (ADR 0011, audit issue #20 Part B).
 *
 * Creates ONE throwaway thread on the live message_manager canister
 * (archived afterwards), then proves:
 *   1. participant A can derive the thread key and send ciphertext
 *   2. the canister stores ciphertext only (vetkd:v1: prefix on-chain)
 *   3. participant B independently derives the SAME key and decrypts
 *   4. a non-participant C is refused the key
 *
 * Run:  node scripts/vetkd-e2e.mjs
 * Cost: 2 x vetkd_derive_key ≈ 52B cycles from message_manager.
 */

import { Actor, HttpAgent, Ed25519KeyIdentity, Principal } from '@propxchain/core-client';
import { TransportSecretKey, DerivedPublicKey, EncryptedVetKey } from '@dfinity/vetkeys';

const MESSAGE_MANAGER_CANISTER_ID = '37una-maaaa-aaaaa-qd3mq-cai';
// Must match src/services/threadCrypto.service.ts — locked by ADR 0011.
const ENCRYPTED_CONTENT_PREFIX = 'vetkd:v1:';
const CONTENT_DOMAIN_SEP = 'propxchain-msg-content-v1';

const idlFactory = ({ IDL }) => {
  const MessageType = IDL.Variant({ chase: IDL.Null, enquiry: IDL.Null, response: IDL.Null, notification: IDL.Null, general: IDL.Null });
  const MessagePriority = IDL.Variant({ low: IDL.Null, normal: IDL.Null, high: IDL.Null, urgent: IDL.Null });
  const Thread = IDL.Record({
    id: IDL.Text, transactionId: IDL.Text, subject: IDL.Text,
    participants: IDL.Vec(IDL.Principal), createdBy: IDL.Principal,
    createdAt: IDL.Int, lastMessageAt: IDL.Int, messageCount: IDL.Nat, isArchived: IDL.Bool,
  });
  const Message = IDL.Record({
    id: IDL.Text, threadId: IDL.Text, transactionId: IDL.Text,
    sender: IDL.Principal, senderName: IDL.Text, senderRole: IDL.Text,
    recipients: IDL.Vec(IDL.Principal), messageType: MessageType, priority: MessagePriority,
    subject: IDL.Text, content: IDL.Text, replyToId: IDL.Opt(IDL.Text),
    createdAt: IDL.Int, readBy: IDL.Vec(IDL.Principal), aiGenerated: IDL.Bool,
  });
  const CreateEncryptedThreadInput = IDL.Record({
    transactionId: IDL.Text, subject: IDL.Text, recipients: IDL.Vec(IDL.Principal),
    messageType: MessageType, priority: MessagePriority,
    senderName: IDL.Text, senderRole: IDL.Text, aiGenerated: IDL.Bool,
  });
  const SendMessageInput = IDL.Record({
    threadId: IDL.Text, content: IDL.Text, messageType: MessageType, priority: MessagePriority,
    senderName: IDL.Text, senderRole: IDL.Text, replyToId: IDL.Opt(IDL.Text), aiGenerated: IDL.Bool,
  });
  const Result = (ok, err) => IDL.Variant({ ok, err });
  return IDL.Service({
    createEncryptedThread: IDL.Func([CreateEncryptedThreadInput], [Result(Thread, IDL.Text)], []),
    sendMessage: IDL.Func([SendMessageInput], [Result(Message, IDL.Text)], []),
    getThreadMessages: IDL.Func([IDL.Text], [Result(IDL.Vec(Message), IDL.Text)], []),
    getThreadKey: IDL.Func([IDL.Text, IDL.Vec(IDL.Nat8)], [Result(IDL.Vec(IDL.Nat8), IDL.Text)], []),
    getThreadVerificationKey: IDL.Func([], [IDL.Vec(IDL.Nat8)], []),
    archiveThread: IDL.Func([IDL.Text], [Result(IDL.Bool, IDL.Text)], []),
  });
};

function actorFor(identity) {
  const agent = new HttpAgent({ host: 'https://ic0.app', identity });
  return Actor.createActor(idlFactory, { agent, canisterId: MESSAGE_MANAGER_CANISTER_ID });
}

function unwrap(result, label) {
  if ('err' in result) throw new Error(`${label} failed: ${result.err}`);
  return result.ok;
}

const b64encode = (bytes) => Buffer.from(bytes).toString('base64');
const b64decode = (text) => new Uint8Array(Buffer.from(text, 'base64'));

async function deriveThreadMaterial(actor, threadId) {
  const tsk = TransportSecretKey.random();
  const [verKeyBytes, encKeyBytes] = await Promise.all([
    actor.getThreadVerificationKey(),
    actor.getThreadKey(threadId, tsk.publicKeyBytes()).then((r) => unwrap(r, 'getThreadKey')),
  ]);
  const verKey = DerivedPublicKey.deserialize(Uint8Array.from(verKeyBytes));
  const vetKey = EncryptedVetKey.deserialize(Uint8Array.from(encKeyBytes)).decryptAndVerify(
    tsk, verKey, new TextEncoder().encode(threadId)
  );
  return vetKey.asDerivedKeyMaterial();
}

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
};

const idA = Ed25519KeyIdentity.generate();
const idB = Ed25519KeyIdentity.generate();
const idC = Ed25519KeyIdentity.generate();
const actorA = actorFor(idA);
const actorB = actorFor(idB);
const actorC = actorFor(idC);

console.log(`A=${idA.getPrincipal().toText()}`);
console.log(`B=${idB.getPrincipal().toText()}`);
console.log(`C=${idC.getPrincipal().toText()} (non-participant)`);

// 1. A creates an encrypted thread with B
const thread = unwrap(
  await actorA.createEncryptedThread({
    transactionId: 'vetkd-e2e',
    subject: `vetkd e2e ${Date.now()}`,
    recipients: [idB.getPrincipal()],
    messageType: { general: null },
    priority: { normal: null },
    senderName: 'vetkd-e2e-a',
    senderRole: 'tester',
    aiGenerated: false,
  }),
  'createEncryptedThread'
);
console.log(`thread=${thread.id}`);

// 2. A derives the key, encrypts, sends
const plaintext = `LPP-private e2e content ${Date.now()}`;
const materialA = await deriveThreadMaterial(actorA, thread.id);
const payload = await materialA.encryptMessage(plaintext, CONTENT_DOMAIN_SEP);
const ciphertext = ENCRYPTED_CONTENT_PREFIX + b64encode(payload);
unwrap(
  await actorA.sendMessage({
    threadId: thread.id,
    content: ciphertext,
    messageType: { general: null },
    priority: { normal: null },
    senderName: 'vetkd-e2e-a',
    senderRole: 'tester',
    replyToId: [],
    aiGenerated: false,
  }),
  'sendMessage'
);

// 3. On-chain content is ciphertext only
const rawMessages = unwrap(await actorB.getThreadMessages(thread.id), 'getThreadMessages(B)');
const stored = rawMessages[rawMessages.length - 1].content;
check(stored.startsWith(ENCRYPTED_CONTENT_PREFIX), 'canister stores vetkd:v1 ciphertext, not plaintext');
check(!stored.includes(plaintext), 'plaintext absent from stored content');

// 4. B independently derives the same key and decrypts
const materialB = await deriveThreadMaterial(actorB, thread.id);
const decrypted = new TextDecoder().decode(
  await materialB.decryptMessage(b64decode(stored.slice(ENCRYPTED_CONTENT_PREFIX.length)), CONTENT_DOMAIN_SEP)
);
check(decrypted === plaintext, 'participant B decrypts A\'s message (deterministic derive)');

// 5. Non-participant C is refused the key
const refusal = await actorC.getThreadKey(thread.id, TransportSecretKey.random().publicKeyBytes());
check('err' in refusal, `non-participant refused: ${'err' in refusal ? refusal.err : 'UNEXPECTED OK'}`);

// 6. Clean up: archive the test thread
unwrap(await actorA.archiveThread(thread.id), 'archiveThread');
console.log('test thread archived');

process.exit(failures === 0 ? 0 : 1);
