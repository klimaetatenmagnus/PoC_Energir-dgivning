import { useEffect, useLayoutEffect, useRef } from 'react';

const ACTIVE_COLOR = 'var(--pkt-color-brand-yellow-1000, #BB8A1D)';
const WINDOW_FILL = '#2A2859';
const INITIAL_ACTIVE_RATIO = 0.2;
const TOGGLE_INTERVAL_MS = 3000;
const SIZE_TOLERANCE = 1.5;
const HORIZONTAL_GAP_TOLERANCE = 3;
const VERTICAL_GAP_TOLERANCE = 3;
const COLUMN_ALIGNMENT_TOLERANCE = 1.5;
const MIN_WINDOW_SIZE = 8;
const MAX_WINDOW_SIZE = 24;
const GROUND_Y_THRESHOLD = 330;
// Threshold for detecting doors at the bottom of nested SVG components (like EneboligSvg, BlokkSvg)
// Doors are typically in the bottom 15% of the component's coordinate space
const DOOR_BOTTOM_RATIO_THRESHOLD = 0.85;

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

const getParentSvgViewBox = (path: SVGPathElement): { height: number } | null => {
  // Check if the path is inside a nested SVG (like EneboligSvg or BlokkSvg)
  const parentSvg = path.closest('svg');
  if (!parentSvg) return null;

  // If the parent SVG has a viewBox, use it to determine the coordinate space
  const viewBox = parentSvg.getAttribute('viewBox');
  if (!viewBox) return null;

  const parts = viewBox.split(/\s+/).map(Number);
  if (parts.length >= 4) {
    return { height: parts[3] };
  }
  return null;
};

const isDoorInNestedSvg = (path: SVGPathElement, rect: { y: number; height: number }): boolean => {
  // Check if path is inside a nested SVG component (not the root skyline SVG)
  const parentSvg = path.closest('svg');
  const grandparentSvg = parentSvg?.parentElement?.closest('svg');

  // If there's a grandparent SVG, this path is in a nested SVG component
  if (grandparentSvg && parentSvg) {
    const viewBoxData = getParentSvgViewBox(path);
    if (viewBoxData) {
      // Check if the rect is in the bottom portion of the nested SVG
      const bottomY = rect.y + rect.height;
      const ratioFromTop = bottomY / viewBoxData.height;
      return ratioFromTop > DOOR_BOTTOM_RATIO_THRESHOLD;
    }
  }
  return false;
};

const collectWindowRects = (svgElement: SVGSVGElement): WindowRect[] => {
  const paths = Array.from(svgElement.querySelectorAll<SVGPathElement>('path'));
  const results: WindowRect[] = [];

  for (const path of paths) {
    // Only process paths with window fill color
    if (path.getAttribute('fill')?.toLowerCase() !== WINDOW_FILL.toLowerCase()) {
      continue;
    }

    const rect = parseRectFromPath(path.getAttribute('d'));
    if (!rect) {
      continue;
    }

    // Skip non-square shapes
    if (!isSquareWindow(rect)) {
      continue;
    }

    // Skip doors in nested SVG components (like EneboligSvg, BlokkSvg)
    if (isDoorInNestedSvg(path, rect)) {
      continue;
    }

    // Skip elements below ground threshold (for inline paths in root SVG)
    const isAboveGround = rect.y + rect.height < GROUND_Y_THRESHOLD;
    if (!isAboveGround) {
      continue;
    }

    const originalFill = path.getAttribute('fill') ?? WINDOW_FILL;
    const originalTransition = path.style.transition ?? '';

    results.push({
      element: path,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      originalFill,
      originalTransition,
    });
  }

  return results;
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

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const useSkylineLights = ({ enabled = false }: UseSkylineLightsOptions) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useIsomorphicLayoutEffect(() => {
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
        const toggleCountOptions = [1, 2, 3] as const;
        const desiredToggleCount =
          toggleCountOptions[Math.floor(Math.random() * toggleCountOptions.length)];
        const toggleCount = Math.min(groups.length, desiredToggleCount);
        const usedGroupIds = new Set<string>();

        // Each interval we change 1-3 unique windows, with a 50/50 chance of turning on/off per window.
        for (let index = 0; index < toggleCount; index += 1) {
          const availableActiveGroups = groups.filter(
            (group) => activeIds.has(group.id) && !usedGroupIds.has(group.id),
          );
          const availableInactiveGroups = groups.filter(
            (group) => !activeIds.has(group.id) && !usedGroupIds.has(group.id),
          );

          if (!availableActiveGroups.length && !availableInactiveGroups.length) {
            break;
          }

          let shouldTurnOn = Math.random() < 0.5;
          let candidatePool = shouldTurnOn ? availableInactiveGroups : availableActiveGroups;

          if (!candidatePool.length) {
            shouldTurnOn = !shouldTurnOn;
            candidatePool = shouldTurnOn ? availableInactiveGroups : availableActiveGroups;
          }

          if (!candidatePool.length) {
            break;
          }

          const selectedGroup = candidatePool[Math.floor(Math.random() * candidatePool.length)];
          usedGroupIds.add(selectedGroup.id);

          if (shouldTurnOn) {
            activeIds.add(selectedGroup.id);
          } else {
            activeIds.delete(selectedGroup.id);
          }
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
