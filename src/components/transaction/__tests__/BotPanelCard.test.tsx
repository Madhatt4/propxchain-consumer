import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const getTransactionBots = vi.fn();
const disconnectBot = vi.fn();

vi.mock('../../../services/botConnection.service', () => ({
  botConnectionService: {
    getTransactionBots: (...a: unknown[]) => getTransactionBots(...a),
    disconnectBot: (...a: unknown[]) => disconnectBot(...a),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { principalId: string }) => unknown) => sel({ principalId: 'me' }),
}));

import BotPanelCard from '../BotPanelCard';

const ownBot = { principal: 'bot-1', name: 'Claude', addedBy: 'bot-1', addedAt: 1_700_000_000_000_000_000n, ownerPrincipal: 'me' };
const otherBot = { principal: 'bot-2', name: 'ChatGPT', addedBy: 'bot-2', addedAt: 1_700_000_000_000_000_000n, ownerPrincipal: 'sam' };

describe('BotPanelCard', () => {
  beforeEach(() => {
    getTransactionBots.mockReset();
    disconnectBot.mockReset();
  });

  it('renders nothing when no bot is connected', async () => {
    getTransactionBots.mockResolvedValue([]);
    const { container } = render(<BotPanelCard transactionId="tx1" />);
    await waitFor(() => expect(getTransactionBots).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('shows Remove only on bots the user owns, even though addedBy is the bot', async () => {
    getTransactionBots.mockResolvedValue([ownBot, otherBot]);
    render(<BotPanelCard transactionId="tx1" />);
    await screen.findByText('Claude');
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1);
    expect(screen.getByText(/only its owner can remove it/i)).toBeTruthy();
  });

  it('lets a participant remove an old record that has no owner, and says so', async () => {
    getTransactionBots.mockResolvedValue([{ ...ownBot, ownerPrincipal: null }]);
    render(<BotPanelCard transactionId="tx1" />);
    await screen.findByText(/owner: not recorded/i);
    expect(screen.getAllByRole('button', { name: /^remove$/i })).toHaveLength(1);
  });

  it('asks for confirmation, then disconnects and reloads', async () => {
    getTransactionBots.mockResolvedValueOnce([ownBot]).mockResolvedValueOnce([]);
    disconnectBot.mockResolvedValue(undefined);
    render(<BotPanelCard transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /^remove$/i }));
    expect(disconnectBot).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /remove assistant/i }));
    await waitFor(() => expect(disconnectBot).toHaveBeenCalledWith('tx1', 'bot-1'));
    await screen.findByText(/removed\. this is recorded in the audit trail/i);
  });

  it('shows the canister error when removal is refused', async () => {
    getTransactionBots.mockResolvedValue([ownBot]);
    disconnectBot.mockRejectedValue(new Error('Only the bot owner can remove it'));
    render(<BotPanelCard transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /^remove$/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove assistant/i }));
    await screen.findByText('Only the bot owner can remove it');
  });
});
