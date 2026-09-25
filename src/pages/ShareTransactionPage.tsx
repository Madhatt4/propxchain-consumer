import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Transaction } from '../types/transaction.types';
import { icpService } from '../services/icp.service';
import { getRightmoveData } from '@/utils/rightmoveStorage';
import { getStorePrincipalId } from '@/stores/authStore';
import {
  INVITE_ROLE_OPTIONS,
  withInviteContext,
  type InviteContext,
  type InviteRole,
} from '@/utils/inviteContext';
import QRCode from 'qrcode';

// shadcn-ui components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';
import AppTopBar from '@/components/navigation/AppTopBar';

/** Build the join link: ?rm= if a Rightmove URL exists for this tx, plus the invite role/side hints. */
function buildJoinLink(origin: string, shareableId: string, txId: string, ctx: InviteContext = {}): string {
  const base = `${origin}/join/${shareableId}`;
  const rmListing = getRightmoveData(txId);
  const withRm = rmListing?.url ? `${base}?rm=${encodeURIComponent(rmListing.url)}` : base;
  return withInviteContext(withRm, ctx);
}

/** Which side of the deal the current user is on (drives the invite's `side` hint). */
function mySideOf(tx: { seller?: unknown; buyer?: unknown } | null, me: string | null): 'buyer' | 'seller' | undefined {
  if (!tx || !me) return undefined;
  const asText = (p: unknown): string =>
    p && typeof (p as { toText?: () => string }).toText === 'function'
      ? (p as { toText: () => string }).toText()
      : String(p ?? '');
  if (asText(tx.seller) === me) return 'seller';
  if (asText(tx.buyer) === me) return 'buyer';
  return undefined;
}

const ShareTransactionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shareMethod, setShareMethod] = useState<'link' | 'id'>('id');
  const [inviteRole, setInviteRole] = useState<InviteRole>('estate_agent');
  const myPrincipal = getStorePrincipalId();
  const inviteCtx: InviteContext = {
    role: inviteRole,
    side: mySideOf(transaction, myPrincipal),
    invitedBy: myPrincipal ?? undefined,
  };
  // The QR effect closes over the first render; the ref keeps the link hints current.
  const inviteCtxRef = useRef(inviteCtx);
  inviteCtxRef.current = inviteCtx;

  // Generate QR code for a transaction (reads the latest invite hints from the ref)
  const generateQRCodeForTransaction = async (tx: any) => {
    try {
      // Use invite code if available, otherwise use transaction ID
      const shareableId = tx.inviteCode || tx.id;

      // Encode the join URL so phones open it directly when scanned
      const qrData = buildJoinLink(window.location.origin, shareableId, tx.id, inviteCtxRef.current);

      // Responsive QR code sizing
      const qrWidth = window.innerWidth < 640 ? Math.min(window.innerWidth - 64, 250) : 300;

      const url = await QRCode.toDataURL(qrData, {
        width: qrWidth,
        margin: 2,
        color: {
          dark: '#1F2937',
          light: '#FFFFFF',
        },
      });
      setQrCodeUrl(url);
    } catch (err) {
      logger.error('Error generating QR code:', err);
    }
  };

  // Re-encode the QR whenever the invitee role changes
  useEffect(() => {
    if (transaction) void generateQRCodeForTransaction(transaction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteRole]);

  useEffect(() => {
    const loadTransaction = async () => {
      if (!id) {
        navigate('/dashboard');
        return;
      }

      try {
        // Load transaction from blockchain. Direct read first — it works for
        // any party; getAllTransactions() is an admin listing (empty otherwise).
        await icpService.initialize();
        let foundTransaction: unknown = null;
        try {
          foundTransaction = await icpService.getTransactionSummary(id);
        } catch (err) {
          logger.warn('[share] direct transaction read failed, trying the list', err);
        }
        if (!foundTransaction) {
          const allTransactions = await icpService.getAllTransactions();
          foundTransaction = allTransactions.find((tx: any) =>
            tx.id?.toString().toLowerCase() === id.toLowerCase()
          );
        }

        if (!foundTransaction) {
          // Fallback to localStorage if not found on blockchain
          const localTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
          const localTx = localTransactions.find((tx: Transaction) =>
            tx.id?.toString().toLowerCase() === id.toLowerCase()
          );

          if (!localTx) {
            alert('Transaction not found');
            navigate('/dashboard');
            return;
          }

          setTransaction(localTx);
          generateQRCodeForTransaction(localTx);
        } else {
          setTransaction(foundTransaction as Transaction);
          generateQRCodeForTransaction(foundTransaction);
        }
      } catch (error) {
        logger.error('Error loading transaction from blockchain:', error);
        // Fallback to localStorage
        const allTransactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        const foundTransaction = allTransactions.find((tx: Transaction) =>
          tx.id?.toString().toLowerCase() === id.toLowerCase()
        );

        if (!foundTransaction) {
          alert('Transaction not found');
          navigate('/dashboard');
          return;
        }

        setTransaction(foundTransaction);
        generateQRCodeForTransaction(foundTransaction);
      }
    };

    loadTransaction();

    // Regenerate QR code on window resize
    const handleResize = () => {
      if (transaction) {
        generateQRCodeForTransaction(transaction);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [id, navigate]);

  const handleCopyId = () => {
    if (transaction) {
      // Use invite code if available (preferred for sharing)
      const shareableId = (transaction as any).inviteCode || transaction.id;
      navigator.clipboard.writeText(shareableId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (transaction) {
      const shareableId = (transaction as any).inviteCode || transaction.id;
      const inviteLink = buildJoinLink(window.location.origin, shareableId, transaction.id, inviteCtx);
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailShare = () => {
    if (!transaction) return;

    const shareableId = (transaction as any).inviteCode || transaction.id;
    const joinLink = buildJoinLink(window.location.origin, shareableId, transaction.id, inviteCtx);
    const subject = encodeURIComponent(`PropXchain Transaction Invitation - ${transaction.propertyAddress}`);
    const body = encodeURIComponent(
      `You've been invited to join a property transaction on PropXchain!\n\n` +
      `Property: ${transaction.propertyAddress}\n` +
      `Invite Code: ${shareableId}\n\n` +
      `To join:\n` +
      `1. Visit ${window.location.origin}\n` +
      `2. Log in with Internet Identity\n` +
      `3. Click "Enter Transaction ID" on the dashboard\n` +
      `4. Enter the Invite Code above\n\n` +
      `Or use this direct link: ${joinLink}\n\n` +
      `PropXchain - Blockchain-Powered Property Transactions`
    );

    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSMSShare = () => {
    if (!transaction) return;

    const shareableId = (transaction as any).inviteCode || transaction.id;
    const joinLink = buildJoinLink(window.location.origin, shareableId, transaction.id, inviteCtx);
    const message = encodeURIComponent(
      `PropXchain Invitation: ${transaction.propertyAddress}\n` +
      `Invite Code: ${shareableId}\n` +
      `Join at: ${joinLink}`
    );

    window.location.href = `sms:?&body=${message}`;
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `propxchain-transaction-${transaction?.id}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  if (!transaction) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)] w-96">
          <CardContent className="p-8">
            <div className="space-y-4">
              <Skeleton className="h-8 w-48 bg-[var(--bg-section)]" />
              <Skeleton className="h-4 w-full bg-[var(--bg-section)]" />
              <Skeleton className="h-32 w-full bg-[var(--bg-section)]" />
            </div>
            <p className="text-[var(--text-muted)] text-sm mt-4 text-center">Loading transaction...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar
        title={transaction.propertyAddress || 'Property'}
        subtitle="Share transaction"
        backTo={`/transaction/${transaction.id}/flow`}
        backLabel="Back to transaction"
      />

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Transaction Info Header */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mb-6">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[var(--text-main)] mb-2">
                  Share Transaction
                </h2>
                <p className="text-lg text-[var(--text-secondary)] mb-1">
                  {transaction.propertyAddress}
                </p>
                <p className="text-sm text-[var(--text-muted)]">
                  Transaction Type: <span className="capitalize">{transaction.transactionType}</span>
                </p>
              </div>
              <Badge
                className={cn(
                  transaction.mode === 'diy' && "bg-green-600 hover:bg-green-600",
                  transaction.mode === 'hybrid' && "bg-[var(--bg-section)] hover:bg-[var(--bg-section)]",
                  transaction.mode !== 'diy' && transaction.mode !== 'hybrid' && "bg-purple-600 hover:bg-purple-600"
                )}
              >
                {transaction.mode === 'diy' ? 'DIY Mode' : transaction.mode === 'hybrid' ? 'Hybrid Mode' : 'Professional Mode'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Who is being invited — labels them and puts them on your side of the deal */}
        <div className="mb-4">
          <label htmlFor="invite-role" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
            Who are you inviting?
          </label>
          <select
            id="invite-role"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as InviteRole)}
            className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-main)]"
          >
            {INVITE_ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            The link and QR below carry this so they appear correctly in your Transaction Wallet.
          </p>
        </div>

        {/* Share Method Tabs */}
        <div className="flex space-x-2 mb-6">
          <Button
            onClick={() => setShareMethod('id')}
            variant={shareMethod === 'id' ? 'default' : 'secondary'}
            className={cn("flex-1", shareMethod === 'id' && "bg-[var(--bg-section)] hover:bg-[var(--border-light)]")}
          >
            Share Transaction ID
          </Button>
          <Button
            onClick={() => setShareMethod('link')}
            variant={shareMethod === 'link' ? 'default' : 'secondary'}
            className={cn("flex-1", shareMethod === 'link' && "bg-[var(--bg-section)] hover:bg-[var(--border-light)]")}
          >
            Share Invite Link
          </Button>
        </div>

        {/* Transaction ID Sharing */}
        {shareMethod === 'id' && (
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mb-6">
            <CardHeader>
              <CardTitle className="text-[var(--text-main)]">Transaction ID</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                Share this ID with the other party. They can enter it in PropXchain to join the transaction.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Transaction ID / Invite Code Display */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
                <div className="flex-1 bg-[var(--bg-section)]/50 rounded-lg p-4 border-2 border-[var(--border-color)]">
                  <p className="text-lg sm:text-2xl font-mono text-[var(--text-main)] text-center tracking-wider break-all">
                    {(transaction as any).inviteCode || transaction.id}
                  </p>
                  {(transaction as any).inviteCode && (
                    <p className="text-xs text-[var(--text-muted)] text-center mt-1">Invite Code (TX-XXXX-XXXX format)</p>
                  )}
                </div>
                <Button
                  onClick={handleCopyId}
                  size="lg"
                  className={cn(
                    "min-h-[44px]",
                    copied ? "bg-green-600 hover:bg-green-600" : "bg-[var(--bg-section)] hover:bg-[var(--border-light)]"
                  )}
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="text-center">
                  <h4 className="text-md font-semibold text-[var(--text-main)] mb-3">
                    Or scan QR Code
                  </h4>
                  <div className="inline-block bg-white p-3 sm:p-4 rounded-lg max-w-full">
                    <img src={qrCodeUrl} alt="Transaction QR Code" className="w-full max-w-[250px] sm:max-w-[300px] h-auto mx-auto" />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={handleDownloadQR}
                    className="mt-4"
                  >
                    Download QR Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invite Link Sharing */}
        {shareMethod === 'link' && (
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mb-6">
            <CardHeader>
              <CardTitle className="text-[var(--text-main)]">Invite Link</CardTitle>
              <CardDescription className="text-[var(--text-muted)]">
                Share this link with the other party. Clicking it will take them directly to the join page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Invite Link Display */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex-1 bg-[var(--bg-section)]/50 rounded-lg p-4 border-2 border-[var(--border-color)]">
                  <p className="text-sm font-mono text-[var(--text-main)] break-all">
                    {buildJoinLink(window.location.origin, (transaction as any).inviteCode || transaction.id, transaction.id, inviteCtx)}
                  </p>
                </div>
                <Button
                  onClick={handleCopyLink}
                  size="lg"
                  className={cn(
                    "min-h-[44px]",
                    copied ? "bg-green-600 hover:bg-green-600" : "bg-[var(--bg-section)] hover:bg-[var(--border-light)]"
                  )}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Share Options */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mb-6">
          <CardHeader>
            <CardTitle className="text-[var(--text-main)]">Quick Share</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleEmailShare}
                size="lg"
                className="h-14 bg-[var(--bg-section)] hover:bg-[var(--border-light)]"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Share via Email
              </Button>
              <Button
                onClick={handleSMSShare}
                size="lg"
                className="h-14 bg-green-600 hover:bg-green-700"
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Share via SMS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardHeader>
            <CardTitle className="text-[var(--text-main)]">How to Join (For the Other Party)</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-[var(--text-muted)]">
              <li className="flex items-start">
                <Badge className="flex-shrink-0 w-6 h-6 bg-[var(--bg-section)] hover:bg-[var(--bg-section)] rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  1
                </Badge>
                <span>
                  <strong className="text-[var(--text-main)]">Visit PropXchain</strong> - Go to {window.location.origin}
                </span>
              </li>
              <li className="flex items-start">
                <Badge className="flex-shrink-0 w-6 h-6 bg-[var(--bg-section)] hover:bg-[var(--bg-section)] rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  2
                </Badge>
                <span>
                  <strong className="text-[var(--text-main)]">Log in</strong> - Use Internet Identity to authenticate
                </span>
              </li>
              <li className="flex items-start">
                <Badge className="flex-shrink-0 w-6 h-6 bg-[var(--bg-section)] hover:bg-[var(--bg-section)] rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  3
                </Badge>
                <span>
                  <strong className="text-[var(--text-main)]">Enter Transaction ID</strong> - Click "Enter Transaction ID" on the dashboard
                </span>
              </li>
              <li className="flex items-start">
                <Badge className="flex-shrink-0 w-6 h-6 bg-[var(--bg-section)] hover:bg-[var(--bg-section)] rounded-full flex items-center justify-center text-sm font-bold mr-3">
                  4
                </Badge>
                <span>
                  <strong className="text-[var(--text-main)]">Paste and Join</strong> - Enter the Transaction ID and click "Join Transaction"
                </span>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-[var(--bg-card)]/20 border border-[var(--border-color)] rounded-lg">
              <p className="text-[var(--text-secondary)] text-sm">
                <strong>Privacy Note:</strong> The other party will only see transaction progress information.
                Full property details remain private to their own transaction while maintaining GDPR compliance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Current Participants */}
        {transaction.parties && transaction.parties.length > 0 && (
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mt-6">
            <CardHeader>
              <CardTitle className="text-[var(--text-main)]">Current Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transaction.parties.map((party, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[var(--bg-section)]/50 rounded">
                  <div>
                    <p className="font-medium text-[var(--text-main)]">{party.name}</p>
                    <p className="text-sm text-[var(--text-muted)] capitalize">{party.role}</p>
                  </div>
                  <Badge
                    variant={party.verified ? "default" : "secondary"}
                    className={party.verified ? "bg-green-600 hover:bg-green-600" : "bg-yellow-600 hover:bg-yellow-600"}
                  >
                    {party.verified ? 'Verified' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ShareTransactionPage;
