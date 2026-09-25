export const SIGNATURE_AGENT: string;
export interface SignedHeaders {
  'Signature-Agent': string;
  'Signature-Input': string;
  Signature: string;
}
export function signatureBase(authority: string, params: string): string;
export function signRequest(
  url: string,
  privateJwk: Record<string, string>,
  now?: number,
  ttlSeconds?: number,
): SignedHeaders;
export function verifyRequest(
  url: string,
  headers: SignedHeaders,
  publicJwk: object,
  now?: number,
): boolean;
