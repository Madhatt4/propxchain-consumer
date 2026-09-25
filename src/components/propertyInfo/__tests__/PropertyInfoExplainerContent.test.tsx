import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import PropertyInfoExplainerContent, {
  showsLeaseholdForm,
} from '../PropertyInfoExplainerContent';
import type { Tenure } from '@/types/listing.types';

function renderContent(tenure: Tenure | null | undefined) {
  return render(
    <MemoryRouter>
      <PropertyInfoExplainerContent tenure={tenure} />
    </MemoryRouter>,
  );
}

describe('showsLeaseholdForm', () => {
  it('should hide TA7 for a freehold sale', () => {
    expect(showsLeaseholdForm('freehold')).toBe(false);
  });

  it('should hide TA7 for share of freehold', () => {
    expect(showsLeaseholdForm('shareOfFreehold')).toBe(false);
  });

  it('should show TA7 for a leasehold sale', () => {
    expect(showsLeaseholdForm('leasehold')).toBe(true);
  });

  it('should show TA7 when the tenure is unknown', () => {
    // Safer to surface an inapplicable form than to hide a needed one —
    // mirrors visibleForms() in PropertyInfoStage.
    expect(showsLeaseholdForm('unknown')).toBe(true);
  });

  it('should show TA7 when the tenure is null', () => {
    expect(showsLeaseholdForm(null)).toBe(true);
  });

  it('should show TA7 when the tenure is undefined', () => {
    expect(showsLeaseholdForm(undefined)).toBe(true);
  });
});

describe('PropertyInfoExplainerContent', () => {
  it('should explain the TA6 form', () => {
    renderContent('freehold');
    expect(screen.getByText(/TA6/)).toBeInTheDocument();
  });

  it('should explain the TA10 form', () => {
    renderContent('freehold');
    expect(screen.getByText(/TA10/)).toBeInTheDocument();
  });

  it('should warn that answers are legally binding', () => {
    renderContent('freehold');
    expect(screen.getByText(/legally binding/i)).toBeInTheDocument();
  });

  it('should not mention TA7 for a freehold sale', () => {
    const { container } = renderContent('freehold');
    expect(container.textContent).not.toContain('TA7');
  });

  it('should mention TA7 for a leasehold sale', () => {
    renderContent('leasehold');
    expect(screen.getByText(/TA7/)).toBeInTheDocument();
  });

  it('should mention TA7 when the tenure is not known', () => {
    renderContent(null);
    expect(screen.getByText(/TA7/)).toBeInTheDocument();
  });

  it('should list documents to have to hand', () => {
    renderContent('freehold');
    expect(screen.getByText(/FENSA/i)).toBeInTheDocument();
  });

  it('should never tell the seller what they must do', () => {
    const { container } = renderContent('leasehold');
    const text = (container.textContent ?? '').toLowerCase();
    expect(text).not.toContain('you must');
    expect(text).not.toContain('you need to');
  });

  it('should link to the property information forms guide', () => {
    renderContent('freehold');
    expect(screen.getByRole('link', { name: /what these forms ask/i })).toHaveAttribute(
      'href',
      '/resources/selling/property-information-forms-explained',
    );
  });

  it('should link to the BASPI guide for the industry context', () => {
    renderContent('freehold');
    expect(screen.getByRole('link', { name: /BASPI/i })).toHaveAttribute(
      'href',
      '/resources/industry-and-reform/baspi-explained',
    );
  });
});
