import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

export interface CalculatorSectionProps {
  id?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeTone?: 'blue' | 'green' | 'amber' | 'slate' | 'purple';
  children: React.ReactNode;
}

export const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  badge,
  badgeTone = 'slate',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const badgeStyles = {
    blue: 'background: var(--color-primary-soft, #FFF7ED); color: var(--color-primary-text, #9A3412); border: 1px solid var(--color-primary-border, #FDBA74);',
    green: 'background: var(--color-success-soft, #DCFCE7); color: var(--color-success-text, #166534); border: 1px solid var(--color-success-border, #86EFAC);',
    amber: 'background: var(--color-warning-soft, #FEF3C7); color: var(--color-warning-text, #92400E); border: 1px solid var(--color-warning-border, #FDE68A);',
    slate: 'background: var(--color-bg, #FAFAF9); color: var(--color-charcoal, #1F2937); border: 1px solid var(--color-border-strong, #D6D3D1);',
    purple: 'background: var(--color-charcoal-soft, #F3F4F6); color: var(--color-charcoal, #1F2937); border: 1px solid var(--color-border-strong, #D6D3D1);',
  }[badgeTone];

  return (
    <div className="bm-section-card">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bm-section-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {icon && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary-text)',
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <div style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#0f172a', letterSpacing: '0.02em' }}>
                {title}
              </h3>
              {badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 9999,
                    ...Object.fromEntries(
                      badgeStyles.split(';').filter(Boolean).map((s) => s.split(':').map((x) => x.trim()))
                    ),
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0 0' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && <div className="bm-section-body">{children}</div>}
    </div>
  );
};

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unitAddon?: string;
  helpText?: string;
  error?: string;
  containerStyle?: React.CSSProperties;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  unitAddon,
  helpText,
  error,
  className = '',
  containerStyle,
  style,
  ...props
}) => {
  return (
    <div className="bm-field-group" style={containerStyle}>
      {label ? (
        <div className="bm-field-label-row">
          <label className="bm-field-label">{label}</label>
          {helpText && (
            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }} title={helpText}>
              <HelpCircle size={11} />
            </span>
          )}
        </div>
      ) : null}

      <div className="bm-input-box">
        <input
          {...props}
          style={style}
          className={className}
        />
        {unitAddon && <span className="bm-input-addon">{unitAddon}</span>}
      </div>

      {error && <p style={{ fontSize: 11, color: '#e11d48', margin: '2px 0 0 0', fontWeight: 600 }}>{error}</p>}
    </div>
  );
};

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helpText?: string;
  containerStyle?: React.CSSProperties;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  helpText,
  children,
  className = '',
  containerStyle,
  style,
  ...props
}) => {
  return (
    <div className="bm-field-group" style={containerStyle}>
      <div className="bm-field-label-row">
        <label className="bm-field-label">{label}</label>
        {helpText && (
          <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }} title={helpText}>
            <HelpCircle size={11} />
          </span>
        )}
      </div>

      <div className="bm-input-box">
        <select
          {...props}
          style={style}
          className={className}
        >
          {children}
        </select>
      </div>
    </div>
  );
};
