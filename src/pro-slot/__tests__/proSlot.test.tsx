// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProStub from '../stub';

describe('Pro stub', () => {
  it('says the trade workspaces are not in this build', () => {
    render(<MemoryRouter><ProStub /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'PropXchain Pro' })).toBeInTheDocument();
    expect(screen.getByText(/not part of this build/)).toBeInTheDocument();
  });
});
