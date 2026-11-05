import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, HelpCircle } from 'lucide-react';

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
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
  }[badgeTone];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
              {icon}
            </span>
          )}
          <div className="truncate">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
                {title}
              </h3>
              {badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyles}`}>
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-slate-400">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  unitAddon?: string;
  helpText?: string;
  error?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  unitAddon,
  helpText,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1">
      {label ? (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {helpText && (
            <span className="text-[10px] text-slate-400 flex items-center gap-1" title={helpText}>
              <HelpCircle size={11} />
            </span>
          )}
        </div>
      ) : null}

      <div className="relative flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all shadow-2xs">
        <input
          {...props}
          className={`w-full py-2 px-3 text-xs font-mono font-medium text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none ${className}`}
        />
        {unitAddon && (
          <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 select-none">
            {unitAddon}
          </span>
        )}
      </div>

      {error && <p className="text-[11px] text-rose-600 font-medium">{error}</p>}
    </div>
  );
};

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helpText?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  helpText,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {helpText && (
          <span className="text-[10px] text-slate-400" title={helpText}>
            <HelpCircle size={11} />
          </span>
        )}
      </div>

      <div className="relative">
        <select
          {...props}
          className={`w-full py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-2xs ${className}`}
        >
          {children}
        </select>
      </div>
    </div>
  );
};

export interface MaterialSummaryCardProps {
  title: string;
  quantity: string | number;
  unit: string;
  subQuantity?: string;
  ratePerUnit?: number;
  rateUnit?: string;
  totalCost?: number;
  icon?: React.ReactNode;
  tone?: 'blue' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'slate';
}

export const MaterialSummaryCard: React.FC<MaterialSummaryCardProps> = ({
  title,
  quantity,
  unit,
  subQuantity,
  ratePerUnit,
  rateUnit,
  totalCost,
  icon,
  tone = 'slate',
}) => {
  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const toneConfig = {
    blue: {
      border: 'border-blue-200 dark:border-blue-900/60',
      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
      badge: 'text-blue-700 dark:text-blue-300',
    },
    emerald: {
      border: 'border-emerald-200 dark:border-emerald-900/60',
      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
      badge: 'text-emerald-700 dark:text-emerald-300',
    },
    amber: {
      border: 'border-amber-200 dark:border-amber-900/60',
      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
      badge: 'text-amber-700 dark:text-amber-300',
    },
    indigo: {
      border: 'border-indigo-200 dark:border-indigo-900/60',
      bg: 'bg-indigo-50/50 dark:bg-indigo-950/20',
      badge: 'text-indigo-700 dark:text-indigo-300',
    },
    purple: {
      border: 'border-purple-200 dark:border-purple-900/60',
      bg: 'bg-purple-50/50 dark:bg-purple-950/20',
      badge: 'text-purple-700 dark:text-purple-300',
    },
    slate: {
      border: 'border-slate-200 dark:border-slate-800',
      bg: 'bg-slate-50/60 dark:bg-slate-800/40',
      badge: 'text-slate-700 dark:text-slate-300',
    },
  }[tone];

  return (
    <div className={`p-3.5 rounded-xl border ${toneConfig.border} ${toneConfig.bg} shadow-2xs space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${toneConfig.badge}`}>
          {icon}
          {title}
        </span>
        {ratePerUnit !== undefined && (
          <span className="text-[10px] text-slate-500 font-mono">
            @{formatINR(ratePerUnit)}/{rateUnit || unit}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {typeof quantity === 'number' ? quantity.toLocaleString() : quantity}{' '}
            <span className="text-xs font-semibold text-slate-500">{unit}</span>
          </div>
          {subQuantity && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {subQuantity}
            </p>
          )}
        </div>

        {totalCost !== undefined && (
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Subtotal</span>
            <span className="text-xs font-bold font-mono text-slate-900 dark:text-slate-100">
              {formatINR(totalCost)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
