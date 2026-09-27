import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AudienceSections } from '../AudienceSections';

const mockRequestDemo = vi.fn();

vi.mock('@/services/demoRequest.service', () => ({
  requestDemo: (...args: unknown[]) => mockRequestDemo(...args),
}));

function openDialog(): void {
  render(
    <MemoryRouter>
      <AudienceSections onScrollTo={vi.fn()} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Book a 20-min demo' }));
}

function fill(company: string, name: string, email: string): void {
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: company } });
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Work email'), { target: { value: email } });
}

function submit(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Request a demo' }));
}

describe('Book a 20-min demo', () => {
  beforeEach(() => {
    mockRequestDemo.mockReset();
  });

  it('should open the demo form instead of scrolling to the report', () => {
    const onScrollTo = vi.fn();
    render(
      <MemoryRouter>
        <AudienceSections onScrollTo={onScrollTo} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Book a 20-min demo' }));

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Company')).toBeTruthy();
    expect(onScrollTo).not.toHaveBeenCalled();
  });

  it('should not send when the company is missing', () => {
    openDialog();
    fill('', 'Sam Builder', 'sam@example.com');

    submit();

    expect(screen.getByRole('alert').textContent).toContain('company');
    expect(mockRequestDemo).not.toHaveBeenCalled();
  });

  it('should not send when the email is invalid', () => {
    openDialog();
    fill('Example Homes', 'Sam Builder', 'not-an-email');

    submit();

    expect(screen.getByRole('alert').textContent).toContain('valid email');
    expect(mockRequestDemo).not.toHaveBeenCalled();
  });

  it('should send trimmed details and show the confirmation', async () => {
    mockRequestDemo.mockResolvedValue(true);
    openDialog();
    fill('  Example Homes ', ' Sam Builder ', ' sam@example.com ');

    submit();

    await waitFor(() => expect(screen.getByText(/we’ll be in touch/)).toBeTruthy());
    expect(mockRequestDemo).toHaveBeenCalledWith({
      company: 'Example Homes',
      name: 'Sam Builder',
      email: 'sam@example.com',
      website: '',
    });
    expect(screen.getByText(/sam@example\.com within one working day/)).toBeTruthy();
  });

  it('should keep the form and offer an email fallback when sending fails', async () => {
    mockRequestDemo.mockResolvedValue(false);
    openDialog();
    fill('Example Homes', 'Sam Builder', 'sam@example.com');

    submit();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('marc@propxchain.com'));
    expect(screen.getByLabelText('Company')).toBeTruthy();
  });
});
