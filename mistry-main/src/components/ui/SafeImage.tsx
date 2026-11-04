import React, { useState, useEffect } from 'react';
import {
  SITE_VISUAL,
  getToolVisual,
  getMaterialVisual,
  getRodVisual,
  getWorkerVisual,
  getExpenseVisual,
} from '../../utils/constructionVisuals';

export type FallbackCategory =
  | 'site'
  | 'tool'
  | 'hammer'
  | 'trowel'
  | 'brickTrowel'
  | 'shovel'
  | 'pickaxe'
  | 'crowbar'
  | 'tape'
  | 'bucket'
  | 'wheelbarrow'
  | 'ladder'
  | 'drill'
  | 'grinder'
  | 'mixer'
  | 'toolbox'
  | 'saw'
  | 'material'
  | 'cement'
  | 'sand'
  | 'msand'
  | 'bricks'
  | 'rod'
  | 'aggregate'
  | 'tea'
  | 'snacks'
  | 'juice'
  | 'food'
  | 'pooja'
  | 'electricity'
  | 'water'
  | 'other'
  | 'worker'
  | 'mistry'
  | 'periyaal'
  | 'sithaal';

export interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackCategory?: FallbackCategory;
  fallbackSrc?: string;
}

/**
 * Returns a static SVG data URI fallback based on category
 */
export function getCategoryFallback(category?: FallbackCategory): string {
  if (!category) return SITE_VISUAL;

  switch (category) {
    case 'site':
      return SITE_VISUAL;

    case 'hammer':
    case 'trowel':
    case 'brickTrowel':
    case 'shovel':
    case 'pickaxe':
    case 'crowbar':
    case 'tape':
    case 'bucket':
    case 'wheelbarrow':
    case 'ladder':
    case 'drill':
    case 'grinder':
    case 'mixer':
    case 'toolbox':
    case 'saw':
    case 'tool':
      return getToolVisual(category).imageUrl;

    case 'cement':
    case 'sand':
    case 'msand':
    case 'bricks':
    case 'aggregate':
    case 'material':
      return getMaterialVisual(category).imageUrl;

    case 'rod':
      return getRodVisual('12mm').imageUrl;

    case 'tea':
    case 'snacks':
    case 'juice':
    case 'food':
    case 'pooja':
    case 'electricity':
    case 'water':
    case 'other':
      return getExpenseVisual(category).imageUrl;

    case 'worker':
    case 'mistry':
    case 'periyaal':
    case 'sithaal':
      return getWorkerVisual(category).imageUrl;

    default:
      return SITE_VISUAL;
  }
}

/**
 * SafeImage
 * Ensures no broken image icons ever appear in the application.
 * Automatically falls back to embedded vector SVGs on missing src, network error, or invalid data.
 */
export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = 'Construction item visual',
  fallbackCategory = 'tool',
  fallbackSrc,
  className = '',
  style,
  ...props
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state if image src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const fallback = fallbackSrc || getCategoryFallback(fallbackCategory);
  const effectiveSrc = !src || hasError ? fallback : src;

  return (
    <img
      {...props}
      src={effectiveSrc}
      alt={alt}
      className={className}
      style={style}
      loading={props.loading || 'lazy'}
      onError={e => {
        if (!hasError) {
          setHasError(true);
        } else {
          // If fallback also fails for any reason, force reliable embedded site visual
          e.currentTarget.src = SITE_VISUAL;
        }
        props.onError?.(e);
      }}
    />
  );
};
