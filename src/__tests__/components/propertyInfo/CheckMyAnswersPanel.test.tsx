// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The panel has one job the seller's money rides on: keep the facts apart
 * from the opinions. A deterministic finding must read as settled and carry
 * no percentage; a model flag must always carry one.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { CheckMyAnswersPanel } from '../../../components/propertyInfo/CheckMyAnswersPanel';
import type { FormCheckResult } from '../../../services/formCheck.service';

const TA6_RESULT: FormCheckResult = {
  form: 'ta6',
  readyToSubmit: 0.08,
  followUpScore: 3,
  worstSection: 'section5_alterations',
  flags: [
    { key: 'knotweed_gap', label: 'The knotweed answers would draw an enquiry.', probability: 0.45, section: 'section8_environment', severity: 'info' },
    { key: 'missing_consents', label: 'Alterations look like they needed a consent.', probability: 0.86, section: 'section5_alterations', severity: 'block' },
    { key: 'services_gap', label: 'The drainage answers would draw an enquiry.', probability: 0.64, section: 'section11_services', severity: 'warn' },
  ],
  deterministic: [
    { key: 'detail_missing_5.8', label: 'Question 5.8 is answered Yes with no detail.', section: 'section5' },
  ],
  model: 'typesafe-system-one',
  checkedAt: '2026-09-19T10:00:00.000Z',
};

function renderPanel(result: FormCheckResult = TA6_RESULT): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <CheckMyAnswersPanel transactionId="tx_1" result={result} />
    </MemoryRouter>,
  );
  return container;
}

describe('CheckMyAnswersPanel', () => {
  it('should headline the readiness as a percentage with a meter', () => {
    renderPanel();

    expect(screen.getByText('Ready to submit: 8%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ready to submit' })).toHaveAttribute('aria-valuenow', '8');
  });

  it('should say the follow-up score in the rubric words, never as a number', () => {
    renderPanel();

    expect(screen.getByText('serious issues likely to delay exchange')).toBeInTheDocument();
    expect(screen.queryByText(/3 of 3|3\/3/)).not.toBeInTheDocument();
  });

  it('should render the deterministic findings before the model flags', () => {
    const container = renderPanel();
    const text = container.textContent ?? '';

    expect(text.indexOf('Found in your answers')).toBeGreaterThan(-1);
    expect(text.indexOf('Found in your answers')).toBeLessThan(text.indexOf('Worth a second look'));
  });

  it('should show no probability against a deterministic finding', () => {
    renderPanel();

    const finding = screen.getByText('Question 5.8 is answered Yes with no detail.').closest('li');
    expect(finding).not.toBeNull();
    expect(within(finding as HTMLElement).queryByText(/%$/)).not.toBeInTheDocument();
  });

  it('should show a percent chip against every model flag', () => {
    renderPanel();

    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('should order the flags block, then warn, then info', () => {
    const container = renderPanel();
    const text = container.textContent ?? '';

    expect(text.indexOf('86%')).toBeLessThan(text.indexOf('64%'));
    expect(text.indexOf('64%')).toBeLessThan(text.indexOf('45%'));
  });

  it('should colour block red, warn amber and info grey', () => {
    renderPanel();

    expect(screen.getByText('86%').className).toContain('red');
    expect(screen.getByText('64%').className).toContain('amber');
    expect(screen.getByText('45%').className).toContain('gray');
  });

  it('should link each finding to its section in the TA6 stepper, in both section spellings', () => {
    renderPanel();

    // The deterministic finding names `section5`, the flag names
    // `section5_alterations`; both resolve to the same step.
    const section5 = screen.getAllByRole('link', { name: /§5 Alterations/ });
    expect(section5.map((link) => link.getAttribute('href'))).toEqual([
      '/transaction/tx_1/forms/ta6?section=section5',
      '/transaction/tx_1/forms/ta6?section=section5_alterations',
    ]);
    expect(screen.getByRole('link', { name: /§8 Environmental matters/ })).toBeInTheDocument();
  });

  it('should render no link for a finding with no section', () => {
    renderPanel({
      ...TA6_RESULT,
      deterministic: [{ key: 'orphan', label: 'A finding with no section.' }],
      flags: [{ key: 'has_contradiction', label: 'Answers contradict each other.', probability: 0.9, severity: 'block' }],
    });

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('should footer the advisory line with the model and the time of the check', () => {
    renderPanel();

    expect(screen.getByText('Advisory only. Your conveyancer decides what to disclose.')).toBeInTheDocument();
    expect(screen.getByText(/typesafe-system-one/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it('should name the rules rather than a model when no model was asked', () => {
    renderPanel({ ...TA6_RESULT, model: 'deterministic-only', flags: [] });

    expect(screen.getByText(/Checked against the rules only/)).toBeInTheDocument();
  });

  it('should say nothing stood out, without claiming the form is correct', () => {
    renderPanel({ ...TA6_RESULT, flags: [], deterministic: [] });

    expect(screen.getByText(/Nothing stood out/)).toBeInTheDocument();
    expect(screen.getByText(/not a guarantee/)).toBeInTheDocument();
  });

  it('should read a TA10 score off the completeness rubric', () => {
    renderPanel({
      ...TA6_RESULT,
      form: 'ta10',
      readyToSubmit: 0.5,
      followUpScore: 1,
      worstSection: null,
      flags: [{ key: 'cooker_covered', label: 'The list does not say whether the cooker is included.', probability: 0.7, severity: 'warn' }],
      deterministic: [],
    });

    expect(screen.getByText('most items covered')).toBeInTheDocument();
    expect(screen.getByText('Ready to submit: 50%')).toBeInTheDocument();
  });
});
