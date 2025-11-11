import { useEffect, useState } from 'react';

export interface FigmaViewportMetrics {
  scaleFactor: number;
  verticalOffset: number;
}

export const DESIGN_WIDTH = 1728;
export const DESIGN_HEIGHT = 900;
const VIEWPORT_PADDING = 10;

export const computeFigmaViewportMetrics = (): FigmaViewportMetrics => {
  if (typeof window === 'undefined') {
    return { scaleFactor: 1, verticalOffset: 0 };
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

  return { scaleFactor, verticalOffset };
};

export function useFigmaViewportMetrics(): FigmaViewportMetrics {
  const [metrics, setMetrics] = useState<FigmaViewportMetrics>(() => computeFigmaViewportMetrics());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setMetrics(computeFigmaViewportMetrics());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return metrics;
}
