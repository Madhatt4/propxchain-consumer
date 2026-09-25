import { describe, it, expect } from 'vitest';
import { Principal } from '@propxchain/core-client';

import {
  generateVerificationHash,
  exportTA6ToPDF,
  exportTA7ToPDF,
  exportTA10ToPDF,
} from '../formExportService';
import { buildTA6Sections } from '../ta6PdfSections';
import { emptyTA6Form } from '../../types/ta6.types';
import type { TA6PropertyInformation } from '../../types/ta6.types';
import type { TA7LeaseholdInformation } from '../../types/ta7.types';
import type { TA10FittingsAndContents } from '../../types/ta10.types';

describe('generateVerificationHash', () => {
  it('is deterministic for the same input', async () => {
    const a = { x: 1, y: 'hello' };
    const b = { x: 1, y: 'hello' };
    expect(await generateVerificationHash(a)).toBe(await generateVerificationHash(b));
  });

  it('is independent of key insertion order', async () => {
    const a = { foo: 1, bar: 2 };
    const b = { bar: 2, foo: 1 };
    expect(await generateVerificationHash(a)).toBe(await generateVerificationHash(b));
  });

  it('is 64 hex characters (SHA-256)', async () => {
    const hash = await generateVerificationHash({ field: 'value' });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('differs when the input changes', async () => {
    const a = await generateVerificationHash({ flooded: false });
    const b = await generateVerificationHash({ flooded: true });
    expect(a).not.toBe(b);
  });

  it('handles nested objects + arrays', async () => {
    const a = await generateVerificationHash({ list: [1, 2, 3], nested: { k: 'v' } });
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

// 6th-edition TA6: a mostly-empty draft with a few representative answers so
// the export exercises response / document / factual rows without depending on
// every field being populated.
function sampleTA6(): TA6PropertyInformation {
  const form = emptyTA6Form();
  form.section1.propertyAddress = '10 Example Road, AB1 2CD';
  form.section1.postcode = 'AB1 2CD';
  form.section2.q2_3MovedOrAltered = { answer: 'no', details: '' };
  form.section5.q5_1Alterations.extension = true;
  form.section8.q8_1Flooded = { answer: 'no', details: '' };
  return form;
}

function sampleTA7(): TA7LeaseholdInformation {
  return {
    leaseTermYears: 125,
    leaseStartDate: '2005-06-01',
    leaseExpiryDate: '2130-06-01',
    groundRentAmount: 200,
    groundRentPaymentFrequency: 'annual',
    serviceChargeAmount: 1800,
    serviceChargePaymentFrequency: 'annual',
    freeholder: 'Acme Freeholds Ltd',
    managingAgent: 'Property Management Co',
    restrictions: 'No structural alterations without landlord consent',
    alterationsAllowed: false,
    sublettingAllowed: true,
    petsAllowed: true,
    completedBy: Principal.anonymous(),
    completedAt: null,
    lastModifiedBy: Principal.anonymous(),
    lastModifiedAt: '2026-04-19T12:00:00Z',
  };
}

function sampleTA10(): TA10FittingsAndContents {
  return {
    rooms: [
      {
        name: 'Kitchen',
        items: [
          { name: 'Cooker', included: true, notes: '' },
          { name: 'Fridge', included: false, notes: 'Buyer to supply' },
        ],
      },
    ],
  } as unknown as TA10FittingsAndContents;
}

describe('exportTA6ToPDF', () => {
  it('returns a PDF Blob with a reasonable size', async () => {
    const blob = await exportTA6ToPDF(sampleTA6(), { propertyAddress: '10 Example Road, AB1 2CD' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
    expect(blob.type).toContain('pdf');
  });

  it('appends the appendix section when notes are supplied', async () => {
    const blob = await exportTA6ToPDF(
      sampleTA6(),
      { propertyAddress: '10 Example Road' },
      { appendixNotes: ['Flood zone 3 — seller said no flood history'] },
    );
    expect(blob.size).toBeGreaterThan(500);
  });

  it('exports the 15-section 6th-edition record of an empty draft without throwing', async () => {
    // Arrange: a fully-draft form (every answer 'not-answered')
    const form = emptyTA6Form();

    // Act
    const blob = await exportTA6ToPDF(form, { propertyAddress: '10 Example Road' });

    // Assert: the pipeline runs and produces a non-trivial PDF
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });

  it('includes section 15 (Additional information) in the record layout', () => {
    // Arrange + Act
    const titles = buildTA6Sections(emptyTA6Form()).map((section) => section.title);

    // Assert: section 15 is present and section 1 leads the record
    expect(titles[0]).toBe('1. Property and seller details');
    expect(titles).toContain('15. Additional information');
  });
});

describe('exportTA7ToPDF', () => {
  it('returns a PDF Blob for leasehold data', async () => {
    const blob = await exportTA7ToPDF(sampleTA7(), { propertyAddress: 'Flat 5, Example House' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });
});

describe('exportTA10ToPDF', () => {
  it('returns a PDF Blob for fittings/contents data', async () => {
    const blob = await exportTA10ToPDF(sampleTA10(), { propertyAddress: '10 Example Road' });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(500);
  });
});
