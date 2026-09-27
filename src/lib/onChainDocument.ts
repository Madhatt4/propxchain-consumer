// Names that travel with a document onto the chain. Chain writes are
// permanent, and a user's filename routinely carries personal data
// ("Passport - Jane Smith.pdf", "Barclays statement 40-12-34.pdf"), so the
// chain only ever sees the document type plus the file extension. The real
// filename stays off-chain (local registry, Supabase metadata). Same rule the
// wallet already follows with its generic slot labels (ADR 0003).

const EXTENSION = /\.([a-z0-9]{1,8})$/i;

/** Lower-case extension with its dot (".pdf"), or "" when there isn't a plain one. */
export function fileExtension(fileName: string): string {
  const match = EXTENSION.exec(fileName.trim());
  return match ? `.${match[1].toLowerCase()}` : '';
}

/** The fileName to register on-chain: "ta6_attachment.pdf", never the user's own name. */
export function onChainFileName(documentType: string, fileName: string): string {
  return `${documentType}${fileExtension(fileName)}`;
}

/**
 * Storage object name for off-chain bytes whose location is recorded on-chain.
 * Keyed by content hash, so the path (which becomes the on-chain
 * storageLocation) carries no part of the user's filename.
 */
export function storageObjectName(fileHash: string, fileName: string): string {
  return `${fileHash.substring(0, 12)}${fileExtension(fileName)}`;
}
