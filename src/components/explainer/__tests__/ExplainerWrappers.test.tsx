import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import ExplainerModal from '../ExplainerModal';
import ExplainerCard from '../ExplainerCard';
import { hasSeenExplainer, markExplainerSeen } from '../explainerSeen';

describe('explainerSeen', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('should report not seen for a transaction with no record', () => {
    expect(hasSeenExplainer('searches', 'tx-unseen')).toBe(false);
  });

  it('should report seen after marking', () => {
    markExplainerSeen('searches', 'tx-seen');
    expect(hasSeenExplainer('searches', 'tx-seen')).toBe(true);
  });

  it('should keep transactions independent', () => {
    markExplainerSeen('searches', 'tx-a');
    expect(hasSeenExplainer('searches', 'tx-b')).toBe(false);
  });

  it('should keep explainers on different stages independent', () => {
    // Dismissing the searches explanation must not silently dismiss the
    // property-information one on the same transaction.
    markExplainerSeen('searches', 'tx-1');
    expect(hasSeenExplainer('property-info', 'tx-1')).toBe(false);
  });
});

describe('ExplainerModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  function renderModal(storageKey = 'searches', transactionId = 'tx-1') {
    return render(
      <ExplainerModal
        storageKey={storageKey}
        transactionId={transactionId}
        title="Before you order"
        dismissLabel="Got it, show me the options"
      >
        <p>Explainer body</p>
      </ExplainerModal>,
    );
  }

  it('should render on first visit for a transaction', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Explainer body')).toBeInTheDocument();
  });

  it('should not render when the transaction has already been seen', () => {
    markExplainerSeen('searches', 'tx-1');
    renderModal();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should still render when a different stage was dismissed', () => {
    markExplainerSeen('property-info', 'tx-1');
    renderModal('searches', 'tx-1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should close and record seen when dismissed', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(hasSeenExplainer('searches', 'tx-1')).toBe(true);
  });

  it('should mark itself modal for assistive technology', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('should label the dialog by its own title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Before you order');
  });
});

describe('ExplainerCard', () => {
  function renderCard() {
    return render(
      <ExplainerCard label="What these are" headline="4 typically ordered here">
        <p>Expanded body</p>
      </ExplainerCard>,
    );
  }

  it('should show the headline while collapsed', () => {
    renderCard();
    expect(screen.getByText('4 typically ordered here')).toBeInTheDocument();
  });

  it('should hide the body while collapsed', () => {
    renderCard();
    expect(screen.queryByText('Expanded body')).not.toBeInTheDocument();
  });

  it('should reveal the body when expanded', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByText('Expanded body')).toBeInTheDocument();
  });
});
