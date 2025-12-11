import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  initialOverlayState,
  TransitionOverlayContext,
  type BeginTransitionPayload,
  type BuildingKind,
  type OverlayState,
  type TransitionOverlayContextValue,
  type ViewportRect,
} from './TransitionOverlayTypes';

export const TransitionOverlayProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<OverlayState>(initialOverlayState);
  const [recentlyCompleted, setRecentlyCompleted] = useState<BuildingKind | null>(null);

  const beginTransition = useCallback(({ buildingType, startRect, isMobile = false }: BeginTransitionPayload) => {
    setState({
      phase: 'captured',
      buildingType,
      startRect,
      targetRect: null,
      isMobile,
    });
    setRecentlyCompleted(null);
  }, []);

  const setTargetRect = useCallback((buildingType: BuildingKind, rect: ViewportRect) => {
    setState((previous) => {
      if (previous.phase === 'idle' || previous.buildingType !== buildingType || !previous.startRect) {
        return previous;
      }

      const hasExistingTarget = Boolean(previous.targetRect);
      const nextPhase = hasExistingTarget ? previous.phase : 'animating';

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
        isMobile: previous.isMobile,
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
