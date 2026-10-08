// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewOnlyFrame } from '../ViewOnlyFrame';

describe('ViewOnlyFrame', () => {
  it('should switch off every control inside and say who acts', () => {
    render(
      <ViewOnlyFrame side="buyer">
        <button type="button">Order searches</button>
        <input aria-label="Upload" type="file" />
        <a href="/doc">Open the report</a>
      </ViewOnlyFrame>,
    );
    expect(screen.getByRole('button', { name: 'Order searches' })).toBeDisabled();
    expect(screen.getByLabelText('Upload')).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Open the report' })).toHaveAttribute('href', '/doc');
    expect(screen.getByRole('note')).toHaveTextContent('for the seller to complete');
  });

  it('should tell an agent that the buyer and seller complete it', () => {
    render(<ViewOnlyFrame side="other"><p>Exchange</p></ViewOnlyFrame>);
    expect(screen.getByRole('note')).toHaveTextContent('The buyer and seller complete this');
  });
});
