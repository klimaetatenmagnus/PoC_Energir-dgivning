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

  const startFade = useCallback(() => {
    setSkylineFadeOpacity(0);
    setHeaderFadeOpacity(0);

    clearFadeTimer();
    fadeTimer.current = setTimeout(() => {
      fadeTimer.current = null;
      onFadeComplete();
    }, durationMs);
  }, [clearFadeTimer, durationMs, onFadeComplete]);

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
  };
};
