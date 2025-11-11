import { createContext } from 'react';

export type BuildingKind = 'enebolig' | 'blokk';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

type OverlayPhase = 'idle' | 'captured' | 'animating' | 'settling';

export interface OverlayState {
  phase: OverlayPhase;
  buildingType: BuildingKind | null;
  startRect: ViewportRect | null;
  targetRect: ViewportRect | null;
}

export interface BeginTransitionPayload {
  buildingType: BuildingKind;
  startRect: ViewportRect;
}

export interface TransitionOverlayContextValue extends OverlayState {
  beginTransition: (payload: BeginTransitionPayload) => void;
  setTargetRect: (buildingType: BuildingKind, rect: ViewportRect) => void;
  markArrival: () => void;
  finalizeTransition: () => void;
  forceReset: () => void;
  isActive: boolean;
  recentlyCompleted: BuildingKind | null;
}

export const initialOverlayState: OverlayState = {
  phase: 'idle',
  buildingType: null,
  startRect: null,
  targetRect: null,
};

export const TransitionOverlayContext = createContext<TransitionOverlayContextValue | undefined>(undefined);
