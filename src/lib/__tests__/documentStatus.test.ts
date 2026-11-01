import { describe, expect, it } from 'vitest';
import {
  documentStatusLines,
  hiddenDocumentStatuses,
  statusProgressDocuments,
  toDocumentStatusRows,
  type DocumentStatusRow,
} from '../documentStatus';

const row = (category: string, uploadedAtNs: string, verified = false): DocumentStatusRow => ({
  category,
  uploadedAtNs,
  verified,
});

describe('toDocumentStatusRows', () => {
  it('should keep the nanosecond timestamp exact', () => {
    // Arrange: larger than Number.MAX_SAFE_INTEGER, so Number() would round it.
    const uploadedAt = 1_793_000_000_123_456_789n;

    // Act
    const [converted] = toDocumentStatusRows([{ category: 'funds', verified: true, uploadedAt }]);

    // Assert
    expect(converted).toEqual({ category: 'funds', verified: true, uploadedAtNs: '1793000000123456789' });
  });
});

describe('hiddenDocumentStatuses', () => {
  it('should leave out every document already in the list', () => {
    const status = [row('title', '100'), row('funds', '200')];

    expect(hiddenDocumentStatuses(status, ['100'])).toEqual([row('funds', '200')]);
  });

  it('should return every row when the viewer can open nothing', () => {
    const status = [row('title', '100'), row('funds', '200')];

    expect(hiddenDocumentStatuses(status, [])).toEqual(status);
  });

  it('should pair rows one for one when two uploads share a timestamp', () => {
    const status = [row('title', '100'), row('funds', '100')];

    expect(hiddenDocumentStatuses(status, ['100'])).toHaveLength(1);
  });

  it('should ignore a listed document with no exact timestamp', () => {
    expect(hiddenDocumentStatuses([row('funds', '200')], [undefined])).toEqual([row('funds', '200')]);
  });

  it('should return nothing when there are no status rows', () => {
    expect(hiddenDocumentStatuses([], ['100'])).toEqual([]);
  });
});

describe('documentStatusLines', () => {
  it('should word buyer funds the way the owner specified', () => {
    expect(documentStatusLines([row('funds', '1')])).toEqual(['Buyer funds: received']);
  });

  it('should not call funds verified when the integrity flag is set', () => {
    expect(documentStatusLines([row('funds', '1', true)])).toEqual(['Buyer funds: received']);
  });

  it('should group several documents of one category into one line', () => {
    expect(documentStatusLines([row('searches', '1'), row('searches', '2')])).toEqual([
      'Property searches: 2 received',
    ]);
  });

  it('should fall back to a neutral label for a category it does not know', () => {
    expect(documentStatusLines([row('brand-new-category', '1')])).toEqual(['Other document: received']);
  });
});

describe('statusProgressDocuments', () => {
  it('should map a category to the checklist key it ticks and the right side', () => {
    const [doc] = statusProgressDocuments([row('funds', '1793000000000000000')], 'tx_1');

    expect(doc).toMatchObject({ type: 'proofOfFunds', category: 'buyer', transactionId: 'tx_1' });
  });

  it('should leave the uploader and filename blank', () => {
    const [doc] = statusProgressDocuments([row('title', '1793000000000000000')], 'tx_1');

    expect(doc).toMatchObject({ uploadedBy: '', fileName: '', hash: '' });
  });

  it('should tick nothing for an unrecognised document', () => {
    const [doc] = statusProgressDocuments([row('other', '1793000000000000000')], 'tx_1');

    expect(doc.type).toBe('other');
  });
});
