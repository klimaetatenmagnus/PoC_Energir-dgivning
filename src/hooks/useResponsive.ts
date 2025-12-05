import { useEffect, useState } from 'react';

/**
 * Breakpoints for responsivt design (i piksler)
 * Følger Oslo kommune Punkt designsystem:
 * https://punkt.oslo.kommune.no/latest/grunnleggende/ressurser/breakpoints/
 */
export const BREAKPOINTS = {
  phablet: 576,    // mobile → phablet (36rem)
  tablet: 768,     // phablet → tablet (48rem)
  tabletBig: 1024, // tablet → tablet-big (64rem)
  laptop: 1280,    // tablet-big → laptop (80rem)
  desktop: 1600,   // laptop → desktop (100rem)
} as const;

export interface ResponsiveState {
  /** Viewport-bredde i piksler */
  viewportWidth: number;
  /** Viewport-høyde i piksler */
  viewportHeight: number;
  /** true hvis viewport < 576px (mobile) */
  isMobile: boolean;
  /** true hvis viewport >= 576px og < 768px (phablet) */
  isPhablet: boolean;
  /** true hvis viewport >= 768px og < 1024px (tablet) */
  isTablet: boolean;
  /** true hvis viewport >= 1024px og < 1280px (tablet-big) */
  isTabletBig: boolean;
  /** true hvis viewport >= 1280px og < 1600px (laptop) */
  isLaptop: boolean;
  /** true hvis viewport >= 1600px (desktop) */
  isDesktop: boolean;
  /** true hvis viewport < 768px (brukes for betinget rendering mobil/desktop) */
  isMobileView: boolean;
}

const computeResponsiveState = (): ResponsiveState => {
  if (typeof window === 'undefined') {
    // SSR fallback - anta desktop
    return {
      viewportWidth: BREAKPOINTS.desktop,
      viewportHeight: 900,
      isMobile: false,
      isPhablet: false,
      isTablet: false,
      isTabletBig: false,
      isLaptop: false,
      isDesktop: true,
      isMobileView: false,
    };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const isMobile = viewportWidth < BREAKPOINTS.phablet;
  const isPhablet = viewportWidth >= BREAKPOINTS.phablet && viewportWidth < BREAKPOINTS.tablet;
  const isTablet = viewportWidth >= BREAKPOINTS.tablet && viewportWidth < BREAKPOINTS.tabletBig;
  const isTabletBig = viewportWidth >= BREAKPOINTS.tabletBig && viewportWidth < BREAKPOINTS.laptop;
  const isLaptop = viewportWidth >= BREAKPOINTS.laptop && viewportWidth < BREAKPOINTS.desktop;
  const isDesktop = viewportWidth >= BREAKPOINTS.desktop;
  const isMobileView = viewportWidth < BREAKPOINTS.tablet;

  return {
    viewportWidth,
    viewportHeight,
    isMobile,
    isPhablet,
    isTablet,
    isTabletBig,
    isLaptop,
    isDesktop,
    isMobileView,
  };
};

/**
 * Hook for å detektere viewport-størrelse og responsive breakpoints.
 * Følger Oslo kommune Punkt designsystem.
 *
 * Breakpoints:
 * - mobile: < 576px (små mobiler)
 * - phablet: 576-767px (store mobiler)
 * - tablet: 768-1023px (tablets)
 * - tablet-big: 1024-1279px (store tablets)
 * - laptop: 1280-1599px (laptop)
 * - desktop: >= 1600px (desktop)
 *
 * @returns ResponsiveState med viewport-dimensjoner og device-flags
 */
export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => computeResponsiveState());

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setState(computeResponsiveState());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}
