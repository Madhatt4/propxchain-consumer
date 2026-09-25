import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionError, { actionErrorMessage } from '../ActionError';

describe('ActionError', () => {
  it('should render nothing when there is nothing to say', () => {
    const { container } = render(<ActionError message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render nothing for an empty string, so callers can reset with ""', () => {
    const { container } = render(<ActionError message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should refuse a non-string rather than crash the render', () => {
    // Callers pass service payloads through (`result.error || '…'`), and a
    // misbehaving API can make that an object. React throws "Objects are not
    // valid as a React child" on those — a blank screen instead of a handled
    // failure, which is worse than the silence this component replaces.
    const bad = [{ code: 500 }, 42, [], true] as unknown as (string | null)[];
    for (const value of bad) {
      const { container } = render(<ActionError message={value} />);
      expect(container).toBeEmptyDOMElement();
    }
  });

  it('should announce the failure, not merely draw it', () => {
    // The whole point is a failure the user cannot miss. A styled <p> with no
    // role is invisible to a screen reader, which is the same bug in a
    // different medium.
    render(<ActionError message="Couldn’t instruct Smith & Co." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t instruct Smith & Co.');
  });
});

describe('actionErrorMessage', () => {
  it('should prefer a message a human wrote', () => {
    expect(actionErrorMessage(new Error('That postcode is not in England or Wales'), 'fallback')).toBe(
      'That postcode is not in England or Wales',
    );
  });

  it('should fall back rather than show a network library’s wording', () => {
    // "Failed to fetch" tells the user nothing about what they were doing.
    expect(actionErrorMessage(new Error('Failed to fetch'), 'Couldn’t reach the panel.')).toBe(
      'Couldn’t reach the panel.',
    );
  });

  it('should fall back on internal error shapes', () => {
    expect(actionErrorMessage(new TypeError('x is not a function'), 'fallback')).toBe('fallback');
    expect(actionErrorMessage(new Error('[object Object]'), 'fallback')).toBe('fallback');
  });

  it('should truncate a long message rather than discard what it says', () => {
    // "Cannot sign off: searches X, Y and Z are missing…" is long AND is
    // exactly what the user needs. Dropping it for a generic fallback hides
    // real information.
    const long = `Cannot sign off: ${'search, '.repeat(40)}are missing`;
    const out = actionErrorMessage(new Error(long), 'fallback');
    expect(out).not.toBe('fallback');
    expect(out.startsWith('Cannot sign off:')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(201);
    expect(out.endsWith('…')).toBe(true);
  });

  it('should accept a plain string, so a service error normalises like a thrown one', () => {
    // Services return `result.error` as a string. Before this, the success:false
    // paths did `result.error || fallback` and bypassed screening entirely —
    // two behaviours for one concept.
    expect(actionErrorMessage('No panel firms cover MK40 1NN', 'fallback')).toBe(
      'No panel firms cover MK40 1NN',
    );
  });

  it('should screen a plain string the same way it screens a thrown one', () => {
    expect(actionErrorMessage('[object Object]', 'fallback')).toBe('fallback');
    expect(actionErrorMessage('Failed to fetch', 'fallback')).toBe('fallback');
  });

  it('should fall back on values that carry no message at all', () => {
    expect(actionErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(actionErrorMessage(null, 'fallback')).toBe('fallback');
    expect(actionErrorMessage({ code: 500 }, 'fallback')).toBe('fallback');
    expect(actionErrorMessage(42, 'fallback')).toBe('fallback');
  });
});
