import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/icp.service', () => ({ icpService: {} }));
vi.mock('@/services/supabase.auth.service', () => ({ supabaseAuthService: {} }));
vi.mock('@/services/message.service', () => ({ messageService: {} }));

import { toEmailNotification } from '../useAdminDashboard';

// The Emails panel read notificationType/senderName/senderEmail/createdAt/
// isProcessed, none of which icpService.getEmailNotifications returns, so
// every row showed blank sender, blank date and "New" forever.
const ROW = {
  id: 7,
  contactType: 'sales',
  name: 'Sam Seller',
  email: 'sam@example.com',
  subject: 'Pricing',
  message: 'Hi',
  timestamp: 1_758_974_400_000_000_000, // 2025-09-27T12:00:00Z in nanoseconds
  processed: true,
};

describe('toEmailNotification', () => {
  it('should map the canister fields the service actually returns', () => {
    expect(toEmailNotification(ROW)).toEqual({
      id: 7,
      type: 'sales',
      fromName: 'Sam Seller',
      fromEmail: 'sam@example.com',
      subject: 'Pricing',
      date: '2025-09-27T12:00:00.000Z',
      status: 'processed',
      isProcessed: true,
    });
  });

  it('should mark an unprocessed row as new', () => {
    const mapped = toEmailNotification({ ...ROW, processed: false });

    expect(mapped.isProcessed).toBe(false);
    expect(mapped.status).toBe('new');
  });

  it('should leave the date blank when there is no timestamp', () => {
    expect(toEmailNotification({ ...ROW, timestamp: undefined }).date).toBe('');
  });
});
