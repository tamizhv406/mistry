import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { SITE_VISUAL } from '../../utils/constructionVisuals';
import { getCategoryFallback, type FallbackCategory } from './SafeImage';

export interface InteractiveHoverItem {
  id: string;
  title: string;
  subtitle?: string;
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
      ? 'interactive-card-image--square'
      : aspectRatio === 'wide'
      ? 'interactive-card-image--wide'
      : 'interactive-card-image--video';

  const badgeColors: Record<string, string> = {
    primary: 'is-primary',
    success: 'is-success',
    warning: 'is-warning',
    danger: 'is-danger',
    info: 'is-info',
    neutral: 'is-neutral',
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
      aria-label={`View ${item.title} details`}
      className={`interactive-card ${className}`}
    >
      <div className="interactive-card-heading">
        <motion.img
          src={hasError || !imgSrc ? fallback : imgSrc}
          alt={item.imageAlt || item.title}
          animate={{ scale: isHovered ? 1.08 : 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`interactive-card-image ${aspectClass}`}
          loading="lazy"
          onError={e => {
            if (!hasError) {
              setHasError(true);
            } else {
              e.currentTarget.src = SITE_VISUAL;
            }
          }}
        />

        <div className="interactive-card-heading-copy">
          <div className="interactive-card-title-row">
            {item.icon && <span className="interactive-card-icon">{item.icon}</span>}
            <h4 className="interactive-card-title">{item.title}</h4>
          </div>
          {item.badge && (
            <span className={`interactive-card-badge ${badgeClass}`}>{item.badge}</span>
          )}
          {item.description && <p className="interactive-card-description">{item.description}</p>}
        </div>
        <motion.span
          className="interactive-card-arrow"
          animate={{ x: isHovered ? 2 : 0, y: isHovered ? -2 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          aria-hidden="true"
        >
          <ArrowUpRight size={17} strokeWidth={2.4} />
        </motion.span>
      </div>

      <div className="interactive-card-body">
        {item.stats && item.stats.length > 0 && (
          <div className="interactive-card-stats">
            {item.stats.map((st, idx) => (
              <div
                key={idx}
                className="interactive-card-stat"
              >
                <span className="interactive-card-stat-label">{st.label}</span>
                <span
                  className="interactive-card-stat-value"
                  style={{ color: st.color || '#f8fafc' }}
                >
                  {st.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <span className="interactive-card-action">View details</span>
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
  return (
    <div className={`interactive-card-grid interactive-card-grid--${columns} ${className}`}>
      {items.map(item => (
        <InteractiveHoverCard key={item.id} item={item} />
      ))}
    </div>
  );
};
