import { describe, it, expect } from 'vitest';
import { categoryLabel, kindLabel, statusLabel, statusTone } from '../enquiryLabels';

describe('enquiryLabels', () => {
  it('labels every category, status and kind, and never returns the raw slug', () => {
    expect(categoryLabel('ta6_alterations')).toBe('Alterations, planning & building control');
    expect(categoryLabel('title')).toBe('Title');
    expect(statusLabel('raised')).toBe('Awaiting answer');
    expect(statusLabel('withdrawn')).toBe('Withdrawn');
    expect(kindLabel('hmlr_scan')).toBe('Title scan');
    expect(statusTone('answered')).toBe('answered');
  });
});
