import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocumentStatusList from '../DocumentStatusList';

describe('DocumentStatusList', () => {
  it('should show a line per category with no filename', () => {
    render(<DocumentStatusList rows={[{ category: 'funds', verified: true, uploadedAtNs: '1' }]} />);

    expect(screen.getByText('Buyer funds: received')).toBeInTheDocument();
  });

  it('should render nothing when the viewer can open every document', () => {
    const { container } = render(<DocumentStatusList rows={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
