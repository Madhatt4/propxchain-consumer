import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const getTransactionBots = vi.fn();
const disconnectBot = vi.fn();
const listMyActiveAssistants = vi.fn();
const connectToDeal = vi.fn();

vi.mock('../../../services/botConnection.service', () => ({
  botConnectionService: {
    getTransactionBots: (...a: unknown[]) => getTransactionBots(...a),
    disconnectBot: (...a: unknown[]) => disconnectBot(...a),
  },
}));

vi.mock('../../../services/assistantConnect.service', () => ({
  assistantConnectService: {
    listMyActiveAssistants: (...a: unknown[]) => listMyActiveAssistants(...a),
    connectToDeal: (...a: unknown[]) => connectToDeal(...a),
  },
}));

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { principalId: string }) => unknown) => sel({ principalId: 'me' }),
}));

import BotPanelCard from '../BotPanelCard';

const ownBot = { principal: 'bot-1', name: 'Claude', addedBy: 'bot-1', addedAt: 1_700_000_000_000_000_000n, ownerPrincipal: 'me' };
const otherBot = { principal: 'bot-2', name: 'ChatGPT', addedBy: 'bot-2', addedAt: 1_700_000_000_000_000_000n, ownerPrincipal: 'sam' };
const claudeGrant = { principal: 'aaaaa-bbbbb-ccccc-ddddd-eeeee', label: 'claude.ai' };

describe('BotPanelCard', () => {
  beforeEach(() => {
    getTransactionBots.mockReset();
    disconnectBot.mockReset();
    listMyActiveAssistants.mockReset().mockResolvedValue([]);
    connectToDeal.mockReset();
  });

  it('renders nothing when the caller cannot read the deal bots', async () => {
    getTransactionBots.mockRejectedValue(new Error('Not on the access list'));
    const { container } = render(<BotPanelCard transactionId="tx1" />);
    await waitFor(() => expect(getTransactionBots).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('shows the connector hint when no bot is connected and the user has no assistants', async () => {
    getTransactionBots.mockResolvedValue([]);
    render(<BotPanelCard transactionId="tx1" />);
    await screen.findByText(/add propxchain as a connector in claude\.ai/i);
    expect(screen.getByText(/https:\/\/mcp\.propxchain\.com\/mcp/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add to this deal/i })).toBeNull();
  });

  it('offers an active assistant grant with an Add to this deal button', async () => {
    getTransactionBots.mockResolvedValue([]);
    listMyActiveAssistants.mockResolvedValue([claudeGrant]);
    render(<BotPanelCard transactionId="tx1" />);
    await screen.findByRole('button', { name: /add to this deal/i });
    expect(screen.getByText('claude.ai')).toBeTruthy();
    expect(screen.getByText('aaaaa…eeeee')).toBeTruthy();
  });

  it('does not offer an assistant that is already connected to this deal', async () => {
    getTransactionBots.mockResolvedValue([{ ...ownBot, principal: claudeGrant.principal }]);
    listMyActiveAssistants.mockResolvedValue([claudeGrant]);
    render(<BotPanelCard transactionId="tx1" />);
    await screen.findByText('Claude');
    expect(screen.queryByRole('button', { name: /add to this deal/i })).toBeNull();
    expect(screen.queryByText(/add propxchain as a connector/i)).toBeNull();
  });

  it('connects the assistant, reloads the list and confirms', async () => {
    getTransactionBots.mockResolvedValueOnce([]).mockResolvedValueOnce([{ ...ownBot, principal: claudeGrant.principal }]);
    listMyActiveAssistants.mockResolvedValue([claudeGrant]);
    connectToDeal.mockResolvedValue(undefined);
    render(<BotPanelCard transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /add to this deal/i }));
    await waitFor(() => expect(connectToDeal).toHaveBeenCalledWith('tx1', claudeGrant));
    await screen.findByText(/claude\.ai added to this deal/i);
    expect(getTransactionBots).toHaveBeenCalledTimes(2);
  });

  it('shows the canister error text when connecting is refused', async () => {
    getTransactionBots.mockResolvedValue([]);
    listMyActiveAssistants.mockResolvedValue([claudeGrant]);
    connectToDeal.mockRejectedValue(new Error('Bot principal is already registered'));
    render(<BotPanelCard transactionId="tx1" />);
    fireEvent.click(await screen.findByRole('button', { name: /add to this deal/i }));
    await screen.findByText('Bot principal is already registered');
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
