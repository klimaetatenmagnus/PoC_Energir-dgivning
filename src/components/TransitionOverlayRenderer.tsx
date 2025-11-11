import React from 'react';
import { BlokkSvg, EneboligSvg } from './FigmaBlokk/components/BuildingSprites';
import { useTransitionOverlay } from '../context/useTransitionOverlay';

const TIMINGS = {
  enebolig: {
    duration: 2000,
    easing: 'cubic-bezier(0.28, 0.72, 0.18, 0.99)',
  },
  blokk: {
    duration: 1600,
    easing: 'cubic-bezier(0.24, 0.87, 0.27, 0.99)',
  },
} as const;

export const TransitionOverlayRenderer: React.FC = () => {
  const { phase, startRect, targetRect, buildingType, markArrival } = useTransitionOverlay();
  const [isArmed, setIsArmed] = React.useState(false);

  const hasTarget = Boolean(startRect && targetRect);
  const shouldAnimate = phase === 'animating' && hasTarget;

  React.useEffect(() => {
    if (!shouldAnimate) {
      setIsArmed(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setIsArmed(true));
    return () => window.cancelAnimationFrame(frame);
  }, [shouldAnimate]);

  if (phase === 'idle' || !startRect || !buildingType) {
    return null;
  }

  const deltaX = targetRect && startRect ? targetRect.left - startRect.left : 0;
  const deltaY = targetRect && startRect ? targetRect.top - startRect.top : 0;
  const scaleX = targetRect && startRect && startRect.width !== 0 ? targetRect.width / startRect.width : 1;
  const scaleY = targetRect && startRect && startRect.height !== 0 ? targetRect.height / startRect.height : 1;
  const BuildingComponent = buildingType === 'enebolig' ? EneboligSvg : BlokkSvg;
  const { duration, easing } = TIMINGS[buildingType];
  const finalTransform = hasTarget
    ? `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`
    : 'translate(0px, 0px) scale(1)';

  const transform = (() => {
    if (phase === 'captured' || !hasTarget) {
      return 'translate(0px, 0px) scale(1)';
    }
    if (phase === 'animating') {
      return isArmed ? finalTransform : 'translate(0px, 0px) scale(1)';
    }
    if (phase === 'settling') {
      return finalTransform;
    }
    return 'translate(0px, 0px) scale(1)';
  })();

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: `${startRect.left}px`,
        top: `${startRect.top}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        transformOrigin: 'top left',
        pointerEvents: 'none',
        zIndex: 10000,
        transform,
        transition: shouldAnimate ? `transform ${duration}ms ${easing}` : undefined,
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName === 'transform' && shouldAnimate) {
          markArrival();
        }
      }}
    >
      <BuildingComponent style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
