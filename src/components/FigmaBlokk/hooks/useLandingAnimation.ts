import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLandingAnimationParams {
  durationMs: number;
  onFadeComplete: () => void;
}

export const useLandingAnimation = ({ durationMs, onFadeComplete }: UseLandingAnimationParams) => {
  const [skylineFadeOpacity, setSkylineFadeOpacity] = useState(1);
  const [headerFadeOpacity, setHeaderFadeOpacity] = useState(1);
  const fadeTimer = useRef<NodeJS.Timeout | null>(null);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimer.current) {
      clearTimeout(fadeTimer.current);
      fadeTimer.current = null;
    }
  }, []);

  const resetFade = useCallback(() => {
    clearFadeTimer();
    setSkylineFadeOpacity(1);
    setHeaderFadeOpacity(1);
  }, [clearFadeTimer]);

  /** Forward fade: opacity 1 → 0, then calls onFadeComplete after durationMs */
  const startFade = useCallback(() => {
    setSkylineFadeOpacity(0);
    setHeaderFadeOpacity(0);

    clearFadeTimer();
    fadeTimer.current = setTimeout(() => {
      fadeTimer.current = null;
      onFadeComplete();
    }, durationMs);
  }, [clearFadeTimer, durationMs, onFadeComplete]);

  /** Set opacities to 0 without starting any timer (used before mode switch on back) */
  const prepareFadeIn = useCallback(() => {
    clearFadeTimer();
    setSkylineFadeOpacity(0);
    setHeaderFadeOpacity(0);
  }, [clearFadeTimer]);

  /** Animate opacities from 0 → 1 (reverse of startFade). Uses rAF so the 0-state renders first. */
  const startFadeIn = useCallback(() => {
    requestAnimationFrame(() => {
      setSkylineFadeOpacity(1);
      setHeaderFadeOpacity(1);
    });
  }, []);

  useEffect(() => {
    return () => {
      clearFadeTimer();
    };
  }, [clearFadeTimer]);

  return {
    skylineFadeOpacity,
    headerFadeOpacity,
    startFade,
    resetFade,
    prepareFadeIn,
    startFadeIn,
  };
};
