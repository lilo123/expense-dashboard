'use client';

import { useState, useMemo, useRef, useEffect } from 'react';

interface MultiSelectDropdownProps {
  label: string;
  pluralLabel: string;
  options: { id: string; name: string }[];
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
  id: string;
}

export default function MultiSelectDropdown({
  label,
  pluralLabel,
  options,
  selectedIds,
  onChange,
  id
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleOption = (optionId: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(optionId)) {
      newSelection.delete(optionId);
    } else {
      newSelection.add(optionId);
    }
    onChange(newSelection);
  };

  const handleSelectAll = () => {
    onChange(new Set(options.map(o => o.id)));
  };

  const handleClearAll = () => {
    onChange(new Set());
  };

  const summaryText = useMemo(() => {
    if (selectedIds.size === 0 || selectedIds.size === options.length) {
      return `All ${pluralLabel}`;
    }
    if (selectedIds.size <= 2) {
      return options
        .filter(o => selectedIds.has(o.id))
        .map(o => o.name)
        .join(', ');
    }
    return `${selectedIds.size} ${pluralLabel}`;
  }, [selectedIds, options, pluralLabel]);

  return (
    <div ref={containerRef} className="relative inline-block w-full sm:w-auto" id={`${id}-container`}>
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ minHeight: 0 }}
        className="w-full sm:w-auto px-4 py-0 rounded-full border border-zen-lavender/30 bg-white text-zen-charcoal text-sm outline-none cursor-pointer hover:bg-white/90 transition-all flex items-center justify-between gap-2 shadow-sm font-semibold h-9 min-h-0 shrink-0 box-border"
      >
        <span className="min-w-0 flex-1 text-left truncate">{summaryText}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto top-10 min-w-[220px] bg-white/95 backdrop-blur-xl border border-zen-lavender/40 shadow-xl rounded-3xl p-4 z-50 flex flex-col gap-2 animate-fade-in">
          <div className="flex justify-between items-center border-b border-zen-lavender/20 pb-2 mb-1 px-1">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-bold text-zen-sage hover:opacity-80 cursor-pointer border-none bg-transparent"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-bold text-zen-charcoal/60 hover:text-zen-charcoal cursor-pointer border-none bg-transparent"
            >
              Clear
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto flex flex-col gap-1 pr-1">
            {options.map(opt => {
              const isChecked = selectedIds.has(opt.id);
              const checkboxId = `checkbox-${id}-${opt.id}`;
              return (
                <label
                  key={opt.id}
                  htmlFor={checkboxId}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-zen-sage/10 cursor-pointer text-sm text-zen-charcoal transition-colors select-none"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleOption(opt.id)}
                    className="shrink-0 rounded text-zen-sage focus:ring-zen-sage/50 cursor-pointer w-4 h-4"
                  />
                  <span className="font-semibold">{opt.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
