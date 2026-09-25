import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import TA6Form from '../TA6Form';
import { emptyTA6Form } from '../../../types/ta6.types';
import type { StepAnomaly } from '../ta6/StepAnomalyFlag';

// The export button pulls in formExportService (owned by a parallel agent) —
// stub it so these shell tests stay isolated from that surface.
vi.mock('../FormExportButton', () => ({
  FormExportButton: () => <div data-testid="form-export-stub" />,
}));

const noSave = async (): Promise<void> => {};

describe('TA6Form anomaly rendering', () => {
  it('should render a conflict anomaly flag on section 8 when a §8 anomaly is supplied', () => {
    // Arrange
    const anomalies: StepAnomaly[] = [
      {
        ref: '8.1',
        severity: 'conflict',
        explanation: 'Seller declared never flooded but the property sits in Flood Zone 3.',
      },
    ];
    render(
      <TA6Form
        transactionId="tx-1"
        initialData={emptyTA6Form()}
        onSave={noSave}
        anomalies={anomalies}
      />,
    );

    // Assert — not shown on the default section (1)
    expect(screen.queryByTestId('ta6-anomaly-conflict')).not.toBeInTheDocument();

    // Act — navigate to section 8 via its stepper pill
    fireEvent.click(screen.getByRole('button', { name: /Section 8:/ }));

    // Assert — flag now visible with its explanation
    expect(screen.getByTestId('ta6-anomaly-conflict')).toBeInTheDocument();
    expect(screen.getByText(/Flood Zone 3/)).toBeInTheDocument();
  });

  it('should not render an anomaly flag on a section with no matching anomalies', () => {
    // Arrange
    const anomalies: StepAnomaly[] = [
      { ref: '2.1', severity: 'info', explanation: 'Boundary note.' },
    ];
    render(
      <TA6Form
        transactionId="tx-1"
        initialData={emptyTA6Form()}
        onSave={noSave}
        anomalies={anomalies}
      />,
    );

    // Act — section 8 has no anomalies
    fireEvent.click(screen.getByRole('button', { name: /Section 8:/ }));

    // Assert
    expect(screen.queryByTestId('ta6-anomaly-info')).not.toBeInTheDocument();
  });
});
