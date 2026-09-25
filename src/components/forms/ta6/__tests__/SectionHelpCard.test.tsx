import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SectionHelpCard } from '../SectionHelpCard';
import { getSectionGuide } from '../../../../lib/ta6-prompts/guides';

describe('SectionHelpCard', () => {
  it('should render the plain-English guide for every section 1-15', () => {
    for (let section = 1; section <= 15; section += 1) {
      const guide = getSectionGuide(section);
      expect(guide, `guide missing for section ${section}`).toBeDefined();

      const { unmount } = render(<SectionHelpCard section={section} />);
      expect(screen.getByText(guide!.plainTitle)).toBeInTheDocument();
      expect(screen.getByText(guide!.reassurance)).toBeInTheDocument();
      unmount();
    }
  });

  it('should list the documents worth having to hand', () => {
    const guide = getSectionGuide(5);
    render(<SectionHelpCard section={5} />);
    expect(screen.getByText('Worth having to hand:')).toBeInTheDocument();
    for (const item of guide!.whatYoullNeed) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it('should render nothing for an unknown section number', () => {
    const { container } = render(<SectionHelpCard section={99} />);
    expect(container.firstChild).toBeNull();
  });
});
