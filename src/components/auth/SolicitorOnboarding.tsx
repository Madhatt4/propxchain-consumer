// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { Principal } from '@propxchain/core-client';
import { usePrincipalId } from '../../stores/authStore';
import type { SolicitorRecord, SolicitorTaskType } from '../../types/solicitor.types';
import CredentialStep from './CredentialStep';
import PricingStep from './PricingStep';
import ConsentStep from './ConsentStep';

interface CredentialData {
  regulatoryBody: 'sra' | 'clc';
  regNumber: string;
  verified: boolean;
  name: string;
  firmName: string;
}

interface PricingEntry {
  taskType: SolicitorTaskType;
  priceGBP: number;
}

interface SolicitorOnboardingProps {
  transactionId: string;
  inviteCode: string;
  callerRole: 'buyer' | 'seller';
  onComplete: (record: SolicitorRecord) => void;
  onBack: () => void;
}

type OnboardingStep = 'credentials' | 'pricing' | 'consent';

const STEPS: OnboardingStep[] = ['credentials', 'pricing', 'consent'];

const STEP_LABELS: Record<OnboardingStep, string> = {
  credentials: 'Credentials',
  pricing: 'Pricing',
  consent: 'Consent',
};

const SolicitorOnboarding: React.FC<SolicitorOnboardingProps> = ({
  callerRole,
  onComplete,
  onBack,
}) => {
  const principalId = usePrincipalId();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('credentials');
  const [credentialData, setCredentialData] = useState<CredentialData | null>(null);
  const [pricingData, setPricingData] = useState<PricingEntry[] | null>(null);

  const currentIndex = STEPS.indexOf(currentStep);

  const handleCredentialComplete = (data: CredentialData): void => {
    setCredentialData(data);
    setCurrentStep('pricing');
  };

  const handlePricingComplete = (pricing: PricingEntry[]): void => {
    setPricingData(pricing);
    setCurrentStep('consent');
  };

  const handleConsentComplete = (): void => {
    if (!credentialData || !pricingData) return;

    const now = BigInt(Date.now()) * BigInt(1_000_000);

    const principal = principalId
      ? Principal.fromText(principalId)
      : Principal.anonymous();

    const record: SolicitorRecord = {
      principal,
      name: credentialData.name,
      email: '',
      firmName: credentialData.firmName,
      regulatoryBody: credentialData.regulatoryBody,
      regNumber: credentialData.regNumber,
      verified: credentialData.verified,
      piiCertUploaded: true,
      tasks: pricingData.map((p) => ({
        taskType: p.taskType,
        status: 'pending',
        priceGBP: p.priceGBP,
        startedAt: null,
        completedAt: null,
        evidenceDocId: null,
      })),
      joinedAt: now,
      consentRecordedAt: now,
      actingFor: callerRole,
      removalRequested: false,
    };

    onComplete(record);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Solicitor Onboarding</h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Acting for: <span className="capitalize text-gray-900 dark:text-gray-200">{callerRole}</span>
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                    isDone
                      ? 'bg-green-600 border-green-600 text-white'
                      : isCurrent
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`text-xs mt-1 ${isCurrent ? 'text-blue-600 dark:text-blue-400' : isDone ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-600'}`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 ${isDone ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step content */}
      {currentStep === 'credentials' && (
        <CredentialStep
          onComplete={handleCredentialComplete}
          onBack={onBack}
        />
      )}

      {currentStep === 'pricing' && (
        <PricingStep
          onComplete={handlePricingComplete}
          onBack={() => setCurrentStep('credentials')}
        />
      )}

      {currentStep === 'consent' && credentialData && (
        <ConsentStep
          solicitorName={credentialData.name}
          onComplete={handleConsentComplete}
          onBack={() => setCurrentStep('pricing')}
        />
      )}
    </div>
  );
};

export default SolicitorOnboarding;
