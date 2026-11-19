// deno test supabase/functions/create-estate-agent-org/verification.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { type CompaniesHouseCompany, decideCompaniesHouse, parseServerCompany } from './verification.ts';

const NUMBER = '01234567';

function lookupResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    companyNumber: NUMBER,
    name: 'EXAMPLE ESTATES LIMITED',
    status: 'active',
    incorporatedOn: '2001-02-03',
    address: { locality: 'Bedford', postalCode: 'MK40 1AA' },
    isActive: true,
    ...overrides,
  };
}

function company(overrides: Partial<CompaniesHouseCompany> = {}): CompaniesHouseCompany {
  return parseServerCompany(lookupResponse(overrides), NUMBER)!;
}

Deno.test('decideCompaniesHouse should store the registered name, not the typed name, when verified', () => {
  // The attack: type a famous brand next to its real company number.
  const decision = decideCompaniesHouse('Foxtons', company());
  assertEquals(decision, {
    kind: 'create',
    name: 'EXAMPLE ESTATES LIMITED',
    verified: true,
    snapshot: company(),
  });
});

Deno.test('decideCompaniesHouse should create unverified with no snapshot when the lookup failed', () => {
  assertEquals(decideCompaniesHouse('Foxtons', null), {
    kind: 'create',
    name: 'Foxtons',
    verified: false,
    snapshot: null,
  });
});

Deno.test('decideCompaniesHouse should refuse a company that is not active', () => {
  assertEquals(decideCompaniesHouse('Anything', company({ isActive: false, status: 'dissolved' })), {
    kind: 'dissolved',
  });
});

Deno.test('parseServerCompany should accept a well-formed lookup response', () => {
  assertEquals(parseServerCompany(lookupResponse(), NUMBER), {
    companyNumber: NUMBER,
    name: 'EXAMPLE ESTATES LIMITED',
    status: 'active',
    incorporatedOn: '2001-02-03',
    address: { locality: 'Bedford', postalCode: 'MK40 1AA' },
    isActive: true,
  });
});

Deno.test('parseServerCompany should treat null, non-objects and arrays as a failed lookup', () => {
  assertEquals(parseServerCompany(null, NUMBER), null);
  assertEquals(parseServerCompany('EXAMPLE ESTATES LIMITED', NUMBER), null);
  assertEquals(parseServerCompany([lookupResponse()], NUMBER), null);
});

Deno.test('parseServerCompany should reject a response for a different company number', () => {
  assertEquals(parseServerCompany(lookupResponse({ companyNumber: '07654321' }), NUMBER), null);
  assertEquals(parseServerCompany(lookupResponse({ companyNumber: undefined }), NUMBER), null);
});

Deno.test('parseServerCompany should normalise the returned company number before comparing', () => {
  const parsed = parseServerCompany(lookupResponse({ companyNumber: ' sc123456 ' }), 'SC123456');
  assertEquals(parsed?.companyNumber, 'SC123456');
});

Deno.test('parseServerCompany should reject an empty, blank or oversized name', () => {
  assertEquals(parseServerCompany(lookupResponse({ name: '' }), NUMBER), null);
  assertEquals(parseServerCompany(lookupResponse({ name: '   ' }), NUMBER), null);
  assertEquals(parseServerCompany(lookupResponse({ name: 'X'.repeat(201) }), NUMBER), null);
});

Deno.test('parseServerCompany should reject a missing or non-boolean isActive', () => {
  assertEquals(parseServerCompany(lookupResponse({ isActive: 'true' }), NUMBER), null);
  assertEquals(parseServerCompany(lookupResponse({ isActive: undefined }), NUMBER), null);
});

Deno.test('parseServerCompany should drop non-string address parts and default missing text fields', () => {
  const parsed = parseServerCompany(
    lookupResponse({ address: { locality: 'Bedford', premises: 12 }, status: undefined, incorporatedOn: null }),
    NUMBER,
  );
  assertEquals(parsed?.address, { locality: 'Bedford' });
  assertEquals(parsed?.status, '');
  assertEquals(parsed?.incorporatedOn, '');
});
