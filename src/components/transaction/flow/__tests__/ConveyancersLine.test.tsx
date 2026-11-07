// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConveyancersLine } from '../ConveyancersLine';
import { NO_CONVEYANCERS } from '@/lib/dealConveyancers';

const BOTH = {
  buyer: { principal: 'buyer-firm', firmName: 'Test Firm One' },
  seller: { principal: 'seller-firm', firmName: 'Test Firm Two' },
};

describe('<ConveyancersLine>', () => {
  it('should name the buyer\'s conveyancer to the buyer once the firm has joined', () => {
    render(<ConveyancersLine conveyancers={BOTH} dealSide="buyer" hasBuyer />);
    expect(screen.getByText('Your conveyancer: Test Firm One')).toBeInTheDocument();
    expect(screen.getByText("The seller's conveyancer: Test Firm Two")).toBeInTheDocument();
  });

  it('should render nothing for an agent when no firm has joined', () => {
    const { container } = render(<ConveyancersLine conveyancers={NO_CONVEYANCERS} dealSide="other" hasBuyer />);
    expect(container).toBeEmptyDOMElement();
  });
});
