import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flashNextStepTarget } from '../nextStepHighlight';

describe('flashNextStepTarget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should do nothing when there is no target', () => {
    expect(() => flashNextStepTarget(null)).not.toThrow();
    expect(() => flashNextStepTarget(undefined)).not.toThrow();
  });

  it('should ring the panel it was given', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);

    flashNextStepTarget(panel);

    expect(panel.style.outline).not.toBe('');
  });

  it('should clear the ring again so it does not become permanent chrome', () => {
    const panel = document.createElement('div');
    document.body.appendChild(panel);

    flashNextStepTarget(panel);
    vi.advanceTimersByTime(3000);

    expect(panel.style.outline).toBe('');
  });

  it('should prefer a tagged field over the whole panel', () => {
    const panel = document.createElement('div');
    const field = document.createElement('input');
    field.setAttribute('data-next-step-target', 'title-number');
    panel.appendChild(field);
    document.body.appendChild(panel);

    flashNextStepTarget(panel);

    expect(field.style.outline).not.toBe('');
    expect(panel.style.outline).toBe('');
  });

  it('should put the caret in a tagged input', () => {
    const panel = document.createElement('div');
    const field = document.createElement('input');
    field.setAttribute('data-next-step-target', 'title-number');
    panel.appendChild(field);
    document.body.appendChild(panel);

    flashNextStepTarget(panel);

    expect(document.activeElement).toBe(field);
  });

  it('should not focus a tagged non-input — that would announce the whole panel', () => {
    const panel = document.createElement('div');
    const region = document.createElement('div');
    region.setAttribute('data-next-step-target', 'panel');
    panel.appendChild(region);
    document.body.appendChild(panel);

    flashNextStepTarget(panel);

    expect(document.activeElement).not.toBe(region);
  });

  it('should restore any outline the element already had', () => {
    const panel = document.createElement('div');
    panel.style.outline = '1px dotted red';
    // The DOM normalises the shorthand, so compare against what it stored
    // rather than what we wrote — asserting the input string tests the browser,
    // not this function.
    const original = panel.style.outline;
    document.body.appendChild(panel);

    flashNextStepTarget(panel);
    expect(panel.style.outline).not.toBe(original);

    vi.advanceTimersByTime(3000);
    expect(panel.style.outline).toBe(original);
  });
});
