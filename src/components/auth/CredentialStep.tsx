// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { verifySolicitorCredentials } from '../../services/solicitor.service';
import type { RegulatoryBody, SolicitorVerificationResult } from '../../types/solicitor.types';

interface CredentialStepData {
  regulatoryBody: RegulatoryBody;
  regNumber: string;
  verified: boolean;
  name: string;
  firmName: string;
}

interface CredentialStepProps {
  onComplete: (data: CredentialStepData) => void;
  onBack: () => void;
}

const CredentialStep: React.FC<CredentialStepProps> = ({ onComplete, onBack }) => {
  const [regulatoryBody, setRegulatoryBody] = useState<RegulatoryBody>('sra');
  const [regNumber, setRegNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [verifyResult, setVerifyResult] = useState<SolicitorVerificationResult | null>(null);
  const [piiUploaded, setPiiUploaded] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualFirm, setManualFirm] = useState('');

  const handleVerify = async (): Promise<void> => {
    if (!regNumber.trim()) {
      setVerifyError('Registration number is required.');
      return;
    }

    setIsVerifying(true);
    setVerifyError('');
    setVerifyResult(null);
    setApiUnavailable(false);

    try {
      const result = await verifySolicitorCredentials(regulatoryBody, regNumber.trim());
      if (result.verified) {
        setVerifyResult(result);
      } else {
        setVerifyError(`Verification failed: ${result.status || 'Number not found on register.'}`);
      }
    } catch (err: unknown) {
      setApiUnavailable(true);
      setVerifyError('Verification service is currently unavailable. You can proceed with manual entry — your credentials will be verified within 24 hours.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setPiiUploaded(!!e.target.files && e.target.files.length > 0);
  };

  const canProceedVerified = verifyResult?.verified === true && piiUploaded;
  const canProceedManual = apiUnavailable && manualName.trim() && manualFirm.trim() && regNumber.trim() && piiUploaded;
  const canProceed = canProceedVerified || canProceedManual;

  const handleNext = (): void => {
    if (!canProceed) return;
    if (verifyResult?.verified) {
      onComplete({
        regulatoryBody,
        regNumber: regNumber.trim(),
        verified: true,
        name: verifyResult.name,
        firmName: verifyResult.firm,
      });
    } else if (apiUnavailable) {
      onComplete({
        regulatoryBody,
        regNumber: regNumber.trim(),
        verified: false,
        name: manualName.trim(),
        firmName: manualFirm.trim(),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Regulatory Credentials</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Verify your solicitor registration before joining this transaction.
        </p>
      </div>

      {/* Regulatory body toggle */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Regulatory Body
        </label>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => { setRegulatoryBody('sra'); setVerifyResult(null); setVerifyError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              regulatoryBody === 'sra'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            SRA
          </button>
          <button
            type="button"
            onClick={() => { setRegulatoryBody('clc'); setVerifyResult(null); setVerifyError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              regulatoryBody === 'clc'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            }`}
          >
            CLC
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          {regulatoryBody === 'sra'
            ? 'Solicitors Regulation Authority — for solicitors and law firms'
            : 'Council for Licensed Conveyancers — for licensed conveyancers'}
        </p>
      </div>

      {/* Registration number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Registration Number
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={regNumber}
            onChange={(e) => { setRegNumber(e.target.value); setVerifyResult(null); setVerifyError(''); }}
            placeholder={regulatoryBody === 'sra' ? 'e.g. 123456' : 'e.g. 1234567'}
            className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            disabled={isVerifying}
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={isVerifying || !regNumber.trim()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isVerifying || !regNumber.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isVerifying ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Verification error */}
      {verifyError && (
        <div className={`p-3 rounded-lg ${apiUnavailable ? 'bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700'}`}>
          <p className={`text-sm ${apiUnavailable ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>{verifyError}</p>
        </div>
      )}

      {/* Manual entry fallback when API is unavailable */}
      {apiUnavailable && (
        <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium uppercase tracking-wide">Manual Entry</p>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Firm Name</label>
            <input
              type="text"
              value={manualFirm}
              onChange={(e) => setManualFirm(e.target.value)}
              placeholder="e.g. Smith & Partners LLP"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-400">Pending verification — your {regulatoryBody.toUpperCase()} number will be checked within 24 hours.</p>
        </div>
      )}

      {/* Verification success */}
      {verifyResult?.verified && (
        <div className="p-4 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-green-700 dark:text-green-300 font-semibold text-sm">Verified</p>
              <p className="text-green-800 dark:text-green-200 text-sm mt-0.5">{verifyResult.name}</p>
              <p className="text-green-600 dark:text-green-400 text-xs">{verifyResult.firm}</p>
            </div>
          </div>
        </div>
      )}

      {/* PII certificate upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          PII Certificate
        </label>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Upload your Professional Indemnity Insurance certificate (PDF or image).
        </p>
        <label className={`flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          piiUploaded
            ? 'border-green-600 bg-green-50 dark:bg-green-900/10'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-gray-500'
        }`}>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileChange}
            className="sr-only"
          />
          {piiUploaded ? (
            <>
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-green-700 dark:text-green-300 text-sm">Certificate uploaded</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-gray-600 dark:text-gray-400 text-sm">Click to upload PII certificate</span>
            </>
          )}
        </label>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 px-4 rounded-lg text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-sm"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default CredentialStep;
