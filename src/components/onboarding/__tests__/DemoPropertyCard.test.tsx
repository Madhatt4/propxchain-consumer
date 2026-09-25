import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DemoPropertyCard from '../DemoPropertyCard';
import { DEMO_PROPERTY } from '../demoProperty';

describe('DemoPropertyCard', () => {
  it('should badge itself as a demo on the card', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    expect(screen.getAllByText('Demo — not a real move').length).toBeGreaterThan(0);
  });

  it('should show the example address', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    expect(
      screen.getByText(`${DEMO_PROPERTY.addressLine}, ${DEMO_PROPERTY.postcode}`),
    ).toBeInTheDocument();
  });

  it('should remove itself in one click', () => {
    const onDismiss = vi.fn();
    render(<DemoPropertyCard onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove the demo property' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should open a read-only preview', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look around this example' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should keep the demo badge visible inside the preview', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look around this example' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Demo — not a real move');
  });

  it('should say plainly that nothing has been ordered or paid for', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look around this example' }));
    expect(
      screen.getByText(/Nothing here has been ordered or paid for/i),
    ).toBeInTheDocument();
  });

  it('should close the preview on Escape', () => {
    render(<DemoPropertyCard onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Look around this example' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('demo property fixture', () => {
  it('should be flagged as a demo so no caller can mistake it for real data', () => {
    expect(DEMO_PROPERTY.isDemo).toBe(true);
  });

  it('should use a postcode outside the live test address to avoid confusion', () => {
    // The real end-to-end test order used Merlin Drive, SG19 2UN. A demo that
    // matches a real order in the database is exactly the confusion this guards.
    expect(DEMO_PROPERTY.postcode).not.toBe('SG19 2UN');
  });

  it('should describe a move already in progress, so the example is not empty too', () => {
    expect(DEMO_PROPERTY.stages.some((s) => s.state === 'done')).toBe(true);
    expect(DEMO_PROPERTY.stages.some((s) => s.state !== 'done')).toBe(true);
  });
});
