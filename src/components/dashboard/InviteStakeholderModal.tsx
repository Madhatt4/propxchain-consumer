import React, { useState } from 'react';
import { Copy, Check, Mail, Link as LinkIcon, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { icpService } from '../../services/icp.service';
import { logger } from '@/utils/logger';

interface InviteStakeholderModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  transactionAddress: string;
  inviteCode?: string; // The actual invite code from blockchain (TX-XXXX-XXXX format)
}

export const InviteStakeholderModal: React.FC<InviteStakeholderModalProps> = ({
  isOpen,
  onClose,
  transactionId,
  transactionAddress,
  inviteCode: propInviteCode
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteCode, setInviteCode] = useState<string>(propInviteCode || '');
  const [loadingCode, setLoadingCode] = useState(false);

  // Fetch invite code from blockchain if not provided
  React.useEffect(() => {
    const fetchInviteCode = async () => {
      if (propInviteCode) {
        setInviteCode(propInviteCode);
        return;
      }

      setLoadingCode(true);
      try {
        // Try to get invite code from the transaction
        // getInviteCode returns a Result variant, not an opt. The old
        // `result.length > 0 && 'ok' in result[0]` read `.length` off a plain
        // object — always undefined, so the code was never set.
        const result = await icpService.transactionManager?.getInviteCode(transactionId);
        if (result && 'ok' in result) {
          setInviteCode(result.ok);
        }
      } catch (error) {
        logger.error('Error fetching invite code:', error);
      } finally {
        setLoadingCode(false);
      }
    };

    if (isOpen && !inviteCode) {
      fetchInviteCode();
    }
  }, [isOpen, transactionId, propInviteCode]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    // Use invite code in the link, not transaction ID
    const link = `${window.location.origin}/join/${encodeURIComponent(inviteCode)}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Invite Stakeholder</DialogTitle>
          <DialogDescription>
            Add people to the transaction for <strong>{transactionAddress}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="w-full mt-4">
          {/* Joining is by invite code or link only: it goes through
              transaction_manager, which registers the member. The old
              "Search Users" tab called user_management.addTransactionMember
              directly — now transaction_manager/admin only (security scan
              2026-09-23, C1) — and was already broken (NaN transaction id,
              admin-only user search). */}
            <div className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Invite Code</label>
                <div className="flex gap-2">
                  {loadingCode ? (
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded text-gray-500 dark:text-gray-400">
                      Loading invite code...
                    </div>
                  ) : inviteCode ? (
                    <code className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded text-gray-500 dark:text-gray-400 font-mono text-xl font-bold tracking-wider">
                      {inviteCode}
                    </code>
                  ) : (
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded text-gray-500 dark:text-gray-400">
                      No invite code available
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    disabled={!inviteCode}
                    aria-label={copiedCode ? "Copied" : "Copy invite code"}
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Share this code with buyers. They can enter it on the Join page.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <label className="text-sm text-gray-600 dark:text-gray-400 mb-2 block">Direct Join Link</label>
                <div className="flex gap-2">
                  <code className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded text-green-600 dark:text-green-400 font-mono text-xs truncate">
                    {inviteCode ? `${window.location.origin}/join/${inviteCode}` : 'Loading...'}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                    disabled={!inviteCode}
                    aria-label={copiedLink ? "Copied" : "Copy join link"}
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-green-500" /> : <LinkIcon className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Users must log in first, then they'll be redirected to join.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!inviteCode}
                    onClick={() => window.open(`mailto:?subject=Join My Property Transaction&body=Join my property transaction on PropXchain!%0A%0AInvite Code: ${inviteCode}%0A%0AVisit ${window.location.origin}/join and enter the code above.`)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email Invite
                </Button>
                <Button
                    className="bg-gray-700 hover:bg-gray-600"
                    onClick={() => window.open(`/share-transaction/${transactionId}`, '_blank')}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  More Options
                </Button>
              </div>
            </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
