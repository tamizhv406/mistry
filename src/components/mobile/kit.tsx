import React, { useEffect, useId, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Info, Search, X } from 'lucide-react';
import { addDays, formatDayShort, todayKey } from '../../utils/datetime';

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted' | undefined;
const toneClass = (tone: Tone) => (tone ? `is-${tone}` : '');

export const Page: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  onBack?: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onBack, right, children }) => (
  <div className="m-page">
    <header className="m-page-head">
      {onBack && (
        <button type="button" className="m-icon-btn is-bordered" onClick={onBack} aria-label="Go back">
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="m-page-head-text">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </header>
    {children}
  </div>
);

export const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="m-section">
    <div className="m-section-head">
      <h2>{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  onClick?: () => void;
}> = ({ label, value, hint, tone, onClick }) => {
  const body = (
    <>
      <div className="m-stat-label">{label}</div>
      <div className={`m-stat-value ${toneClass(tone)}`}>{value}</div>
      {hint && <div className="m-stat-hint">{hint}</div>}
    </>
  );
  return onClick ? (
    <button type="button" className="m-stat" onClick={onClick}>{body}</button>
  ) : (
    <div className="m-stat">{body}</div>
  );
};

export const Badge: React.FC<{ tone?: 'ok' | 'warn' | 'bad' | 'info' | 'violet'; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`m-badge ${tone ? `is-${tone}` : ''}`}>{children}</span>
);

export const Note: React.FC<{ tone?: 'warn' | 'bad' | 'ok'; children: React.ReactNode; role?: string }> = ({ tone, children, role }) => (
  <div className={`m-note ${tone ? `is-${tone}` : ''}`} role={role}>
    <Info size={18} aria-hidden="true" />
    <div>{children}</div>
  </div>
);

export const Empty: React.FC<{ icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }> = ({ icon, title, children, action }) => (
  <div className="m-empty">
    <div className="m-empty-icon" aria-hidden="true">{icon}</div>
    <h3>{title}</h3>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export const Loading: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 10 }}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="m-skeleton" />)}
  </div>
);

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="m-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className="m-seg-btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="m-chips" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className="m-chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="m-search">
    <Search size={18} aria-hidden="true" />
    <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
  </div>
);

export const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="m-field">
    <span className="m-field-label">{label}</span>
    {children}
    {hint && <span className="m-field-hint" style={{ display: 'block' }}>{hint}</span>}
  </label>
);

/** Previous / next day with a tap-to-pick date. Never goes past today. */
export const DayBar: React.FC<{ value: string; onChange: (dayKey: string) => void }> = ({ value, onChange }) => {
  const today = todayKey();
  const rel = value === today ? 'Today' : value === addDays(today, -1) ? 'Yesterday' : 'Past date — correcting records';
  return (
    <div className="m-daybar">
      <button type="button" className="m-icon-btn" onClick={() => onChange(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft size={24} />
      </button>
      <div className="m-daybar-main">
        <span className="m-daybar-date">{formatDayShort(value)}</span>
        <span className="m-daybar-rel">{rel}</span>
        <input
          type="date"
          value={value}
          max={today}
          onChange={e => e.target.value && e.target.value <= today && onChange(e.target.value)}
          aria-label="Choose date"
        />
      </div>
      <button type="button" className="m-icon-btn" onClick={() => onChange(addDays(value, 1))} disabled={value >= today} aria-label="Next day" style={{ opacity: value >= today ? 0.3 : 1 }}>
        <ChevronRight size={24} />
      </button>
    </div>
  );
};

/**
 * Bottom sheet on phones, centred dialog on wider screens.
 * Escape and the backdrop close it; focus moves into the sheet and returns on close.
 */
export const Sheet: React.FC<{
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, title, subtitle, onClose, children, footer }) => {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="m-sheet-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="m-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="m-sheet-grip" aria-hidden="true" />
        <div className="m-sheet-head">
          <h2 id={titleId}>
            {title}
            {subtitle && <p>{subtitle}</p>}
          </h2>
          <button type="button" className="m-icon-btn" onClick={onClose} aria-label="Close">
            <X size={22} />
          </button>
        </div>
        <div className="m-sheet-body">{children}</div>
        {footer && <div className="m-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
};

export const ConfirmSheet: React.FC<{
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel, danger, busy, onConfirm, onCancel }) => (
  <Sheet
    open={open}
    title={title}
    onClose={onCancel}
    footer={
      <>
        <button type="button" className="m-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={`m-btn ${danger ? 'is-danger' : 'is-primary'}`} onClick={onConfirm} disabled={busy}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </>
    }
  >
    <div style={{ fontSize: '0.96rem', lineHeight: 1.5, color: 'var(--m-ink-2)' }}>{message}</div>
  </Sheet>
);

export const CalcLine: React.FC<{ label: React.ReactNode; value: React.ReactNode; total?: boolean; tone?: Tone }> = ({ label, value, total, tone }) => (
  <div className={`m-calc-line ${total ? 'm-calc-total' : ''}`}>
    <span>{label}</span>
    <strong className={toneClass(tone)}>{value}</strong>
  </div>
);
