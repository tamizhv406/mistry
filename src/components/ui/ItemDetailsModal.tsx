import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { calculateFinancialBalance } from '../../utils/financial';
import { SafeImage, type FallbackCategory } from './SafeImage';

export interface DetailField {
  label: string;
  value: string | number | React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  color?: string;
}

export interface ModalAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'danger' | 'success' | 'amber';
}

export interface ItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  categoryBadge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  imageUrl: string;
  imageAlt?: string;
  fallbackCategory?: FallbackCategory;
  fallbackSrc?: string;
  details: DetailField[];
  financials?: {
    totalAmount: number;
    paidAmount: number;
    notes?: string;
  };
  onEdit?: () => void;
  actions?: ModalAction[];
}

export const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  categoryBadge,
  badgeVariant = 'primary',
  imageUrl,
  imageAlt,
  fallbackCategory = 'tool',
  fallbackSrc,
  details,
  financials,
  onEdit,
  actions,
}) => {
  // ESC key listener on desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Calculate 4-tier non-negative payment values strictly from DB data
  const fin = financials
    ? calculateFinancialBalance(financials.totalAmount, financials.paidAmount)
    : null;

  const badgeColors: Record<string, string> = {
    primary: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    warning: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    danger: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    info: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    neutral: 'bg-slate-700/50 text-slate-300 border-slate-600',
  };

  const badgeClass = badgeColors[badgeVariant] || badgeColors.primary;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop (Clicking outside closes modal) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window: Large Image Left, Details Right on Desktop; Stacked on Mobile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100"
          onClick={e => e.stopPropagation()}
        >
          {/* Close Button Top Right */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="absolute top-3 right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-600/80 shadow-md transition-colors"
          >
            <X size={18} />
          </button>

          {/* Left Column: Large Image Showcase (Desktop: min-w-[340px], Mobile: top banner) */}
          <div className="relative w-full md:w-5/12 bg-slate-950 flex flex-col items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
            <div className="relative w-full h-56 sm:h-72 md:h-full min-h-[240px] md:min-h-[420px] overflow-hidden flex items-center justify-center">
              <SafeImage
                src={imageUrl}
                alt={imageAlt || title}
                fallbackCategory={fallbackCategory || 'tool'}
                fallbackSrc={fallbackSrc}
                className="w-full h-full object-contain p-4 md:p-6 drop-shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none md:hidden" />
            </div>

            {categoryBadge && (
              <div className="absolute top-4 left-4 z-20">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide border shadow-md backdrop-blur-md ${badgeClass}`}
                >
                  {categoryBadge}
                </span>
              </div>
            )}
          </div>

          {/* Right Column: Information & Financials */}
          <div className="flex-1 flex flex-col justify-between p-5 sm:p-7 overflow-y-auto max-h-[65vh] md:max-h-[90vh]">
            <div className="space-y-5">
              {/* Header Title & Subtitle */}
              <div className="pr-8">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-sm font-medium text-amber-400/90 mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              {/* Universal 4-Box Payment Ribbon (Strictly Real Persistent Data) */}
              {fin && (
                <div className="rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-amber-400" />
                      Financial & Payment Status
                    </span>
                    {fin.balanceDue === 0 ? (
                      <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                        <CheckCircle2 size={13} /> Fully Settled
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1 text-[11px]">
                        <AlertCircle size={13} /> Payment Due
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Total Amount */}
                    <div className="rounded-lg bg-slate-900 px-3 py-2 border border-slate-800">
                      <span className="text-[10px] font-semibold uppercase text-slate-400">
                        Total Amount
                      </span>
                      <div className="text-sm font-extrabold text-white mt-0.5">
                        ₹{financials!.totalAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Paid */}
                    <div className="rounded-lg bg-emerald-950/40 px-3 py-2 border border-emerald-800/40">
                      <span className="text-[10px] font-semibold uppercase text-emerald-400">
                        Paid Amount
                      </span>
                      <div className="text-sm font-extrabold text-emerald-300 mt-0.5">
                        ₹{financials!.paidAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Balance Due (NO NEGATIVE NUMBER) */}
                    <div className="rounded-lg bg-rose-950/40 px-3 py-2 border border-rose-800/40">
                      <span className="text-[10px] font-semibold uppercase text-rose-400">
                        Balance Due
                      </span>
                      <div
                        className={`text-sm font-extrabold mt-0.5 ${
                          fin.balanceDue > 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        ₹{fin.balanceDue.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Extra Paid (Advance) */}
                    <div className="rounded-lg bg-sky-950/40 px-3 py-2 border border-sky-800/40">
                      <span className="text-[10px] font-semibold uppercase text-sky-400">
                        Extra Paid
                      </span>
                      <div
                        className={`text-sm font-extrabold mt-0.5 ${
                          fin.extraPaid > 0 ? 'text-sky-400' : 'text-slate-400'
                        }`}
                      >
                        ₹{fin.extraPaid.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Specifications / Attributes Grid */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Item Specifications & Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {details.map((field, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col p-2.5 rounded-lg border text-xs ${
                        field.highlight
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                          : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                        {field.icon}
                        {field.label}
                      </span>
                      <span
                        className="text-sm font-bold text-white mt-0.5 break-words"
                        style={{ color: field.color }}
                      >
                        {field.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-5 mt-5 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors shadow-sm"
                >
                  <Edit2 size={14} />
                  Edit Record
                </button>
              )}

              {actions?.map((act, idx) => {
                const variantClasses: Record<string, string> = {
                  primary:
                    'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400',
                  amber:
                    'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400',
                  success:
                    'bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-emerald-500',
                  danger:
                    'bg-rose-600 hover:bg-rose-500 text-white font-bold border-rose-500',
                  outline:
                    'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-600',
                };
                const cls = variantClasses[act.variant || 'outline'];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={act.onClick}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs border transition-colors shadow-sm ${cls}`}
                  >
                    {act.icon}
                    {act.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
