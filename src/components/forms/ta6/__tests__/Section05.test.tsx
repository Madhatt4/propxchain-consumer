import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { Section05 } from '../Section05';
import { emptyTA6Form } from '../../../../types/ta6.types';
import type {
  TA6AlterationDocument,
  TA6DocumentValue,
  TA6Section5Alterations,
} from '../../../../types/ta6.types';
import type { DocClassification } from '../../../../services/docClassify.service';

function emptySection5(): TA6Section5Alterations {
  return emptyTA6Form().section5;
}

/** A 5.2 row with nothing chosen yet, around the given slot. */
function row(document: TA6DocumentValue, extra: Partial<TA6AlterationDocument> = {}): TA6AlterationDocument {
  return { kind: null, kindDetails: null, relatesTo: null, document, ...extra };
}

function classified(docType: string, confidence = 0.9): DocClassification {
  return { docType, confidence, inDate: null, matchesProperty: null, unreadable: false };
}

/** An uploadFile stub whose classification settles with the given answer. */
function uploader(classification: DocClassification | null) {
  return vi.fn().mockResolvedValue({
    documentId: '9',
    advisory: Promise.resolve(null),
    classification: Promise.resolve(classification),
  });
}

describe('Section05 consents context', () => {
  it('should upload a 5.2 attachment with the row kind, link and the ticked changes', async () => {
    // Arrange
    const uploadFile = uploader(null);
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_1Alterations: { ...emptySection5().q5_1Alterations, extension: true, loftConversion: true },
      q5_2Documents: [row({ status: 'attached', documentId: null }, { kind: 'planning-permission', relatesTo: 'extension' })],
    };
    render(<Section05 value={value} onChange={() => {}} readOnly={false} uploadFile={uploadFile} />);
    const file = new File(['pdf'], 'decision.pdf', { type: 'application/pdf' });

    // Act
    fireEvent.change(screen.getByLabelText('5.2.1 attachment'), { target: { files: [file] } });

    // Assert
    await waitFor(() =>
      expect(uploadFile).toHaveBeenCalledWith(file, {
        section: '5.2',
        kind: 'planning-permission',
        relatesTo: 'extension',
        ticked: ['extension', 'loft-conversion'],
      }),
    );
  });
});

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
      q5_2Documents: [row({ status: 'to-follow', documentId: null })],
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
      q5_2Documents: [row({ status: 'not-answered', documentId: null })],
    });
  });

  it('should remove the targeted 5.2 row when its remove button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [
        row({ status: 'to-follow', documentId: null }),
        row({ status: 'attached', documentId: '7' }),
      ],
    };
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Remove document 1' }));

    // Assert — only the second row survives
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_2Documents: [row({ status: 'attached', documentId: '7' })],
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

  it('should offer a kind selector on each 5.2 row and write the chosen kind', () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [row({ status: 'to-follow', documentId: null })],
    };
    render(<Section05 value={value} onChange={onChange} readOnly={false} />);

    // Act
    fireEvent.change(screen.getByRole('combobox', { name: '5.2.1 document kind' }), {
      target: { value: 'planning-permission' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({
      ...value,
      q5_2Documents: [row({ status: 'to-follow', documentId: null }, { kind: 'planning-permission' })],
    });
  });

  it('should list only the changes ticked in 5.1 as what a 5.2 row relates to', () => {
    // Arrange
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_1Alterations: { ...emptySection5().q5_1Alterations, extension: true, conservatory: true },
      q5_2Documents: [row({ status: 'to-follow', documentId: null })],
    };
    render(<Section05 value={value} onChange={() => {}} readOnly={false} />);

    // Act
    const options = within(screen.getByRole('combobox', { name: '5.2.1 relates to' })).getAllByRole('option');

    // Assert — a blank, then exactly the two ticked changes
    expect(options.map((o) => o.textContent)).toEqual(['Not linked to a change', 'Conservatory', 'Extension']);
  });

  it('should ask what the other paperwork is only when the kind is other', () => {
    // Arrange
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [
        row({ status: 'to-follow', documentId: null }, { kind: 'other' }),
        row({ status: 'to-follow', documentId: null }, { kind: 'planning-permission' }),
      ],
    };

    // Act
    render(<Section05 value={value} onChange={() => {}} readOnly={false} />);

    // Assert
    expect(screen.getByRole('textbox', { name: '5.2.1 other paperwork details' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '5.2.2 other paperwork details' })).not.toBeInTheDocument();
  });

  it('should prefill a blank kind from a confident upload classification', async () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [row({ status: 'attached', documentId: null })],
    };
    render(
      <Section05 value={value} onChange={onChange} readOnly={false} uploadFile={uploader(classified('planning_permission'))} />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('5.2.1 attachment'), {
      target: { files: [new File(['pdf'], 'decision-notice.pdf', { type: 'application/pdf' })] },
    });

    // Assert — the id lands first, then the kind
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          q5_2Documents: [expect.objectContaining({ kind: 'planning-permission' })],
        }),
      ),
    );
  });

  it('should leave a kind the seller already chose alone whatever the classification says', async () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [row({ status: 'attached', documentId: null }, { kind: 'listed-building-consent' })],
    };
    render(
      <Section05 value={value} onChange={onChange} readOnly={false} uploadFile={uploader(classified('planning_permission'))} />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('5.2.1 attachment'), {
      target: { files: [new File(['pdf'], 'decision-notice.pdf', { type: 'application/pdf' })] },
    });

    // Assert — the upload writes the id once; nothing rewrites the kind
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].q5_2Documents[0].kind).toBe('listed-building-consent');
  });

  it('should not prefill from a classification below the confidence threshold', async () => {
    // Arrange
    const onChange = vi.fn();
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [row({ status: 'attached', documentId: null })],
    };
    render(
      <Section05 value={value} onChange={onChange} readOnly={false} uploadFile={uploader(classified('planning_permission', 0.4))} />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('5.2.1 attachment'), {
      target: { files: [new File(['pdf'], 'maybe.pdf', { type: 'application/pdf' })] },
    });

    // Assert
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].q5_2Documents[0].kind).toBeNull();
  });

  it('should hide the add and remove row controls when readOnly', () => {
    // Arrange
    const value: TA6Section5Alterations = {
      ...emptySection5(),
      q5_2Documents: [row({ status: 'to-follow', documentId: null })],
    };

    // Act
    render(<Section05 value={value} onChange={() => {}} readOnly />);

    // Assert
    expect(screen.queryByRole('button', { name: /add document/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove document 1' })).not.toBeInTheDocument();
  });
});
