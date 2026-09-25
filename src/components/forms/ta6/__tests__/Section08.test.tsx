import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section08 } from '../Section08';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { TA6Section8Environmental } from '../../../../types/ta6.types';

const emptySlice = (): TA6Section8Environmental => emptyTA6Form().section8;

describe('Section08', () => {
  it('should render every numbered question with the follow-up slots hidden on a draft form', () => {
    // Arrange / Act
    render(<Section08 value={emptySlice()} onChange={() => {}} readOnly={false} />);

    // Assert — 8.1..8.7 present, conditional follow-ups absent
    for (const ref of ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7']) {
      expect(screen.getByText(ref)).toBeInTheDocument();
    }
    expect(screen.queryByRole('group', { name: '8.3a document status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '8.3b answer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '8.5 document status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '8.7 document status' })).not.toBeInTheDocument();
  });

  it('should call onChange with a not-known 8.1 flooding response when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section08 value={emptySlice()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(
      within(screen.getByRole('group', { name: '8.1 answer' })).getByRole('button', {
        name: 'Not known',
      }),
    );

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q8_1Flooded: { answer: 'not-known', details: '' } }),
    );
  });

  it('should reveal the radon report slot and action-level question when a test was carried out', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section8Environmental = {
      ...emptySlice(),
      q8_3RadonTest: { answer: 'yes', details: 'Tested 2024' },
    };
    render(<Section08 value={slice} onChange={onChange} readOnly={false} />);

    // Act — mark the report as to-follow
    fireEvent.click(
      within(screen.getByRole('group', { name: '8.3a document status' })).getByRole('button', {
        name: 'To follow',
      }),
    );

    // Assert
    expect(screen.getByRole('group', { name: '8.3b answer' })).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q8_3aReport: { status: 'to-follow', documentId: null } }),
    );
  });

  it('should reveal the Green Deal bill slot only when the seller answers yes to 8.5', () => {
    // Arrange
    const slice: TA6Section8Environmental = {
      ...emptySlice(),
      q8_5GreenDeal: { answer: 'yes', details: '' },
    };

    // Act
    render(<Section08 value={slice} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('group', { name: '8.5 document status' })).toBeInTheDocument();
  });

  it('should reveal the knotweed survey slot when 8.7 is answered yes and report a status change', () => {
    // Arrange
    const onChange = vi.fn();
    const slice: TA6Section8Environmental = { ...emptySlice(), q8_7KnotweedSurvey: 'yes' };
    render(<Section08 value={slice} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(
      within(screen.getByRole('group', { name: '8.7 document status' })).getByRole('button', {
        name: 'To follow',
      }),
    );

    // Assert
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ q8_7SurveyDocument: { status: 'to-follow', documentId: null } }),
    );
  });

  it('should keep an attached radon report visible even after the 8.3 answer changes to no', () => {
    // Arrange — document already attached, answer flipped away from yes
    const slice: TA6Section8Environmental = {
      ...emptySlice(),
      q8_3RadonTest: { answer: 'no', details: '' },
      q8_3aReport: { status: 'attached', documentId: '17' },
    };

    // Act
    render(<Section08 value={slice} onChange={() => {}} readOnly={false} />);

    // Assert — the slot never hides existing data
    expect(screen.getByRole('group', { name: '8.3a document status' })).toBeInTheDocument();
    expect(screen.getByText('Document attached (#17)')).toBeInTheDocument();
  });
});
