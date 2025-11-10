import { useEffect, useRef } from 'react';

const ACTIVE_COLOR = 'var(--pkt-color-brand-yellow-1000, #BB8A1D)';
const WINDOW_FILL = '#2A2859';
const INITIAL_ACTIVE_RATIO = 0.1;
const TOGGLE_INTERVAL_MS = 3000;
const SIZE_TOLERANCE = 1.5;
const HORIZONTAL_GAP_TOLERANCE = 3;
const VERTICAL_GAP_TOLERANCE = 3;
const COLUMN_ALIGNMENT_TOLERANCE = 1.5;
const MIN_WINDOW_SIZE = 8;
const MAX_WINDOW_SIZE = 24;
const GROUND_Y_THRESHOLD = 330;

interface WindowRect {
  element: SVGPathElement;
  x: number;
  y: number;
  width: number;
  height: number;
  originalFill: string;
  originalTransition: string;
}

interface WindowGroup {
  id: string;
  windows: WindowRect[];
}

interface UseSkylineLightsOptions {
  enabled?: boolean;
}

const parseRectFromPath = (d: string | null): { x: number; y: number; width: number; height: number } | null => {
  if (!d) {
    return null;
  }

  const numberMatches = d.match(/-?\d*\.?\d+/g);
  if (!numberMatches || numberMatches.length < 4) {
    return null;
  }

  const numericValues = numberMatches.map((value) => Number.parseFloat(value));
  const xs = numericValues.filter((_, index) => index % 2 === 0);
  const ys = numericValues.filter((_, index) => index % 2 === 1);

  if (!xs.length || !ys.length) {
    return null;
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width,
    height,
  };
};

const isSquareWindow = (rect: { width: number; height: number }) => {
  return (
    rect.width >= MIN_WINDOW_SIZE &&
    rect.width <= MAX_WINDOW_SIZE &&
    rect.height >= MIN_WINDOW_SIZE &&
    rect.height <= MAX_WINDOW_SIZE &&
    Math.abs(rect.width - rect.height) <= SIZE_TOLERANCE
  );
};

const collectWindowRects = (svgElement: SVGSVGElement): WindowRect[] => {
  const paths = Array.from(svgElement.querySelectorAll<SVGPathElement>('path'));

  return paths
    .filter((path) => path.getAttribute('fill')?.toLowerCase() === WINDOW_FILL.toLowerCase())
    .map((path) => {
      const rect = parseRectFromPath(path.getAttribute('d'));
      const originalFill = path.getAttribute('fill') ?? WINDOW_FILL;
      const originalTransition = path.style.transition ?? '';

      if (!rect) {
        return null;
      }

      return {
        element: path,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        originalFill,
        originalTransition,
      };
    })
    .filter((rect): rect is WindowRect => {
      if (!rect) {
        return false;
      }
      if (!isSquareWindow(rect)) {
        return false;
      }
      const isAboveGround = rect.y + rect.height < GROUND_Y_THRESHOLD;
      return isAboveGround;
    });
};

const ROW_TOLERANCE = 1.5;

const areAdjacent = (a: WindowRect, b: WindowRect) => {
  const similarHeight = Math.abs(a.height - b.height) <= SIZE_TOLERANCE;
  const similarWidth = Math.abs(a.width - b.width) <= SIZE_TOLERANCE;

  const horizontalGap = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const verticalGap = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));

  const rowAligned = Math.abs(a.y - b.y) <= ROW_TOLERANCE;
  const columnAligned =
    Math.abs(a.x - b.x) <= COLUMN_ALIGNMENT_TOLERANCE &&
    Math.abs(a.x + a.width - (b.x + b.width)) <= COLUMN_ALIGNMENT_TOLERANCE;

  const horizontalNeighbors = rowAligned && similarHeight && horizontalGap <= HORIZONTAL_GAP_TOLERANCE;
  const verticalNeighbors = columnAligned && similarWidth && verticalGap <= VERTICAL_GAP_TOLERANCE;

  return horizontalNeighbors || verticalNeighbors;
};

const buildWindowGroups = (windows: WindowRect[]): WindowGroup[] => {
  const groups: WindowGroup[] = [];
  const visited = new Set<WindowRect>();

  windows.forEach((windowRect) => {
    if (visited.has(windowRect)) {
      return;
    }

    const queue = [windowRect];
    const groupWindows: WindowRect[] = [];
    visited.add(windowRect);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      groupWindows.push(current);

      windows.forEach((candidate) => {
        if (visited.has(candidate)) {
          return;
        }

        if (areAdjacent(current, candidate)) {
          visited.add(candidate);
          queue.push(candidate);
        }
      });
    }

    groups.push({
      id: `skyline-window-group-${groups.length}`,
      windows: groupWindows,
    });
  });

  return groups;
};

const shuffleArray = <T,>(input: T[]): T[] => {
  const array = [...input];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
};

const applyActiveState = (groups: WindowGroup[], activeIds: Set<string>) => {
  groups.forEach((group) => {
    const isActive = activeIds.has(group.id);
    group.windows.forEach((windowRect) => {
      windowRect.element.style.transition = 'fill 1.5s ease-in-out';
      windowRect.element.style.fill = isActive ? ACTIVE_COLOR : windowRect.originalFill;
    });
  });
};

export const useSkylineLights = ({ enabled = false }: UseSkylineLightsOptions) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return;
    }

    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const windows = collectWindowRects(svgElement);
    if (!windows.length) {
      return;
    }

    const groups = buildWindowGroups(windows);
    if (!groups.length) {
      return;
    }

    const activeIds = new Set<string>();
    const initialCount = Math.max(1, Math.round(groups.length * INITIAL_ACTIVE_RATIO));
    shuffleArray(groups)
      .slice(0, initialCount)
      .forEach((group) => {
        activeIds.add(group.id);
      });

    applyActiveState(groups, activeIds);

    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let intervalId: number | undefined;
    if (!prefersReducedMotion) {
      intervalId = window.setInterval(() => {
        const randomGroup = groups[Math.floor(Math.random() * groups.length)];
        if (!randomGroup) {
          return;
        }
        if (activeIds.has(randomGroup.id)) {
          activeIds.delete(randomGroup.id);
        } else {
          activeIds.add(randomGroup.id);
        }
        applyActiveState(groups, activeIds);
      }, TOGGLE_INTERVAL_MS);
    }

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      groups.forEach((group) => {
        group.windows.forEach((windowRect) => {
          windowRect.element.style.fill = windowRect.originalFill;
          windowRect.element.style.transition = windowRect.originalTransition;
        });
      });
    };
  }, [enabled]);

  return { svgRef };
};
