import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Widgets imported from their own modules (not the barrel) so the test stays
// hermetic — the barrel also re-exports makeTa6Uploader, which pulls in the
// icp.service / supabase singletons.
import { AnswerButtons } from '../widgets/AnswerButtons';
import { ResponseField } from '../widgets/ResponseField';
import { DocumentSlot } from '../widgets/DocumentSlot';
import { SectionCard } from '../widgets/SectionCard';
import { OptionalTextField } from '../widgets/TextFields';
import type { TA6PromptEntry } from '../widgets/types';

// Shape matches the ADR 0009 paraphrase bundle (src/lib/ta6-prompts).
const prompt: TA6PromptEntry = {
  ref: '5.2',
  prompt: 'Has any part of the property been altered?',
  helpText: 'Answer from what you actually know.',
  lawSocietyAnchor: 'https://www.lawsociety.org.uk/topics/property/ta6#q5-2',
};

describe('AnswerButtons', () => {
  it('should render yes, no and not-known as first-class buttons by default', () => {
    // Arrange / Act
    render(<AnswerButtons value="not-answered" onChange={() => {}} />);

    // Assert — 'Not known' is a button, never a dropdown option
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not known' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('should call onChange with not-known when the Not known button is clicked', () => {
    // Arrange
    const onChange = vi.fn();
    render(<AnswerButtons value="not-answered" onChange={onChange} />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Not known' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith('not-known');
  });

  it('should render a not-applicable button when passed in options', () => {
    // Arrange / Act
    render(
      <AnswerButtons
        value="not-answered"
        onChange={() => {}}
        options={['yes', 'no', 'not-known', 'not-applicable']}
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'Not applicable' })).toBeInTheDocument();
  });

  it('should disable every button when readOnly', () => {
    // Arrange / Act
    render(<AnswerButtons value="yes" onChange={() => {}} readOnly />);

    // Assert
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
  });
});

describe('ResponseField', () => {
  it('should render the ref chip, paraphrased prompt and help text without a per-question link', () => {
    // Arrange / Act
    render(
      <ResponseField
        refCode="5.2"
        prompt={prompt}
        value={{ answer: 'not-answered', details: '' }}
        onChange={() => {}}
      />,
    );

    // Assert — the official-form link lives once in the shell header, never per question
    expect(screen.getByText('5.2')).toBeInTheDocument();
    expect(screen.getByText(prompt.prompt)).toBeInTheDocument();
    expect(screen.getByText('Answer from what you actually know.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('should hide the details textarea when the answer is no and details are empty', () => {
    // Arrange / Act
    render(
      <ResponseField
        refCode="5.2"
        prompt={prompt}
        value={{ answer: 'no', details: '' }}
        onChange={() => {}}
      />,
    );

    // Assert
    expect(screen.queryByLabelText('5.2 details')).not.toBeInTheDocument();
  });

  it('should show the details textarea when the answer is yes', () => {
    // Arrange
    const onChange = vi.fn();
    render(
      <ResponseField
        refCode="5.2"
        prompt={prompt}
        value={{ answer: 'yes', details: '' }}
        onChange={onChange}
      />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('5.2 details'), {
      target: { value: 'Loft conversion in 2019' },
    });

    // Assert
    expect(onChange).toHaveBeenCalledWith({ answer: 'yes', details: 'Loft conversion in 2019' });
  });

  it('should keep non-empty details visible and editable even when the answer is no', () => {
    // Arrange / Act
    render(
      <ResponseField
        refCode="5.2"
        prompt={prompt}
        value={{ answer: 'no', details: 'Previously declared, now resolved' }}
        onChange={() => {}}
      />,
    );

    // Assert
    expect(screen.getByLabelText('5.2 details')).toHaveValue('Previously declared, now resolved');
    expect(screen.getByLabelText('5.2 details')).not.toBeDisabled();
  });
});

describe('DocumentSlot', () => {
  it('should call onChange with a null documentId when a non-attached status is chosen', () => {
    // Arrange
    const onChange = vi.fn();
    render(
      <DocumentSlot
        refCode="4.2"
        prompt={prompt}
        value={{ status: 'not-answered', documentId: null }}
        onChange={onChange}
      />,
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'To follow' }));

    // Assert
    expect(onChange).toHaveBeenCalledWith({ status: 'to-follow', documentId: null });
  });

  it('should show the document id chip when a document is attached', () => {
    // Arrange / Act
    render(
      <DocumentSlot
        refCode="4.2"
        prompt={prompt}
        value={{ status: 'attached', documentId: '42' }}
        onChange={() => {}}
      />,
    );

    // Assert
    expect(screen.getByText('Document attached (#42)')).toBeInTheDocument();
  });

  it('should run onUpload and store the resolved documentId when a file is picked', async () => {
    // Arrange
    const onChange = vi.fn();
    const onUpload = vi.fn().mockResolvedValue('99');
    render(
      <DocumentSlot
        refCode="4.2"
        prompt={prompt}
        value={{ status: 'attached', documentId: null }}
        onChange={onChange}
        onUpload={onUpload}
      />,
    );
    const file = new File(['pdf-bytes'], 'fensa-cert.pdf', { type: 'application/pdf' });

    // Act
    fireEvent.change(screen.getByLabelText('4.2 attachment'), { target: { files: [file] } });

    // Assert
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ status: 'attached', documentId: '99' }),
    );
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('should surface an upload failure inline without changing the value', async () => {
    // Arrange
    const onChange = vi.fn();
    const onUpload = vi.fn().mockRejectedValue(new Error('Secure upload failed: bucket down'));
    render(
      <DocumentSlot
        refCode="4.2"
        prompt={prompt}
        value={{ status: 'attached', documentId: null }}
        onChange={onChange}
        onUpload={onUpload}
      />,
    );
    const file = new File(['pdf-bytes'], 'fensa-cert.pdf', { type: 'application/pdf' });

    // Act
    fireEvent.change(screen.getByLabelText('4.2 attachment'), { target: { files: [file] } });

    // Assert
    await waitFor(() =>
      expect(screen.getByText(/Secure upload failed: bucket down/)).toBeInTheDocument(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SectionCard', () => {
  it('should call onSave and show the unsaved indicator when dirty', () => {
    // Arrange
    const onSave = vi.fn();
    render(
      <SectionCard index={2} title="Boundaries" complete={false} dirty saving={false} onSave={onSave}>
        <p>section body</p>
      </SectionCard>,
    );

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Save section' }));

    // Assert
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Section 2: Boundaries' })).toBeInTheDocument();
  });

  it('should show Saved and disable the save button when there are no unsaved changes', () => {
    // Arrange / Act
    render(
      <SectionCard
        index={3}
        title="Disputes"
        complete
        dirty={false}
        saving={false}
        onSave={() => {}}
      >
        <p>section body</p>
      </SectionCard>,
    );

    // Assert
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save section' })).toBeDisabled();
  });
});

describe('OptionalTextField', () => {
  it('should map an emptied input to null to mirror the on-chain optional', () => {
    // Arrange
    const onChange = vi.fn();
    render(
      <OptionalTextField
        id="ta6-uprn"
        label="UPRN"
        value="100021300679"
        onChange={onChange}
      />,
    );

    // Act
    fireEvent.change(screen.getByLabelText('UPRN'), { target: { value: '' } });

    // Assert
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
