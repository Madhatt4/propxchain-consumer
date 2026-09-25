// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { MAX_SUBJECT } from '../../../services/supportTicket.service';
import {
  MAX_TRANSCRIPT_TURNS,
  type ChatTurn,
  ticketBody,
  ticketSubject,
  ticketTranscript,
  toMessages,
  userTurnCount,
} from '../conversation';

function turn(role: 'user' | 'assistant', text: string, id = `${role}-${text.slice(0, 4)}`): ChatTurn {
  return { id, role, text };
}

const CONVERSATION: ChatTurn[] = [
  turn('user', 'My searches have not come back'),
  turn('assistant', 'Searches usually take ten working days.'),
  turn('user', 'It has been three weeks'),
];

describe('conversation', () => {
  it('should strip display state down to role and text for the wire', () => {
    const rich: ChatTurn[] = [{ id: 'a', role: 'assistant', text: 'Hello', sources: ['/faq'], showDisclaimer: true }];

    expect(toMessages(rich)).toEqual([{ role: 'assistant', text: 'Hello' }]);
  });

  it('should count only the turns the user took', () => {
    expect(userTurnCount(CONVERSATION)).toBe(2);
    expect(userTurnCount([])).toBe(0);
    expect(userTurnCount([turn('assistant', 'Hello')])).toBe(0);
  });

  it('should use the opening question as the subject, on one line', () => {
    expect(ticketSubject([turn('user', '  My searches\nhave not   come back  ')])).toBe('My searches have not come back');
  });

  it('should cap an over-long subject at the length the ticket column allows', () => {
    const subject = ticketSubject([turn('user', 'x'.repeat(MAX_SUBJECT + 50))]);

    expect(subject).toHaveLength(MAX_SUBJECT);
    expect(subject.endsWith('…')).toBe(true);
  });

  it('should fall back to a stated subject when the user never typed anything', () => {
    expect(ticketSubject([])).toBe('Support request from chat');
    expect(ticketSubject([turn('assistant', 'Hello')])).toBe('Support request from chat');
  });

  it('should make the body the user\'s own opening words, in full', () => {
    const long = 'y'.repeat(MAX_SUBJECT + 50);

    expect(ticketBody([turn('user', long)])).toBe(long);
    expect(ticketBody([])).toBe('Raised from the support chat.');
  });

  it('should rename assistant to bot, the vocabulary the ticket thread uses', () => {
    expect(ticketTranscript(CONVERSATION)).toEqual([
      { role: 'user', text: 'My searches have not come back' },
      { role: 'bot', text: 'Searches usually take ten working days.' },
      { role: 'user', text: 'It has been three weeks' },
    ]);
  });

  it('should keep the most recent turns when a conversation runs past the transcript cap', () => {
    const many = Array.from({ length: MAX_TRANSCRIPT_TURNS + 10 }, (_, i) => turn('user', `turn ${i}`, `t${i}`));

    const transcript = ticketTranscript(many);

    expect(transcript).toHaveLength(MAX_TRANSCRIPT_TURNS);
    expect(transcript[transcript.length - 1].text).toBe(`turn ${many.length - 1}`);
  });
});
