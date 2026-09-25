/** Map key for a (document, party) share pair in the Transaction Wallet. */
export function grantKey(docHash: string, principal: string): string {
  return `${docHash}:${principal}`;
}
