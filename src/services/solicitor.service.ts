import type { SolicitorVerificationResult } from '../types/solicitor.types';

const VERIFY_ENDPOINT = import.meta.env.VITE_VERIFY_SOLICITOR_URL || '/api/verify-solicitor';

export async function verifySolicitorCredentials(
  body: 'sra' | 'clc',
  regNumber: string
): Promise<SolicitorVerificationResult> {
  const response = await fetch(VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, regNumber }),
  });

  if (!response.ok) {
    throw new Error(`Verification failed: ${response.statusText}`);
  }

  return response.json() as Promise<SolicitorVerificationResult>;
}
