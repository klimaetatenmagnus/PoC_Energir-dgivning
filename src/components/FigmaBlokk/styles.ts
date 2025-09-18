// Style configurations for FigmaBlokk component

export const getAnimationStyles = (fadeOpacity: number, showHeader: boolean) => ({
  fadeAnimation: {
    opacity: fadeOpacity,
    transition: 'opacity 1.5s ease-in-out',
  },
  headerAnimation: {
    opacity: showHeader ? 1 : 0,
    transition: 'opacity 1s ease-in-out 0.5s',
  },
  blockTransformStyle: {
    transition: 'transform 2s ease-in-out',
    transformOrigin: '1100px 352px', // Base of the block building
  },
} as const);

export const getLayoutStyles = () => ({
  container: {
    background: '#034B45',
    minHeight: '100vh',
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  backButton: {
    position: 'absolute' as const,
    top: '20px',
    left: '20px',
    zIndex: 1000,
  },
  energySolutionsContainer: {
    position: 'fixed' as const,
    left: '50%',
    bottom: '55px',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
    zIndex: 1000,
    maxHeight: 'calc(100vh - 100px)',
    overflowY: 'auto' as const,
  },
  whiteInfoBox: {
    position: 'fixed' as const,
    bottom: '55px',
    zIndex: 1000,
  },
} as const);

export const getTitleStyles = () => ({
  fontFamily: 'Oslo Sans, sans-serif',
  fontWeight: 500,
  fontStyle: 'normal',
  fontSize: '24px',
  lineHeight: '36px',
  letterSpacing: '-0.2px',
  color: 'white',
} as const);

export const getButtonTextStyles = () => ({
  fontFamily: 'Oslo Sans, sans-serif',
  fontWeight: 500,
  fontStyle: 'normal',
  fontSize: '18px',
  lineHeight: '28px',
  letterSpacing: '-0.2px',
} as const);