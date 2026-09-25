import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Principal } from '@propxchain/core-client';
import { SolicitorCard } from '../SolicitorCard';
import type { SolicitorRecord } from '../../../types/solicitor.types';

const mockSolicitor: SolicitorRecord = {
  principal: Principal.fromText('aaaaa-aa'),
  name: 'Jane Smith',
  email: 'jane@smithpartners.co.uk',
  firmName: 'Smith & Partners LLP',
  regulatoryBody: 'sra',
  regNumber: '654321',
  verified: true,
  piiCertUploaded: true,
  tasks: [
    { taskType: 'tr1_preparation', status: 'in_progress', priceGBP: 15000, startedAt: 1710000000000000000n, completedAt: null, evidenceDocId: null },
    { taskType: 'ap1_submission', status: 'pending', priceGBP: 7500, startedAt: null, completedAt: null, evidenceDocId: null },
    { taskType: 'identity_certification', status: 'pending', priceGBP: 5000, startedAt: null, completedAt: null, evidenceDocId: null },
  ],
  joinedAt: 1710000000000000000n,
  consentRecordedAt: 1710000000000000000n,
  actingFor: 'buyer',
  removalRequested: false,
};

describe('SolicitorCard', () => {
  it('should render invite button when no solicitor assigned', () => {
    const onInvite = vi.fn();
    render(<SolicitorCard solicitor={null} isPending={false} onInvite={onInvite} />);
    const button = screen.getByText('+ Invite Solicitor / Conveyancer');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onInvite).toHaveBeenCalledOnce();
  });

  it('should render pending state when invited', () => {
    render(<SolicitorCard solicitor={null} isPending={true} onInvite={vi.fn()} />);
    expect(screen.getByText('Solicitor Invited')).toBeTruthy();
    expect(screen.getByText('Awaiting acceptance')).toBeTruthy();
  });

  it('should render active solicitor with task progress', () => {
    render(<SolicitorCard solicitor={mockSolicitor} isPending={false} onInvite={vi.fn()} />);
    expect(screen.getByText('Jane Smith')).toBeTruthy();
  });

  it('should render complete state when all tasks done', () => {
    const completeSolicitor: SolicitorRecord = {
      ...mockSolicitor,
      tasks: mockSolicitor.tasks.map((t) => ({
        ...t,
        status: 'completed' as const,
        completedAt: 1710100000000000000n,
      })),
    };
    render(<SolicitorCard solicitor={completeSolicitor} isPending={false} onInvite={vi.fn()} />);
    expect(screen.getByText(/All restricted tasks completed/)).toBeTruthy();
  });
});
