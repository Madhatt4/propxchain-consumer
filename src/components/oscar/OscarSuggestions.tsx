import React from 'react';

interface OscarSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export const OscarSuggestions: React.FC<OscarSuggestionsProps> = ({
  suggestions,
  onSelect,
}) => {
  return (
    <div className="pb-2">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            onClick={() => onSelect(suggestion)}
            className="text-xs px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-full text-teal-700 transition-colors"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};
