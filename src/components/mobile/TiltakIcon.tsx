import React from 'react';

/**
 * Strekikoner for tiltaksflisene, tegnet på 24×24 med samme strektykkelse.
 * Nøkkelen er tiltakets id i innholdskatalogen.
 */
const ICON_PATHS: Record<string, string> = {
  'etterisolering-kjeller-loft': 'M3 11 L12 4 L21 11 M5 10 V20 H19 V10 M9 20 V14 H15 V20',
  'etterisolering-yttervegg':
    'M3 5 H21 V19 H3 Z M3 9.7 H21 M3 14.3 H21 M9 5 V9.7 M15 9.7 V14.3 M9 14.3 V19',
  vinduer: 'M4 3 H20 V21 H4 Z M12 3 V21 M4 12 H20',
  tetting:
    'M3 8 H14 A3 3 0 1 0 11 5 M3 12 H18 A3 3 0 1 1 15 15 M3 16 H10 A2.5 2.5 0 1 1 7.5 18.5',
  varmepumpe: 'M3 6 H21 V15 H3 Z M6 12 H18 M8 18 V21 M12 18 V21 M16 18 V21',
  ventilasjon:
    'M3 12 A9 9 0 1 0 21 12 A9 9 0 1 0 3 12 Z M12 12 V5 M12 12 L18 15.5 M12 12 L6 15.5',
  temperaturstyring: 'M10 14.5 V5 A2 2 0 0 1 14 5 V14.5 A4 4 0 1 1 10 14.5 Z M12 9 V16',
  solenergi:
    'M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8 Z M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M4.9 4.9 L6.3 6.3 M17.7 17.7 L19.1 19.1 M4.9 19.1 L6.3 17.7 M17.7 6.3 L19.1 4.9',
};

// Brukes for tiltak som legges til i katalogen uten eget ikon
const FALLBACK_PATH = 'M3 11 L12 4 L21 11 M5 10 V20 H19 V10';

interface TiltakIconProps {
  tiltakId: string;
  size?: number;
  strokeWidth?: number;
}

export const TiltakIcon: React.FC<TiltakIconProps> = ({ tiltakId, size = 24, strokeWidth = 1.6 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    aria-hidden="true"
    style={{
      flex: 'none',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }}
  >
    <path d={ICON_PATHS[tiltakId] ?? FALLBACK_PATH} />
  </svg>
);
