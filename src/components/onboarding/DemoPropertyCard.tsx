/**
 * The seeded demo property card + its read-only preview.
 *
 * Shown only on an empty dashboard. Every surface carries a DEMO badge, and the
 * preview is entirely self-contained — it renders the fixture and nothing else,
 * so no service, canister or provider is ever touched from here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { DEMO_PROPERTY } from './demoProperty';

interface DemoPropertyCardProps {
  readonly onDismiss: () => void;
}

const DemoBadge: React.FC = () => (
  <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
    Demo — not a real move
  </span>
);

const STATE_MARK: Record<string, string> = { done: '✓', active: '•', todo: '' };
const STATE_CLASS: Record<string, string> = {
  done: 'bg-green-600 text-white',
  active: 'bg-amber-500 text-white',
  todo: 'bg-stone-200 dark:bg-gray-700 text-stone-500 dark:text-gray-400',
};

const DemoPreview: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Demo property, ${DEMO_PROPERTY.addressLine}`}
        onClick={(e) => e.stopPropagation()}
        className="card w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-7"
      >
        <DemoBadge />
        <h2 className="text-[var(--text-main)] text-xl font-bold mt-3 mb-1">
          {DEMO_PROPERTY.addressLine}, {DEMO_PROPERTY.postcode}
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {DEMO_PROPERTY.priceLabel} · {DEMO_PROPERTY.tenure} · EPC {DEMO_PROPERTY.epc}
        </p>

        <h3 className="text-[var(--text-main)] font-semibold mb-2">Where this move has got to</h3>
        <ol className="list-none p-0 m-0 mb-5 space-y-2">
          {DEMO_PROPERTY.stages.map((stage) => (
            <li key={stage.label} className="flex gap-3 items-start">
              <span
                aria-hidden="true"
                className={`shrink-0 w-6 h-6 rounded-full text-xs flex items-center justify-center ${STATE_CLASS[stage.state]}`}
              >
                {STATE_MARK[stage.state]}
              </span>
              <span>
                <span className="block text-[var(--text-main)] text-sm font-semibold">{stage.label}</span>
                <span className="block text-[var(--text-secondary)] text-sm">{stage.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <h3 className="text-[var(--text-main)] font-semibold mb-2">What is in the pack</h3>
        <ul className="list-none p-0 m-0 mb-5 space-y-1">
          {DEMO_PROPERTY.packItems.map((item) => (
            <li key={item} className="text-[var(--text-secondary)] text-sm">
              — {item}
            </li>
          ))}
        </ul>

        <p className="text-[var(--text-secondary)] text-sm mb-4">
          This is an example so you can see the shape of a move. Nothing here has been ordered or paid for.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full px-6 rounded-lg border-none bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  );
};

const DemoPropertyCard: React.FC<DemoPropertyCardProps> = ({ onDismiss }) => {
  const [isPreviewOpen, setPreviewOpen] = useState(false);
  const openPreview = useCallback(() => setPreviewOpen(true), []);

  return (
    <>
      <div className="card p-5 border-2 border-dashed border-amber-400 dark:border-amber-600">
        <div className="flex items-start justify-between gap-3 mb-3">
          <DemoBadge />
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Remove the demo property"
            className="min-h-[44px] min-w-[44px] px-2 bg-transparent border-none text-[var(--text-secondary)] hover:text-[var(--text-main)] cursor-pointer text-sm"
          >
            Remove
          </button>
        </div>

        <h3 className="text-[var(--text-main)] text-lg font-bold mb-1">
          {DEMO_PROPERTY.addressLine}, {DEMO_PROPERTY.postcode}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm mb-4">
          {DEMO_PROPERTY.priceLabel} · {DEMO_PROPERTY.tenure} · pack ready
        </p>

        <button
          type="button"
          onClick={openPreview}
          className="min-h-[44px] px-5 rounded-lg border border-stone-300 dark:border-gray-600 bg-transparent text-stone-700 dark:text-gray-300 font-semibold cursor-pointer"
        >
          Look around this example
        </button>
      </div>

      {isPreviewOpen && <DemoPreview onClose={() => setPreviewOpen(false)} />}
    </>
  );
};

export default DemoPropertyCard;
