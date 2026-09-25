import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlaIndicator } from '../../components/providers/SlaIndicator';

describe('SlaIndicator', () => {
  it('should render "Fast turnaround" when slaLoad is undefined', () => {
    render(<SlaIndicator />);
    expect(screen.getByText('Fast turnaround')).toBeDefined();
  });

  it('should render "Fast turnaround" when slaLoad is 0.5', () => {
    render(<SlaIndicator slaLoad={0.5} />);
    expect(screen.getByText('Fast turnaround')).toBeDefined();
  });

  it('should render "Moderate demand" when slaLoad is 0.7', () => {
    render(<SlaIndicator slaLoad={0.7} />);
    expect(screen.getByText('Moderate demand')).toBeDefined();
  });

  it('should render "Moderate demand" when slaLoad is 0.85', () => {
    render(<SlaIndicator slaLoad={0.85} />);
    expect(screen.getByText('Moderate demand')).toBeDefined();
  });

  it('should render "High demand" when slaLoad is 0.9', () => {
    render(<SlaIndicator slaLoad={0.9} />);
    expect(screen.getByText('High demand')).toBeDefined();
  });

  it('should render "High demand" when slaLoad is 1.0', () => {
    render(<SlaIndicator slaLoad={1.0} />);
    expect(screen.getByText('High demand')).toBeDefined();
  });
});
