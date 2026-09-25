import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PostcodeCompletionPrompt } from '../PostcodeCompletionPrompt';

describe('PostcodeCompletionPrompt', () => {
  it('renders the known outcode prominently', () => {
    render(
      <PostcodeCompletionPrompt
        outcode="SG19"
        reason="Test reason"
        onComplete={() => {}}
      />,
    );
    expect(screen.getByLabelText(/known outcode/i)).toHaveTextContent('SG19');
  });

  it('renders nothing when outcode is actually a full postcode', () => {
    const { container } = render(
      <PostcodeCompletionPrompt
        outcode="SG19 8AB"
        reason="Test"
        onComplete={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('disables submit until at least 3 characters in the incode input', () => {
    render(
      <PostcodeCompletionPrompt
        outcode="SG19"
        reason="Test"
        onComplete={() => {}}
        ctaLabel="Go"
      />,
    );
    const button = screen.getByRole('button', { name: 'Go' });
    expect(button).toBeDisabled();

    const input = screen.getByLabelText(/incode/i);
    fireEvent.change(input, { target: { value: '8A' } });
    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: '8AB' } });
    expect(button).toBeEnabled();
  });

  it('fires onComplete with the formatted full postcode on submit', () => {
    const onComplete = vi.fn();
    render(
      <PostcodeCompletionPrompt outcode="SG19" reason="Test" onComplete={onComplete} />,
    );
    fireEvent.change(screen.getByLabelText(/incode/i), {
      target: { value: '8ab' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(onComplete).toHaveBeenCalledWith('SG19 8AB');
  });

  it('shows an error and does not call onComplete on invalid incode', () => {
    const onComplete = vi.fn();
    render(
      <PostcodeCompletionPrompt outcode="SG19" reason="Test" onComplete={onComplete} />,
    );
    fireEvent.change(screen.getByLabelText(/incode/i), {
      target: { value: 'XYZ' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByText(/doesn't look like a valid postcode/i)).toBeInTheDocument();
  });

  it('uppercases user input as they type', () => {
    render(
      <PostcodeCompletionPrompt outcode="SG19" reason="Test" onComplete={() => {}} />,
    );
    const input = screen.getByLabelText(/incode/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '8ab' } });
    expect(input.value).toBe('8AB');
  });
});
