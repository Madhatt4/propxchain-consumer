// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppTopBar from '@/components/navigation/AppTopBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../stores/authStore';
import {
  Bot,
  Activity,
  Copy,
  ExternalLink,
  Loader2,
  AlertCircle,
  Unplug,
} from 'lucide-react';
import { icpService } from '../services/icp.service';
import {
  botConnectionService,
  type BotConnectionInfo,
} from '../services/botConnection.service';
import AgentActivityPanel from '../components/agent/AgentActivityPanel';

// ─── Types ────────────────────────────────────────────────────────────────

interface TransactionSummary {
  id: string;
  propertyAddress: string;
  status: string;
}

interface TransactionBotGroup {
  transaction: TransactionSummary;
  bots: BotConnectionInfo[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function truncatePrincipal(principal: string, chars: number = 10): string {
  if (principal.length <= chars * 2 + 3) return principal;
  return `${principal.slice(0, chars)}...${principal.slice(-5)}`;
}

function formatBotDate(nanos: bigint): string {
  const ms = Number(nanos) / 1_000_000;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── MCP Tools (matches actual STDIO server) ─────────────────────────────

const MCP_TOOLS = [
  { name: 'propxchain_get_transaction_detail', desc: 'Get full details of a specific transaction' },
  { name: 'propxchain_search_transactions', desc: 'Search transactions by address or invite code' },
  { name: 'propxchain_get_transaction_status', desc: 'Get status and timeline of a transaction' },
  { name: 'propxchain_list_transaction_documents', desc: 'List document proofs for a transaction' },
  { name: 'propxchain_verify_document', desc: 'Verify a document hash against the on-chain record' },
  { name: 'propxchain_upload_document_hash', desc: 'Register a document hash on-chain (GDPR)' },
  { name: 'propxchain_get_checklist', desc: 'Get the conveyancing checklist for a transaction' },
  { name: 'propxchain_update_checklist_item', desc: 'Update a checklist item status' },
  { name: 'propxchain_get_property_intelligence', desc: 'Postcode-based property intelligence' },
  { name: 'propxchain_explain_process', desc: 'Explain a conveyancing concept or process' },
  { name: 'propxchain_list_my_transactions', desc: 'List all transactions this bot can access' },
  { name: 'propxchain_list_connected_bots', desc: 'List bots connected to a transaction' },
];

// ─── Claude Desktop Config Snippet ────────────────────────────────────────

const CLAUDE_CONFIG_SNIPPET = `{
  "mcpServers": {
    "propxchain": {
      "command": "propxchain-mcp-server",
      "env": { "IC_NETWORK": "ic" }
    }
  }
}`;

// ─── Main Page ────────────────────────────────────────────────────────────

const BotAgentSettings: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<{ principal: string } | null>(null);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [botGroups, setBotGroups] = useState<TransactionBotGroup[]>([]);
  const [isLoadingBots, setIsLoadingBots] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTransactions = useCallback(async (): Promise<void> => {
    try {
      await icpService.initialize();
      const txns = await icpService.getMyTransactions();
      setTransactions(txns.map((tx: Record<string, unknown>) => ({
        id: tx.id as string,
        propertyAddress: (tx.propertyAddress as string) || '',
        status: (tx.status as string) || 'active',
      })));
    } catch {
      /* non-fatal: bot list just shows empty */
    }
  }, []);

  const loadAllBots = useCallback(async (txns: TransactionSummary[]): Promise<void> => {
    if (txns.length === 0) { setBotGroups([]); return; }
    setIsLoadingBots(true);
    setLoadError(null);
    try {
      const groups: TransactionBotGroup[] = [];
      for (const tx of txns) {
        try {
          const bots = await botConnectionService.getTransactionBots(tx.id);
          if (bots.length > 0) groups.push({ transaction: tx, bots });
        } catch { /* skip — bot query may fail if caller isn't on accessList */ }
      }
      setBotGroups(groups);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load bots.');
    } finally {
      setIsLoadingBots(false);
    }
  }, []);

  useEffect(() => {
    const authState = useAuthStore.getState();
    const principalId = authState.principalId;
    if (!principalId || !authState.isAuthenticated) {
      navigate('/login');
      return;
    }
    setUser({ principal: principalId });
    loadTransactions();
  }, [navigate, loadTransactions]);

  useEffect(() => {
    if (transactions.length > 0) void loadAllBots(transactions);
  }, [transactions, loadAllBots]);

  const handleDisconnect = async (txId: string, botPrincipal: string): Promise<void> => {
    try {
      await botConnectionService.disconnectBot(txId, botPrincipal);
      toast({ title: 'Bot Disconnected', description: 'Removed from transaction access list.' });
      void loadAllBots(transactions);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to disconnect.', variant: 'destructive' });
    }
  };

  const totalBots = botGroups.reduce((sum, g) => sum + g.bots.length, 0);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar title="AI Agents" backTo="/dashboard" backLabel="Back to dashboard" />
      <main className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Bot className="h-7 w-7" /> Bot Agents
            </h2>
            <p className="text-muted-foreground mt-1">
              Connect AI bots to your transactions via MCP. Each bot gets its own Ed25519 identity.
            </p>
          </div>

          <Tabs defaultValue="my-bots" className="space-y-4">
            <TabsList>
              <TabsTrigger value="my-bots">
                <Bot className="h-4 w-4 mr-2" /> My Bots {totalBots > 0 && (
                  <Badge className="ml-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">{totalBots}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="h-4 w-4 mr-2" /> Agent Activity
              </TabsTrigger>
              <TabsTrigger value="mcp-guide">
                <ExternalLink className="h-4 w-4 mr-2" /> Set Up a Bot
              </TabsTrigger>
            </TabsList>

            {/* ──── Tab: My Bots ──── */}
            <TabsContent value="my-bots" className="space-y-4">
              {isLoadingBots ? (
                <Card>
                  <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-400" />
                    <span className="ml-3 text-gray-600 dark:text-gray-400">Loading connected bots...</span>
                  </CardContent>
                </Card>
              ) : loadError ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 space-y-3">
                    <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    <p className="text-red-600 dark:text-red-400 text-sm">{loadError}</p>
                    <Button variant="outline" size="sm" onClick={() => void loadAllBots(transactions)}>Retry</Button>
                  </CardContent>
                </Card>
              ) : botGroups.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 space-y-3">
                    <Bot className="h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="text-gray-600 dark:text-gray-400 text-center">No bots connected to any transactions yet.</p>
                    <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
                      Set up an MCP agent at <a href="/agent" target="_blank" rel="noopener noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline">propxchain.com/agent</a>, then ask it to join using one of your transaction invite codes.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                botGroups.map((group) => (
                  <Card key={group.transaction.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          {group.transaction.id}
                        </CardTitle>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                          {group.transaction.status}
                        </Badge>
                      </div>
                      {group.transaction.propertyAddress && (
                        <CardDescription className="text-sm">
                          {group.transaction.propertyAddress}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {group.bots.map((bot) => (
                        <div key={bot.principal} className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-700/30 rounded-md">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-300 text-sm font-bold">B</div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{bot.name}</p>
                              <div className="flex items-center gap-1.5">
                                <code className="text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                  {truncatePrincipal(bot.principal)}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => void navigator.clipboard.writeText(bot.principal)}
                                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                  title="Copy full principal"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Connected {formatBotDate(bot.addedAt)}</p>
                            </div>
                          </div>
                          {bot.addedBy === user.principal && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => void handleDisconnect(group.transaction.id, bot.principal)}
                              className="border-red-600/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                            >
                              <Unplug className="h-3.5 w-3.5 mr-1" /> Disconnect
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ──── Tab: Agent Activity ──── */}
            <TabsContent value="activity">
              <AgentActivityPanel userId={useAuthStore.getState().supabaseUser?.id ?? null} />
            </TabsContent>

            {/* ──── Tab: Set Up a Bot ──── */}
            <TabsContent value="mcp-guide" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" /> Install the MCP server
                  </CardTitle>
                  <CardDescription>
                    Two copy-pastes and a Claude Desktop restart. Done once, then ask any AI agent to help with your transactions using the &quot;Get AI assistance&quot; button on each transaction page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Step 1. Install</Label>
                    <div className="relative">
                      <pre className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 text-sm font-mono text-teal-700 dark:text-teal-300 overflow-x-auto">
                        npm install -g @propxchain/mcp-server
                      </pre>
                      <Button
                        variant="ghost" size="sm"
                        className="absolute top-2 right-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={async () => {
                          await navigator.clipboard.writeText('npm install -g @propxchain/mcp-server');
                          toast({ title: 'Copied' });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Step 2. Add to Claude Desktop config</Label>
                    <div className="relative">
                      <pre className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 text-sm font-mono text-emerald-700 dark:text-emerald-400 overflow-x-auto">
                        {CLAUDE_CONFIG_SNIPPET}
                      </pre>
                      <Button
                        variant="ghost" size="sm"
                        className="absolute top-2 right-2 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={async () => {
                          await navigator.clipboard.writeText(CLAUDE_CONFIG_SNIPPET);
                          toast({ title: 'Copied', description: 'Config snippet copied to clipboard.' });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Config path: <code className="text-gray-600 dark:text-gray-400">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows) or <code className="text-gray-600 dark:text-gray-400">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS). No private key in the config: the MCP server generates one locally on first launch.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Step 3. Restart Claude Desktop, then join a transaction</Label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fully quit and relaunch Claude Desktop. Open one of your transactions, copy the invite code (TX-XXXX-XXXX), and tell your AI:
                    </p>
                    <pre className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded p-3 text-sm font-mono text-gray-700 dark:text-gray-300 overflow-x-auto">
                      join propxchain transaction TX-XXXX-XXXX as a bot called &quot;Claude Desktop&quot;
                    </pre>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      That&apos;s it. The bot shows up in the transaction&apos;s bot panel and you can revoke it from there at any time.
                    </p>
                  </div>

                  <p className="text-sm">
                    <a
                      href="/agent"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 hover:underline"
                    >
                      Full setup guide and machine-readable manifest at /agent →
                    </a>
                  </p>
                </CardContent>
              </Card>

              {/* Available Tools */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" /> Available MCP Tools ({MCP_TOOLS.length})
                  </CardTitle>
                  <CardDescription>
                    Tools your bot can invoke through the MCP protocol
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {MCP_TOOLS.map((tool) => (
                      <div key={tool.name} className="flex items-start gap-3 p-2 rounded bg-gray-100 dark:bg-gray-700/30">
                        <code className="text-xs font-mono text-blue-700 dark:text-blue-400 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">
                          {tool.name}
                        </code>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{tool.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
};

export default BotAgentSettings;
