import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Loader2, Check, User } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  meta?: string;
  icon?: React.ReactNode;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  clearLabel?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  clearLabel,
  icon,
  loading = false,
  loadingText = 'Loading...',
  emptyText = 'No options available.',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const haystack = [o.label, o.sublabel || '', o.meta || ''].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setHighlight(-1);
      setTimeout(() => searchRef.current?.focus(), 10);
    }
  }, [open]);

  const visible = clearLabel ? [{ value: '', label: clearLabel }, ...filtered] : filtered;

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, visible.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && visible[highlight]) {
        select(visible[highlight].value);
      }
    }
    if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  useEffect(() => {
    if (highlight >= 0 && listRef.current) {
      const el = listRef.current.children[highlight] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlight]);

  const hasOptions = filtered.length > 0;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border text-xs focus:outline-none focus:border-[var(--role-primary)] text-left transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ borderColor: open ? 'var(--role-primary)' : 'var(--role-border, #e2e8f0)' }}
      >
        <span className="shrink-0 text-slate-400">
          {selected?.icon || icon || <User className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          {selected ? (
            <>
              <span className="block text-slate-900 truncate">{selected.label}</span>
              {(selected.sublabel || selected.meta) && (
                <span className="block text-[10px] text-slate-500 truncate">
                  {[selected.sublabel, selected.meta].filter(Boolean).join(' · ')}
                </span>
              )}
            </>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-xl overflow-hidden"
          style={{ background: 'var(--role-surface, #ffffff)', border: '1px solid var(--role-border)', boxShadow: '0 10px 30px rgba(15,23,42,0.15)' }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid var(--role-border-subtle)' }}>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlight(-1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[var(--role-primary)]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {loadingText}
            </div>
          ) : (
            <div
              ref={listRef}
              className="overflow-y-auto"
              style={{ maxHeight: 280 }}
              role="listbox"
            >
              {visible.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">{emptyText}</div>
              ) : (
                visible.map((o, idx) => (
                  <button
                    key={o.value || '__clear__'}
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => select(o.value)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors duration-100"
                    style={{
                      backgroundColor: idx === highlight ? 'var(--role-bg-subtle, #f1f5f9)' : 'var(--role-surface, #ffffff)',
                    }}
                  >
                    <span className="shrink-0 text-slate-400">{o.icon || <User className="w-4 h-4" />}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-medium text-slate-900 truncate">{o.label}</span>
                      {(o.sublabel || o.meta) && (
                        <span className="block text-[10px] text-slate-500 truncate">
                          {[o.sublabel, o.meta].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </span>
                    {o.value === value && <Check className="w-4 h-4 shrink-0" style={{ color: 'var(--role-primary)' }} />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};