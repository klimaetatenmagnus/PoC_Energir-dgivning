import { useEffect, useState } from 'react';
import { BREAKPOINTS } from './useResponsive';

interface FigmaViewportMetrics {
  scaleFactor: number;
  verticalOffset: number;
  /** true hvis viewport < 768px - brukes for betinget rendering av mobil/desktop */
  isMobileView: boolean;
}

const DESIGN_WIDTH = 1728;
const DESIGN_HEIGHT = 900;
const VIEWPORT_PADDING = 10;

const computeMetrics = (): FigmaViewportMetrics => {
  if (typeof window === 'undefined') {
    return { scaleFactor: 1, verticalOffset: 0, isMobileView: false };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const maxWidth = Math.max(viewportWidth - VIEWPORT_PADDING, 0);
  const maxHeight = Math.max(viewportHeight - VIEWPORT_PADDING, 0);

  const scaleX = maxWidth / DESIGN_WIDTH;
  const scaleY = maxHeight / DESIGN_HEIGHT;
  const scaleFactor = Math.min(scaleX, scaleY, 1);

  const scaledHeight = DESIGN_HEIGHT * scaleFactor;
  const verticalOffset = Math.max((viewportHeight - scaledHeight) / 2, 0);

  const isMobileView = viewportWidth < BREAKPOINTS.tablet;

  return { scaleFactor, verticalOffset, isMobileView };
};

export function useFigmaViewportMetrics(): FigmaViewportMetrics {
  const [metrics, setMetrics] = useState<FigmaViewportMetrics>(() => computeMetrics());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setMetrics(computeMetrics());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return metrics;
}
