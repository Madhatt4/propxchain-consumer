import React from 'react';

const INPUT_CLASSES =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-base text-gray-900 ' +
  'placeholder:text-gray-400 transition-colors focus:border-teal-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-teal-500/30 disabled:bg-gray-50 disabled:text-gray-500 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ' +
  'dark:disabled:bg-slate-800 dark:disabled:text-slate-400';

export interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: 'text' | 'date' | 'email' | 'tel';
}

/** Labelled input for required detail fields (§1 address, solicitor firm, ...). */
export const TextField: React.FC<TextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  readOnly = false,
  placeholder,
  type = 'text',
}) => (
  <div>
    <label
      htmlFor={id}
      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-slate-300"
    >
      {label}
    </label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={readOnly}
      placeholder={placeholder}
      className={INPUT_CLASSES}
    />
  </div>
);

export interface OptionalTextFieldProps {
  id: string;
  label: string;
  value: string | null;
  /** An emptied input maps to null — mirrors the on-chain ?Text optional. */
  onChange: (value: string | null) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: 'text' | 'date' | 'email' | 'tel';
}

/** TextField over `string | null` for optional fields (§1 UPRN, §12 providers, ...). */
export const OptionalTextField: React.FC<OptionalTextFieldProps> = ({ value, onChange, ...rest }) => (
  <TextField {...rest} value={value ?? ''} onChange={(v) => onChange(v === '' ? null : v)} />
);
