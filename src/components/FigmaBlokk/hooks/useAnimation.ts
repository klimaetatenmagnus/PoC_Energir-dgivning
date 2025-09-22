import { useEffect, useState } from 'react';
import { ANIMATION_TIMINGS, ANIMATION_TRANSFORMS, calculateBlockTransform } from '../animations';

export const useAnimation = () => {
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [blockTransform, setBlockTransform] = useState<string>(ANIMATION_TRANSFORMS.initial);
  const [showHeader, setShowHeader] = useState(false);

  useEffect(() => {
    // Start fade animation after component mounts
    const fadeTimer = setTimeout(() => {
      setFadeOpacity(0);
    }, ANIMATION_TIMINGS.fadeDelay);

    // Start block transformation after fade begins
    const transformTimer = setTimeout(() => {
      setBlockTransform(calculateBlockTransform());
    }, ANIMATION_TIMINGS.transformDelay);

    // Show header after animation completes
    const headerTimer = setTimeout(() => {
      setShowHeader(true);
    }, ANIMATION_TIMINGS.headerDelay);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(transformTimer);
      clearTimeout(headerTimer);
    };
  }, []);

  return {
    fadeOpacity,
    blockTransform,
    showHeader,
  };
};
