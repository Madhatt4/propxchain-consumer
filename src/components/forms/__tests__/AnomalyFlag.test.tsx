import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AnomalyFlag } from '../AnomalyFlag';
import type { CrossReferenceResult } from '../../../services/formCrossReferenceService';

function makeResult(overrides: Partial<CrossReferenceResult> = {}): CrossReferenceResult {
  return {
    formSection: 'TA6 §7 Environmental',
    formField: 'environmentalIssues',
    formValue: [],
    propertyIntelSource: 'planning.data.gov.uk/flood-zone',
    propertyIntelValue: 'zone_3',
    conflictType: 'contradiction',
    severity: 'critical',
    message: 'Property sits in Flood Zone 3 but section 7 does not declare flooding.',
    suggestedAction: 'Add a clarification note to TA6 §7.',
    ...overrides,
  };
}

describe('AnomalyFlag', () => {
  it('renders the message, suggested action, and provenance line', () => {
    render(<AnomalyFlag result={makeResult()} />);
    expect(screen.getByText(/Property sits in Flood Zone 3/)).toBeInTheDocument();
    expect(screen.getByText(/Add a clarification note/)).toBeInTheDocument();
    expect(screen.getByText(/TA6 §7 Environmental · source: planning\.data\.gov\.uk\/flood-zone/)).toBeInTheDocument();
  });

  it('exposes a descriptive aria label tied to severity', () => {
    render(<AnomalyFlag result={makeResult({ severity: 'critical' })} />);
    expect(screen.getByRole('note')).toHaveAccessibleName(/Critical anomaly/);
  });

  it('renders critical severity with red styling and correct test id', () => {
    const { getByTestId } = render(<AnomalyFlag result={makeResult({ severity: 'critical' })} />);
    const flag = getByTestId('anomaly-flag-critical');
    expect(flag.className).toMatch(/border-red-200/);
    expect(flag.className).toMatch(/bg-red-50/);
  });

  it('renders warning severity with amber styling', () => {
    const { getByTestId } = render(
      <AnomalyFlag result={makeResult({ severity: 'warning' })} />,
    );
    const flag = getByTestId('anomaly-flag-warning');
    expect(flag.className).toMatch(/border-amber-200/);
    expect(flag.className).toMatch(/bg-amber-50/);
    expect(screen.getByRole('note')).toHaveAccessibleName(/Warning anomaly/);
  });

  it('renders info severity with teal styling', () => {
    const { getByTestId } = render(
      <AnomalyFlag result={makeResult({ severity: 'info' })} />,
    );
    const flag = getByTestId('anomaly-flag-info');
    expect(flag.className).toMatch(/#0D9488/);
    expect(screen.getByRole('note')).toHaveAccessibleName(/Informational note/);
  });

  it('applies an optional className to the outer container', () => {
    const { getByTestId } = render(
      <AnomalyFlag result={makeResult()} className="mb-6" />,
    );
    expect(getByTestId('anomaly-flag-critical').className).toMatch(/mb-6/);
  });
});
