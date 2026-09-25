import { HelpCircle, X } from 'lucide-react';
import { STAGE_HELP } from './stageHelpContent';

interface StageHelpPanelProps {
  stageId: string | null;
  onClose: () => void;
}

export function StageHelpPanel({ stageId, onClose }: StageHelpPanelProps): React.ReactElement | null {
  if (!stageId) return null;

  const content = STAGE_HELP[stageId];
  if (!content) return null;

  return (
    <div
      className="rounded-lg border p-4"
      style={{
        backgroundColor: 'var(--surface-alt)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} style={{ color: 'var(--primary)' }} />
          <h3
            className="font-semibold text-sm"
            style={{ color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}
          >
            {content.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Close help"
        >
          <X size={16} />
        </button>
      </div>

      <p
        className="text-sm leading-relaxed mb-3"
        style={{ color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}
      >
        {content.description}
      </p>

      <div>
        <h4
          className="text-xs font-medium uppercase tracking-wide mb-2"
          style={{ color: 'var(--text)', fontFamily: 'DM Sans, sans-serif' }}
        >
          What to expect
        </h4>
        <ul className="space-y-1.5">
          {content.expectations.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm"
              style={{ color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: 'var(--sage)' }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
