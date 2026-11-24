import React, { useState } from 'react';
import { customPhoto, materialItemIcon, toolIcon, type ItemIcon } from '../../domain/categoryIcons';
import { ICON_COMPONENTS } from './categoryIconMap';

/** Square size in px, and the icon inside it. */
const SIZES = { sm: [30, 18], md: [40, 22], lg: [64, 34], xl: [96, 48] } as const;
export type BadgeSize = keyof typeof SIZES;

interface BadgeProps {
  size?: BadgeSize;
  /** The person's own photo, if any. Old bundled stock paths are ignored. */
  photo?: string;
  className?: string;
  /** Label for screen readers; leave out when the row already names the item. */
  title?: string;
}

const Badge: React.FC<BadgeProps & { look: ItemIcon }> = ({ look, size = 'sm', photo, className = '', title }) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [box, glyph] = SIZES[size];
  const src = customPhoto(photo);
  const frame: React.CSSProperties = {
    width: box, height: box, flex: `0 0 ${box}px`, borderRadius: size === 'sm' ? 10 : 12,
    display: 'grid', placeItems: 'center', overflow: 'hidden',
  };
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const };
  if (src && failedSrc !== src) {
    return (
      <img
        className={`cat-badge cat-badge-photo ${className}`}
        src={src}
        alt={title || ''}
        aria-hidden={title ? undefined : true}
        style={{ ...frame, objectFit: 'cover', background: '#f1f5f9' }}
        onError={() => setFailedSrc(src)}
      />
    );
  }
  const Icon = ICON_COMPONENTS[look.icon];
  return (
    <span className={`cat-badge ${className}`} data-category={look.category} style={{ ...frame, background: look.bg, color: look.fg }} {...a11y}>
      <Icon size={glyph} strokeWidth={2} />
    </span>
  );
};

/** A material's icon: cement, sand, steel, bricks, electrical, plumbing, paint, or other. */
export const MaterialIcon: React.FC<BadgeProps & { category?: string; group?: string; name?: string }> = ({ category, group, name, ...rest }) => (
  <Badge look={materialItemIcon({ category, group, name })} {...rest} />
);

/** A tool's icon (in the tools colour), or the person's own photo of it. */
export const ToolIcon: React.FC<BadgeProps & { name?: string }> = ({ name, ...rest }) => (
  <Badge look={toolIcon(name)} {...rest} />
);
