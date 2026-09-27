import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

import { sendEnquiry, type EnquiryInput } from '../enquiry.service';

const INPUT: EnquiryInput = {
  kind: 'partner',
  name: 'Sam Partner',
  email: 'sam@example.com',
  fields: { company: 'Example Ltd', partnerType: 'referral' },
  fax: '',
};

describe('sendEnquiry', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('should post the enquiry to the enquiry edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });

    await sendEnquiry(INPUT);

    expect(mockInvoke).toHaveBeenCalledWith('enquiry', { body: INPUT });
  });

  it('should throw when the function reports an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('invalid_fields') });

    await expect(sendEnquiry(INPUT)).rejects.toThrow('invalid_fields');
  });

  it('should throw when the email was not sent', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false }, error: null });

    await expect(sendEnquiry(INPUT)).rejects.toThrow('email failed');
  });

  it('should throw when the network call throws', async () => {
    mockInvoke.mockRejectedValue(new Error('offline'));

    await expect(sendEnquiry(INPUT)).rejects.toThrow('offline');
  });
});
