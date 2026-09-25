import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Section05 } from '../Section05';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type { TA6Section5Alterations } from '../../../../types/ta6.types';

function emptySection5(): TA6Section5Alterations {
  return emptyTA6Form().section5;
}

describe('Section05', () => {
  it('should render the 5.1 tick-set, 5.2 documents block, response questions and the solar toggle', () => {
    // Arrange / Act
    render(<Section05 value={emptySection5()} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('checkbox', { name: 'Extension' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add document/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '5.3 answer' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: '5.6 solar panel system present' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '5.9 answer' })).toBeInTheDocument();
  });

  it('should call onChange with extension ticked when the Extension checkbox is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection5();
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: 'Extension' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_1Alterations: { ...value.q5_1Alterations, extension: true },
    });
  });

  it('should render an open ghost 5.2 slot with no remove control when no documents exist', () => {
    // Arrange / Act
    render(<Section05 value={emptySection5()} onChange={() => {}} readOnly={false} />);

    // Assert — the first slot sits open without a click, but cannot be removed
    expect(screen.getByRole('group', { name: '5.2.1 document status' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove document 1' })).not.toBeInTheDocument();
  });

  it('should materialise the ghost 5.2 slot as a one-element array on first interaction', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection5();
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '5.2.1 document status' });
    fireEvent.click(within(group).getByRole('button', { name: 'To follow' }));

    // Assert — the interaction writes through the ghost, nothing fired before
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_2Documents: [{ status: 'to-follow', documentId: null }],
    });
  });

  it('should append an empty 5.2 consent slot when Add document is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection5();
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /add document/i }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_2Documents: [{ status: 'not-answered', documentId: null }],
    });
  });

  it('should remove the targeted 5.2 row when its remove button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [
        { status: 'to-follow', documentId: null },
        { status: 'attached', documentId: '7' },
      ],
    };
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove document 1' }));

    // Assert — only the second row survives
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_2Documents: [{ status: 'attached', documentId: '7' }],
    });
  });

  it('should create a fully-draft solar block when the 5.6 checkbox is ticked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<Section05 value={emptySection5()} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('checkbox', { name: '5.6 solar panel system present' }));

    // Assert
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as TA6Section5Alterations;
    expect(next.q5_6Solar).toEqual({
      fitOrSegAgreement: { status: 'not-answered', documentId: null },
      supplyAgreement: { status: 'not-answered', documentId: null },
      electricityBill: { status: 'not-answered', documentId: null },
      installDate: null,
      ownedOutright: null,
      mcsCertificate: { status: 'not-answered', documentId: null },
    });
  });

  it('should render the solar follow-ups only while a solar block exists', () => {
    // Arrange
    const withSolar: TA6Section5Alterations = {
      ...emptySection5(),
      q5_6Solar: {
        fitOrSegAgreement: { status: 'not-answered', documentId: null },
        supplyAgreement: { status: 'not-answered', documentId: null },
        electricityBill: { status: 'not-answered', documentId: null },
        installDate: null,
        ownedOutright: null,
        mcsCertificate: { status: 'not-answered', documentId: null },
      },
    };

    // Act
    const { rerender } = render(
      <Section05 value={withSolar} onChange={() => {}} readOnly={false} />,
    );

    // Assert — expanded block shows the three agreements + MCS + ownership
    expect(screen.getByRole('group', { name: '5.6.i document status' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '5.6.mcs document status' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '5.6 ownership' })).toBeInTheDocument();
    expect(screen.getByLabelText('When was the solar system installed?')).toBeInTheDocument();

    // Act — collapse
    rerender(<Section05 value={emptySection5()} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.queryByRole('group', { name: '5.6.i document status' })).not.toBeInTheDocument();
  });

  it('should call onChange with a not-known 5.3 answer when Not known is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value = emptySection5();
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    const group = screen.getByRole('group', { name: '5.3 answer' });
    fireEvent.click(within(group).getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_3NonResidentialUse: { answer: 'not-known', details: '' },
    });
  });

  it('should hide the add and remove row controls when readOnly', () => {
    // Arrange
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [{ status: 'to-follow', documentId: null }],
    };

    // Act
    render(<Section05 value={value} onChange={() => {}} readOnly />);

    // Assert
    expect(screen.queryByRole('button', { name: /add document/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove document 1' })).not.toBeInTheDocument();
  });
});
