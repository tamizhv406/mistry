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
    blue: 'background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;',
    green: 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;',
    amber: 'background: #fffbeb; color: #b45309; border: 1px solid #fde68a;',
    slate: 'background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;',
    purple: 'background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff;',
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
                background: '#f1f5f9',
                color: '#4f46e5',
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
