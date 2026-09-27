import { describe, it, expect } from 'vitest';

import { fileExtension, onChainFileName, storageObjectName } from '../onChainDocument';

describe('onChainDocument', () => {
  it('should drop the user filename and keep only type + extension', () => {
    expect(onChainFileName('ta6_attachment', 'Passport - Jane Smith.PDF')).toBe('ta6_attachment.pdf');
  });

  it('should use the bare type when the file has no extension', () => {
    expect(onChainFileName('mortgage_offer', 'scan')).toBe('mortgage_offer');
  });

  it('should ignore an "extension" that is really part of a name', () => {
    expect(fileExtension('statement.jane smith')).toBe('');
    expect(fileExtension('')).toBe('');
  });

  it('should name storage objects by hash, never by filename', () => {
    const name = storageObjectName('abcdef0123456789ffff', 'Barclays 40-12-34 J Smith.pdf');
    expect(name).toBe('abcdef012345.pdf');
    expect(name).not.toMatch(/Smith|Barclays/);
  });
});
