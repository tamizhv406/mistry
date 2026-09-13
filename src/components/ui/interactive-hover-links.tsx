import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { SITE_VISUAL } from '../../utils/constructionVisuals';
import { getCategoryFallback, type FallbackCategory } from './SafeImage';

export interface InteractiveHoverItem {
  id: string;
  title: string;
  subtitle?: string;
  tamilTitle?: string;
  description?: string;
  icon?: React.ReactNode;
  imageUrl: string;
  imageAlt?: string;
  fallbackCategory?: FallbackCategory;
  fallbackSrc?: string;
  badge?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  stats?: {
    label: string;
    value: string | number;
    color?: string;
  }[];
  onClick?: () => void;
}

interface InteractiveHoverCardProps {
  item: InteractiveHoverItem;
  className?: string;
  aspectRatio?: 'video' | 'square' | 'wide';
}

/**
 * InteractiveHoverCard
 * A premium construction card with desktop hover scaling, smooth image reveal,
 * sliding arrow animation, and mobile touch support.
 */
export const InteractiveHoverCard: React.FC<InteractiveHoverCardProps> = ({
  item,
  className = '',
  aspectRatio = 'video',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgSrc, setImgSrc] = useState(item.imageUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(item.imageUrl);
    setHasError(false);
  }, [item.imageUrl]);

  const fallback = item.fallbackSrc || getCategoryFallback(item.fallbackCategory);

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'wide'
      ? 'aspect-[21/9]'
      : 'aspect-[16/10]';

  const badgeColors: Record<string, string> = {
    primary: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    warning: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    danger: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    info: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    neutral: 'bg-slate-700/50 text-slate-300 border-slate-600',
  };

  const badgeClass = badgeColors[item.badgeVariant || 'primary'] || badgeColors.primary;

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={item.onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.onClick?.();
        }
      }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 shadow-lg hover:shadow-2xl hover:border-amber-500/60 hover:shadow-amber-500/10 cursor-pointer transition-all duration-300 text-left ${className}`}
      style={{ minHeight: '260px' }}
    >
      {/* Visual Image Container */}
      <div className={`relative w-full ${aspectClass} overflow-hidden bg-slate-950 border-b border-slate-800/50`}>
        <motion.img
          src={hasError || !imgSrc ? fallback : imgSrc}
          alt={item.imageAlt || item.title}
          animate={{ scale: isHovered ? 1.08 : 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="h-full w-full object-cover object-center transition-opacity duration-300"
          loading="lazy"
          onError={e => {
            if (!hasError) {
              setHasError(true);
            } else {
              e.currentTarget.src = SITE_VISUAL;
            }
          }}
        />

        {/* Ambient Dark Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

        {/* Top Floating Badge */}
        {item.badge && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider border shadow-sm backdrop-blur-md ${badgeClass}`}
            >
              {item.badge}
            </span>
          </div>
        )}

        {/* Animated Action Arrow (Hover reveal / slide) */}
        <div className="absolute top-3 right-3 z-10">
          <motion.div
            animate={{
              x: isHovered ? 2 : 0,
              y: isHovered ? -2 : 0,
              scale: isHovered ? 1.1 : 1,
              backgroundColor: isHovered ? 'rgba(245, 158, 11, 0.95)' : 'rgba(15, 23, 42, 0.75)',
              color: isHovered ? '#0f172a' : '#f8fafc',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 shadow-md backdrop-blur-md"
          >
            <ArrowUpRight size={16} strokeWidth={2.4} />
          </motion.div>
        </div>

        {/* Icon & Title Overlay at Bottom of Image */}
        <div className="absolute bottom-3 left-3 right-3 z-10 flex items-end justify-between">
          <div className="flex items-center gap-2">
            {item.icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900/90 text-amber-400 border border-slate-700 shadow-sm backdrop-blur-sm">
                {item.icon}
              </div>
            )}
            <div>
              <h4 className="text-base font-bold text-slate-100 group-hover:text-amber-400 transition-colors drop-shadow-sm leading-tight">
                {item.title}
              </h4>
              {item.tamilTitle && (
                <span className="text-xs font-medium text-slate-400 drop-shadow-sm">
                  {item.tamilTitle}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        {/* Description / Subtitle */}
        {item.description && (
          <p className="text-xs text-slate-300/90 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}

        {/* Structured Stats Pills (e.g. Quantity, Cost, Balance) */}
        {item.stats && item.stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            {item.stats.map((st, idx) => (
              <div
                key={idx}
                className="flex flex-col rounded-lg bg-slate-900/80 px-2.5 py-1.5 border border-slate-800"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {st.label}
                </span>
                <span
                  className="text-xs font-bold tracking-tight"
                  style={{ color: st.color || '#f8fafc' }}
                >
                  {st.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Click Hint */}
        <div className="flex items-center justify-between pt-2 text-[11px] font-medium text-slate-400 group-hover:text-amber-400/90 transition-colors">
          <span>Click to view details</span>
          <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
        </div>
      </div>
    </motion.div>
  );
};

interface InteractiveHoverLinksProps {
  items: InteractiveHoverItem[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

/**
 * InteractiveHoverLinks
 * Container for multiple interactive hover items.
 */
export const InteractiveHoverLinks: React.FC<InteractiveHoverLinksProps> = ({
  items,
  columns = 3,
  className = '',
}) => {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${colClasses[columns]} gap-4 ${className}`}>
      {items.map(item => (
        <InteractiveHoverCard key={item.id} item={item} />
      ))}
    </div>
  );
};
