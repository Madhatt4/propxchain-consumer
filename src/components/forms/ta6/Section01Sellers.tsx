// TA6 §1 sellers array editor — one row per selling party (fullName, capacity
// select over TA6SellerRole, optional ownership/authority date). Capacity is a
// fact about the party, not a legal yes/no answer, so a select is fine here
// (the no-dropdowns rule applies to TA6AnswerValue answers only).

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { section01Prompt } from './Section01Contacts';
import { OptionalTextField, TextField } from './widgets/TextFields';

import type { TA6SellerParty, TA6SellerRole } from '../../../types/ta6.types';

const SELLER_ROLE_OPTIONS: readonly TA6SellerRole[] = [
  'seller',
  'executor',
  'administrator',
  'attorney',
  'trustee',
];

const SELLER_ROLE_LABELS: Readonly<Record<TA6SellerRole, string>> = {
  seller: 'Owner (seller)',
  executor: 'Executor',
  administrator: 'Administrator',
  attorney: 'Attorney',
  trustee: 'Trustee',
};

const SELECT_CLASSES =
  'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ' +
  'focus:ring-blue-500 text-gray-900 bg-white disabled:bg-gray-50 disabled:text-gray-500';

// Ghost-row seed: matches exactly what the Add seller button appends. Rows are
// only ever updated by spreading, so sharing the constant is safe.
const EMPTY_SELLER: TA6SellerParty = { fullName: '', role: 'seller', ownershipOrAuthorityDate: null };

interface SellerRowProps {
  index: number;
  seller: TA6SellerParty;
  readOnly: boolean;
  /** False while the row is the unmaterialised ghost — you cannot delete it. */
  canRemove: boolean;
  onChange: (next: TA6SellerParty) => void;
  onRemove: () => void;
}

const SellerRow: React.FC<SellerRowProps> = ({
  index,
  seller,
  readOnly,
  canRemove,
  onChange,
  onRemove,
}) => (
  <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end border border-gray-200 rounded-md p-3">
    <TextField
      id={`ta6-1-seller-${index}-name`}
      label="Full name"
      value={seller.fullName}
      onChange={(fullName) => onChange({ ...seller, fullName })}
      readOnly={readOnly}
    />
    <div>
      <label
        htmlFor={`ta6-1-seller-${index}-role`}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Capacity
      </label>
      <select
        id={`ta6-1-seller-${index}-role`}
        value={seller.role}
        onChange={(e) => onChange({ ...seller, role: e.target.value as TA6SellerRole })}
        disabled={readOnly}
        className={SELECT_CLASSES}
      >
        {SELLER_ROLE_OPTIONS.map((role) => (
          <option key={role} value={role}>
            {SELLER_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </div>
    <OptionalTextField
      id={`ta6-1-seller-${index}-date`}
      label="Ownership / authority date"
      type="date"
      value={seller.ownershipOrAuthorityDate}
      onChange={(ownershipOrAuthorityDate) => onChange({ ...seller, ownershipOrAuthorityDate })}
      readOnly={readOnly}
    />
    {!readOnly && canRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove seller ${index + 1}`}
        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
      >
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </button>
    )}
  </div>
);

export interface Section01SellersProps {
  sellers: TA6SellerParty[];
  onChange: (next: TA6SellerParty[]) => void;
  readOnly: boolean;
}

export const Section01Sellers: React.FC<Section01SellersProps> = ({
  sellers,
  onChange,
  readOnly,
}) => {
  // Ghost row: with no sellers yet an open row renders so the fields sit ready
  // to type into, but nothing is written until the first keystroke (the update
  // handler writes through the ghost; removing the last real row brings it back).
  const displayRows = sellers.length > 0 ? sellers : readOnly ? [] : [EMPTY_SELLER];
  const capacityHelp = section01Prompt('1.seller.role')?.helpText;

  const updateRow = (index: number, next: TA6SellerParty): void => {
    const base = sellers.length > 0 ? sellers : [EMPTY_SELLER];
    onChange(base.map((row, i) => (i === index ? next : row)));
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-gray-900">Sellers</h4>
      {capacityHelp && <p className="text-sm text-gray-500">{capacityHelp}</p>}
      {displayRows.map((seller, index) => (
        <SellerRow
          key={index}
          index={index}
          seller={seller}
          readOnly={readOnly}
          canRemove={sellers.length > 0}
          onChange={(next) => updateRow(index, next)}
          onRemove={() => onChange(sellers.filter((_, i) => i !== index))}
        />
      ))}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...sellers, { ...EMPTY_SELLER }])}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add seller
        </button>
      )}
    </div>
  );
};
