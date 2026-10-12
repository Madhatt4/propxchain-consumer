import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { useBankDetailWarnings } from '../useBankDetailWarnings';
import { BankDetailWarning } from '@/components/messaging/BankDetailWarning';

const fraud = { id: 'm1', sender: 'them', content: 'Our bank details have changed: 20-00-00 12345678' };
const plain = { id: 'm2', sender: 'them', content: 'Searches are back.' };
const mine = { id: 'm3', sender: 'me', content: 'What are your bank details?' };

describe('useBankDetailWarnings', () => {
  it('warns on received messages that mention bank details, never on my own', () => {
    const record = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useBankDetailWarnings([fraud, plain, mine], 'me', record));
    expect(result.current(fraud)).toBe(true);
    expect(result.current(plain)).toBe(false);
    expect(result.current(mine)).toBe(false);
  });

  it('records each warned message once, across re-renders', () => {
    const record = vi.fn().mockResolvedValue(true);
    const { rerender } = renderHook(({ msgs }) => useBankDetailWarnings(msgs, 'me', record), {
      initialProps: { msgs: [fraud, plain, mine] },
    });
    rerender({ msgs: [fraud, plain, mine, { ...plain, id: 'm4' }] });
    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith('m1');
  });
});

describe('BankDetailWarning', () => {
  it('tells the reader to call their conveyancer on a number they already hold', () => {
    render(<BankDetailWarning />);
    expect(screen.getByRole('alert')).toHaveTextContent(/never send money to new or changed bank details/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/phone number you already hold/i);
  });
});
