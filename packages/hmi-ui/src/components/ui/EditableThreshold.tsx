import React, { useState, useRef, useEffect } from 'react';

interface Props {
  label:    string;
  value:    number;
  onChange: (v: number) => void;
  step?:    number;
  color?:   string;
}

export const EditableThreshold: React.FC<Props> = ({ label, value, onChange, step = 0.1, color }) => {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const open = () => {
    setDraft(String(value));
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="text-2xs font-semibold" style={{ color: color ?? 'var(--text-2)' }}>{label}</span>
        <input
          ref={inputRef}
          type="number"
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
          style={{
            width: 52,
            background: 'var(--panel-alt)',
            border: '1px solid var(--accent)',
            color: 'var(--text)',
            borderRadius: 2,
            padding: '0 4px',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.7rem',
            outline: 'none',
          }}
        />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-0.5 cursor-pointer select-none group"
      onClick={open}
      title="Click to edit"
    >
      <span className="text-2xs font-semibold" style={{ color: color ?? 'var(--text-2)' }}>{label}</span>
      <span
        className="text-2xs font-semibold transition-colors"
        style={{ color: color ?? 'var(--text-2)', textDecoration: 'underline dotted', textUnderlineOffset: 2 }}
      >
        {value}
      </span>
    </span>
  );
};
