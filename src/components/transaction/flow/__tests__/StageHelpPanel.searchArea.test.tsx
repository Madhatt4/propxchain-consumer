// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StageHelpPanel } from '../StageHelpPanel';
import { searchAreaFallbackLine } from '../searchAreaHelp';
import { DEFAULT_HALF_SIZE_METRES } from '../../../../services/propertyBoundary.service';

const noop = (): void => undefined;

describe('Property Searches help: search area', () => {
  it('explains how the search area is worked out', () => {
    render(<StageHelpPanel stageId="seller-2" onClose={noop} />);
    const section = screen.getByTestId('search-area-help');
    expect(section).toHaveTextContent('How we work out the search area');
    expect(section).toHaveTextContent('registered boundary');
    expect(section).toHaveTextContent('exact address point');
    expect(section).toHaveTextContent('70 m across');
    expect(section).toHaveTextContent('tell your conveyancer');
    expect(section).not.toHaveTextContent("conveyancer's searches");
  });

  it('shows no property-specific line when the real boundary was used', () => {
    render(
      <StageHelpPanel stageId="seller-2" searchArea={{ source: 'inspire-polygon', halfSizeMetres: null }} onClose={noop} />,
    );
    expect(screen.queryByTestId('search-area-fallback')).toBeNull();
  });

  it("shows no property-specific line while the area is still resolving", () => {
    render(<StageHelpPanel stageId="seller-2" searchArea={null} onClose={noop} />);
    expect(screen.queryByTestId('search-area-fallback')).toBeNull();
  });

  it('says the postcode square is used when neither boundary nor address point matched', () => {
    render(
      <StageHelpPanel stageId="seller-2" searchArea={{ source: 'postcode-centroid', halfSizeMetres: 35 }} onClose={noop} />,
    );
    expect(screen.getByTestId('search-area-fallback')).toHaveTextContent(
      'we could not match its own boundary or address point, so your searches will cover a 70 m square centred on the postcode',
    );
  });

  it('says the address point is used when only that matched', () => {
    expect(searchAreaFallbackLine({ source: 'uprn-centroid', halfSizeMetres: 35 })).toContain(
      'matched the exact address point',
    );
  });

  it('does not add the section to other stages', () => {
    render(<StageHelpPanel stageId="seller-3" searchArea={{ source: 'postcode-centroid', halfSizeMetres: 35 }} onClose={noop} />);
    expect(screen.queryByTestId('search-area-help')).toBeNull();
  });

  it('uses the same square size in the general text and the property line', () => {
    const side = `${DEFAULT_HALF_SIZE_METRES * 2} m`;
    render(
      <StageHelpPanel
        stageId="seller-2"
        searchArea={{ source: 'postcode-centroid', halfSizeMetres: DEFAULT_HALF_SIZE_METRES }}
        onClose={noop}
      />,
    );
    expect(screen.getByTestId('search-area-help')).toHaveTextContent(`${side} across`);
    expect(screen.getByTestId('search-area-fallback')).toHaveTextContent(`${side} square`);
  });

  it('drops the property line when the area is cleared', () => {
    const { rerender } = render(
      <StageHelpPanel stageId="seller-2" searchArea={{ source: 'postcode-centroid', halfSizeMetres: 35 }} onClose={noop} />,
    );
    expect(screen.getByTestId('search-area-fallback')).toBeInTheDocument();
    rerender(<StageHelpPanel stageId="seller-2" searchArea={null} onClose={noop} />);
    expect(screen.queryByTestId('search-area-fallback')).toBeNull();
  });
});
