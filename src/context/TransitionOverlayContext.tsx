import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type BuildingKind = 'enebolig' | 'blokk';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type OverlayPhase = 'idle' | 'captured' | 'animating' | 'settling';

interface OverlayState {
  phase: OverlayPhase;
  buildingType: BuildingKind | null;
  startRect: ViewportRect | null;
  targetRect: ViewportRect | null;
}

interface BeginTransitionPayload {
  buildingType: BuildingKind;
  startRect: ViewportRect;
}

interface TransitionOverlayContextValue extends OverlayState {
  beginTransition: (payload: BeginTransitionPayload) => void;
  setTargetRect: (buildingType: BuildingKind, rect: ViewportRect) => void;
  markArrival: () => void;
  finalizeTransition: () => void;
  forceReset: () => void;
  isActive: boolean;
  recentlyCompleted: BuildingKind | null;
}

const initialOverlayState: OverlayState = {
  phase: 'idle',
  buildingType: null,
  startRect: null,
  targetRect: null,
};

const TransitionOverlayContext = createContext<TransitionOverlayContextValue | undefined>(undefined);

export const TransitionOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OverlayState>(initialOverlayState);
  const [recentlyCompleted, setRecentlyCompleted] = useState<BuildingKind | null>(null);

  const beginTransition = useCallback(({ buildingType, startRect }: BeginTransitionPayload) => {
    setState({
      phase: 'captured',
      buildingType,
      startRect,
      targetRect: null,
    });
    setRecentlyCompleted(null);
  }, []);

  const setTargetRect = useCallback((buildingType: BuildingKind, rect: ViewportRect) => {
    setState((previous) => {
      if (previous.phase === 'idle' || previous.buildingType !== buildingType || !previous.startRect) {
        return previous;
      }

      const hasExistingTarget = Boolean(previous.targetRect);
      const nextPhase: OverlayPhase = hasExistingTarget ? previous.phase : 'animating';

      if (
        previous.targetRect &&
        Math.abs(previous.targetRect.left - rect.left) < 0.2 &&
        Math.abs(previous.targetRect.top - rect.top) < 0.2 &&
        Math.abs(previous.targetRect.width - rect.width) < 0.2 &&
        Math.abs(previous.targetRect.height - rect.height) < 0.2
      ) {
        return previous;
      }

      return {
        phase: nextPhase,
        buildingType: previous.buildingType,
        startRect: previous.startRect,
        targetRect: rect,
      };
    });
  }, []);

  const markArrival = useCallback(() => {
    setState((previous) => {
      if (previous.phase !== 'animating') {
        return previous;
      }

      return {
        ...previous,
        phase: 'settling',
      };
    });
  }, []);

  const finalizeTransition = useCallback(() => {
    setState((previous) => {
      if (previous.phase === 'idle') {
        return previous;
      }
      if (previous.buildingType) {
        setRecentlyCompleted(previous.buildingType);
      }
      return initialOverlayState;
    });
  }, []);

  useEffect(() => {
    if (!recentlyCompleted) {
      return;
    }

    const timer = window.setTimeout(() => setRecentlyCompleted(null), 600);
    return () => window.clearTimeout(timer);
  }, [recentlyCompleted]);

  const forceReset = useCallback(() => {
    setState(initialOverlayState);
    setRecentlyCompleted(null);
  }, []);

  const value = useMemo<TransitionOverlayContextValue>(() => ({
    ...state,
    beginTransition,
    setTargetRect,
    markArrival,
    finalizeTransition,
    forceReset,
    isActive: state.phase !== 'idle',
    recentlyCompleted,
  }), [state, beginTransition, setTargetRect, markArrival, finalizeTransition, forceReset, recentlyCompleted]);

  return (
    <TransitionOverlayContext.Provider value={value}>{children}</TransitionOverlayContext.Provider>
  );
};

export const useTransitionOverlay = (): TransitionOverlayContextValue => {
  const context = useContext(TransitionOverlayContext);
  if (!context) {
    throw new Error('useTransitionOverlay must be used within a TransitionOverlayProvider');
  }
  return context;
};

export const toViewportRect = (rect: DOMRect): ViewportRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});
