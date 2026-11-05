import { describe, expect, it } from 'vitest';

import { tidyAddressLabel, tidyAddressList } from '../addressLabel';

describe('tidyAddressLabel', () => {
  it('should drop the comma between a house number and its street', () => {
    expect(tidyAddressLabel('4, North Parade, Matlock Bath')).toBe('4 North Parade, Matlock Bath');
    expect(tidyAddressLabel('14a, North Parade')).toBe('14a North Parade');
  });

  it('should keep the comma after a flat or apartment name', () => {
    expect(tidyAddressLabel('Apartment 4, 113, Newton Street')).toBe('Apartment 4, 113 Newton Street');
    expect(tidyAddressLabel('Flat 2, 10 High Street')).toBe('Flat 2, 10 High Street');
  });

  it('should title-case a label written in capitals', () => {
    expect(tidyAddressLabel('7B IVEL ROAD')).toBe('7b Ivel Road');
    expect(tidyAddressLabel('FLAT 1, ROSE-HILL HOUSE, 2 ST. JOHN\'S ROAD')).toBe(
      'Flat 1, Rose-Hill House, 2 St. John\'s Road',
    );
  });

  it('should lower-case a house-number letter so 7B and 7a read alike', () => {
    expect(tidyAddressLabel('7B Ivel Road')).toBe('7b Ivel Road');
  });

  it('should leave mixed-case words as the register wrote them', () => {
    expect(tidyAddressLabel('The McAllister Building')).toBe('The McAllister Building');
  });

  it('should collapse stray spaces and empty parts', () => {
    expect(tidyAddressLabel('  12 ,  , Ivel  Road ')).toBe('12 Ivel Road');
  });

  it('should return an empty string for an empty label', () => {
    expect(tidyAddressLabel('')).toBe('');
  });
});

describe('tidyAddressList', () => {
  it('should tidy labels, keep line1 and uprn untouched, and sort by house number', () => {
    const list = tidyAddressList([
      { label: '72 North Parade', line1: '72 North Parade', uprn: '2' },
      { label: '4, North Parade, Matlock Bath', line1: '4, North Parade', uprn: '1' },
      { label: '7B IVEL ROAD', line1: '7B IVEL ROAD', uprn: null },
    ]);
    expect(list).toEqual([
      { label: '4 North Parade, Matlock Bath', line1: '4, North Parade', uprn: '1' },
      { label: '7b Ivel Road', line1: '7B IVEL ROAD', uprn: null },
      { label: '72 North Parade', line1: '72 North Parade', uprn: '2' },
    ]);
  });

  it('should return an empty list unchanged', () => {
    expect(tidyAddressList([])).toEqual([]);
  });
});
