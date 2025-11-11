import { useContext } from 'react';

import { TransitionOverlayContext, type ViewportRect } from './TransitionOverlayTypes';

export const useTransitionOverlay = () => {
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
