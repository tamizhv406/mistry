import { useEffect, useMemo, useRef, useState } from 'react';

export interface VirtualWindowOptions {
  itemCount: number;
  estimateSize: number;
  overscan?: number;
  /** Below this count every item renders directly without virtual spacers. */
  threshold?: number;
  scrollTop: number;
  viewportHeight: number;
}

export interface VirtualWindowRange {
  startIndex: number;
  endIndex: number;
  topSpacerPx: number;
  bottomSpacerPx: number;
  isVirtualized: boolean;
}

/**
 * Pure window calculation so unit tests can verify bounded DOM slices deterministically.
 */
export function computeVirtualRange(opts: VirtualWindowOptions): VirtualWindowRange {
  const {
    itemCount,
    estimateSize,
    overscan = 6,
    threshold = 30,
    scrollTop,
    viewportHeight,
  } = opts;

  if (itemCount <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      isVirtualized: false,
    };
  }

  if (itemCount <= threshold || estimateSize <= 0 || viewportHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: itemCount,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      isVirtualized: false,
    };
  }

  const safeTop = Math.max(0, scrollTop);
  const rawStart = Math.floor(safeTop / estimateSize) - overscan;
  const startIndex = Math.max(0, Math.min(itemCount - 1, rawStart));
  const visibleCount = Math.ceil(viewportHeight / estimateSize) + overscan * 2;
  const endIndex = Math.min(itemCount, startIndex + Math.max(1, visibleCount));

  return {
    startIndex,
    endIndex,
    topSpacerPx: startIndex * estimateSize,
    bottomSpacerPx: Math.max(0, (itemCount - endIndex) * estimateSize),
    isVirtualized: true,
  };
}

/**
 * Window-scroll relative virtualization hook for long lists and tables.
 * Preserves natural page scrolling on mobile (390px) and desktop without nested scroll traps.
 */
export function useVirtualWindow<T extends HTMLElement = HTMLDivElement>(params: {
  itemCount: number;
  estimateSize: number;
  overscan?: number;
  threshold?: number;
}) {
  const { itemCount, estimateSize, overscan = 6, threshold = 30 } = params;
  const containerRef = useRef<T | null>(null);
  const [scrollState, setScrollState] = useState<{ scrollTop: number; viewportHeight: number }>({
    scrollTop: 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight || 844 : 844,
  });

  const enabled = itemCount > threshold;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let rafId = 0;

    const measure = () => {
      rafId = 0;
      const el = containerRef.current;
      const vh = window.innerHeight || 844;
      if (!el) {
        setScrollState({ scrollTop: 0, viewportHeight: vh });
        return;
      }
      const rect = el.getBoundingClientRect();
      const scrollTop = Math.max(0, -rect.top);
      setScrollState(prev =>
        Math.abs(prev.scrollTop - scrollTop) < 12 && prev.viewportHeight === vh
          ? prev
          : { scrollTop, viewportHeight: vh },
      );
    };

    const onScrollOrResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [enabled, itemCount]);

  const range = useMemo(
    () =>
      computeVirtualRange({
        itemCount,
        estimateSize,
        overscan,
        threshold,
        scrollTop: scrollState.scrollTop,
        viewportHeight: scrollState.viewportHeight,
      }),
    [itemCount, estimateSize, overscan, threshold, scrollState.scrollTop, scrollState.viewportHeight],
  );

  return { containerRef, ...range };
}
