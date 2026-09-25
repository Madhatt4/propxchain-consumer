import React, { KeyboardEvent, useState, useRef, useEffect } from 'react';

interface DocumentOption {
  id: number;
  fileName: string;
  docType: string;
  contentType: string;
  transactionId?: string;
  propertyAddress?: string;
}

interface OscarInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  availableDocuments?: DocumentOption[];
  selectedDocument?: DocumentOption | null;
  onSelectDocument?: (doc: DocumentOption | null) => void;
}

export const OscarInput: React.FC<OscarInputProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  availableDocuments = [],
  selectedDocument = null,
  onSelectDocument,
}) => {
  const [showDocPicker, setShowDocPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowDocPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="space-y-2">
      {/* Attached document badge */}
      {selectedDocument && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 border border-teal-200 rounded-lg text-sm">
          <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-teal-800 truncate">{selectedDocument.fileName}</span>
          <button
            type="button"
            onClick={() => onSelectDocument?.(null)}
            className="ml-auto text-teal-500 hover:text-teal-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {/* Paperclip attachment button */}
        {availableDocuments.length > 0 && onSelectDocument && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setShowDocPicker(!showDocPicker)}
              disabled={disabled}
              className="p-3 text-stone-400 hover:text-teal-600 disabled:opacity-50 transition-colors"
              title="Attach document for analysis"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            {/* Document picker dropdown */}
            {showDocPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-80 bg-white border border-stone-200 rounded-lg shadow-lg z-10 max-h-72 overflow-y-auto">
                <div className="p-2 border-b border-stone-100">
                  <span className="text-xs font-medium text-stone-500">Attach document for AI analysis</span>
                </div>
                {(() => {
                  // Group documents by property address
                  const grouped: Record<string, DocumentOption[]> = {};
                  for (const doc of availableDocuments) {
                    const key = doc.propertyAddress || 'Documents';
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(doc);
                  }
                  const groups = Object.entries(grouped);
                  const hasMultipleGroups = groups.length > 1;

                  return groups.map(([address, docs]) => (
                    <div key={address}>
                      {hasMultipleGroups && (
                        <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-100">
                          <span className="text-xs font-semibold text-stone-500 truncate block">{address}</span>
                        </div>
                      )}
                      {docs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            onSelectDocument(doc);
                            setShowDocPicker(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-teal-50 flex items-center gap-2 text-sm transition-colors"
                        >
                          <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="min-w-0">
                            <div className="text-stone-700 truncate">{doc.fileName}</div>
                            <div className="text-xs text-stone-400">{doc.docType}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedDocument ? `Ask Oscar about ${selectedDocument.fileName}...` : "Ask Oscar anything..."}
          disabled={disabled}
          className="flex-1 resize-none border border-stone-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-stone-900 placeholder:text-stone-400"
          rows={2}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20 transition-all"
        >
          Send
        </button>
      </div>
    </div>
  );
};
