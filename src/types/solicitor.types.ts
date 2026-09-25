import type { Principal } from '@propxchain/core-client';

export type RegulatoryBody = 'sra' | 'clc';

export type SolicitorTaskType = 'tr1_preparation' | 'ap1_submission' | 'identity_certification';

export type SolicitorTaskStatus = 'pending' | 'in_progress' | 'completed' | 'confirmed_by_client';

export interface SolicitorTask {
  taskType: SolicitorTaskType;
  status: SolicitorTaskStatus;
  priceGBP: number;
  startedAt: bigint | null;
  completedAt: bigint | null;
  evidenceDocId: string | null;
}

export interface SolicitorRecord {
  principal: Principal;
  name: string;
  email: string;
  firmName: string;
  regulatoryBody: RegulatoryBody;
  regNumber: string;
  verified: boolean;
  piiCertUploaded: boolean;
  tasks: SolicitorTask[];
  joinedAt: bigint;
  consentRecordedAt: bigint;
  actingFor: 'buyer' | 'seller' | 'both';
  removalRequested: boolean;
}

export interface SolicitorVerificationResult {
  verified: boolean;
  name: string;
  firm: string;
  status: string;
}

export const SOLICITOR_TASK_LABELS: Record<SolicitorTaskType, { name: string; description: string }> = {
  tr1_preparation: {
    name: 'TR1 Preparation & Certification',
    description: 'Transfer deed — prepares, certifies signatures, ensures title accuracy',
  },
  ap1_submission: {
    name: 'AP1 Submission to Land Registry',
    description: 'Application to register transfer — submits via LR portal or CRM integration',
  },
  identity_certification: {
    name: 'Identity Certification (AP1 Panel 7)',
    description: 'Certifies party identities for Land Registry — avoids ID1 forms',
  },
};

export const TASK_PRICE_MIN_PENCE = 0;
export const TASK_PRICE_MAX_PENCE = 999900; // £9,999
