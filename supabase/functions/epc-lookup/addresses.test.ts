// deno test supabase/functions/epc-lookup/addresses.test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildAddressList, normaliseUprn } from './addresses.ts';

Deno.test('buildAddressList should list a home with several certificates once', () => {
  const list = buildAddressList([
    { uprn: '100', addressLine1: '2 High Street' },
    { uprn: 100, addressLine1: '2 High Street' },
  ]);
  assertEquals(list, [{ label: '2 High Street', line1: '2 High Street', uprn: '100' }]);
});

Deno.test('buildAddressList should sort house numbers in natural order', () => {
  const list = buildAddressList([
    { uprn: '3', addressLine1: '10 High Street' },
    { uprn: '1', addressLine1: '2 High Street' },
    { uprn: '2', addressLine1: '1 High Street' },
  ]);
  assertEquals(list.map((a) => a.label), ['1 High Street', '2 High Street', '10 High Street']);
});

Deno.test('buildAddressList should keep a row with no UPRN, keyed by its address', () => {
  const list = buildAddressList([
    { addressLine1: 'Rose Cottage', addressLine2: 'Mill Lane' },
    { addressLine1: 'Rose  Cottage', addressLine2: 'Mill Lane' },
  ]);
  assertEquals(list, [{ label: 'Rose Cottage, Mill Lane', line1: 'Rose Cottage', uprn: null }]);
});

Deno.test('buildAddressList should skip rows without a first address line', () => {
  assertEquals(buildAddressList([{ uprn: '9', addressLine1: '  ' }, {}]), []);
});

Deno.test('normaliseUprn should reject anything that is not 1-12 digits', () => {
  assertEquals(normaliseUprn('12345'), '12345');
  assertEquals(normaliseUprn(12345), '12345');
  assertEquals(normaliseUprn('12a'), null);
  assertEquals(normaliseUprn('1234567890123'), null);
  assertEquals(normaliseUprn(null), null);
});
