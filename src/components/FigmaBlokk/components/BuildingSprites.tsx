import React from 'react';
import type { TiltakCanonicalKey } from '../utils/tiltakCanonicalKeys';

/**
 * Props for building components with embedded tiltak overlays.
 */
export interface BuildingWithTiltakProps extends React.SVGProps<SVGSVGElement> {
  /** Array of active tiltak canonical keys (e.g., ["ventilasjon", "solenergi"]) */
  activeTiltak?: TiltakCanonicalKey[];
  /** Arrow animation state: 'add' (plus), 'remove' (minus), or null */
  arrowState?: 'add' | 'remove' | null;
  /** Dynamic color for arrows based on energy rating change */
  arrowColor?: string;
}

/**
 * Enebolig illustration with 2 windows.
 * Used in both skyline animation and detail view.
 * Base illustration is consistent across both versions to ensure smooth transitions.
 */
export const EneboligSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="93"
    height="81"
    viewBox="0 0 93 81"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Right side wall */}
    <rect x="62" y="31.7" width="31" height="49.3" fill="#F8F0DD" />
    {/* Main house body */}
    <polygon points="31 0.88 0 31.7 0 81 62 81 62 31.7 31 0.88" fill="#D0BFAE" />
    {/* Roof */}
    <polygon points="62 31.7 93 31.7 62 0.88 31 0.88 62 31.7" fill="#2A2859" />
    {/* Door */}
    <rect x="24.78" y="68.67" width="12.44" height="12.33" fill="#2A2859" />
    {/* Left window */}
    <rect x="27" y="31.7" width="8.93" height="8.93" fill="#2A2859" />
    {/* Right window */}
    <rect x="73.03" y="48" width="8.93" height="17.92" fill="#2A2859" />
  </svg>
);

/**
 * Original blokk illustration used in TransitionOverlayRenderer.
 * Simple apartment block for skyline animation.
 */
export const BlokkSvg: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="136"
    height="204"
    viewBox="0 0 136 204"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {/* Roof structure - matches Blokk2LayerSvg blokk2-02 */}
    <path d="M120.744,41.319v-12.023h-12.1v-12.023h-12.544c-3.42-3.489-6.839-6.979-10.259-10.468h-35.318c3.65,3.65,7.299,7.299,10.949,10.949h12.269v11.542h12.1v12.023h11.434v12.023h34.902v-12.023h-11.434Z" fill="#2A2859"/>
    {/* Right side wall */}
    <rect x="97.276" y="53.342" width="34.902" height="145.509" fill="#F8F0DD" />
    {/* Main building body */}
    <polygon points="85.842 41.319 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.217 29.296 15.217 41.319 3.783 41.319 3.783 53.342 3.783 198.851 97.276 198.851 97.276 53.342 97.276 41.319 85.842 41.319" fill="#D0BFAE" />
    {/* Door */}
    <rect x="44.967" y="187.725" width="11.126" height="11.126" fill="#2A2859" />
    {/* Windows - row 1 (top) */}
    <rect x="21.775" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="44.967" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="68.158" y="65.034" width="11.126" height="11.126" fill="#2A2859" />
    {/* Windows - row 2 (middle) */}
    <rect x="21.775" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="44.967" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="68.158" y="88.439" width="11.126" height="11.126" fill="#2A2859" />
    {/* Windows - row 3 (bottom) */}
    <rect x="21.775" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="44.967" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
    <rect x="68.158" y="111.844" width="11.126" height="11.126" fill="#2A2859" />
  </svg>
);

/**
 * Enebolig illustration with embedded tiltak overlays and arrow indicators.
 * Used in detail view to show energy improvement measures.
 *
 * @param activeTiltak - Array of active tiltak names (e.g., ["Ventilasjon", "Solenergi"])
 * @param arrowState - Arrow animation state: 'add' (plus), 'remove' (minus), or null
 * @param arrowColor - Dynamic color for arrows based on energy rating change
 */
export const Enebolig2LayerSvg: React.FC<BuildingWithTiltakProps> = ({
  activeTiltak = [],
  arrowState = null,
  arrowColor = '#43f8b6',
  ...props
}) => (
  <svg
    className="enebolig2_layer"
    width="93"
    height="81"
    id="enebolig2_layer"
    viewBox="0 0 93 81"
    {...props}
  >
    {/* Arrow indicators - scaled by 0.6846 */}
    <polygon
      id="ARROW_ADD"
      className={`tiltak-arrow ${arrowState === 'add' ? 'tiltak-arrow--add' : ''}`}
      points="8.58 2.61 5.97 2.61 5.97 0 2.61 0 2.61 2.61 0 2.61 0 5.97 2.61 5.97 2.61 8.58 5.97 8.58 5.97 5.97 8.58 5.97 8.58 2.61"
      fill={arrowColor}
    />

    <rect
      id="ARROW_SUBTRACT"
      className={`tiltak-arrow ${arrowState === 'remove' ? 'tiltak-arrow--remove' : ''}`}
      y="2.61"
      width="8.58"
      height="3.35"
      fill={arrowColor}
    />

    {/* Base building layer - matches EneboligSvg exactly for smooth transitions */}
    <g id="blokk2-01">
      <rect x="62" y="31.7" width="31" height="49.3" fill="#f8f0dd" />
      <polygon points="31 0.88 0 31.7 0 81 62 81 62 31.7 31 0.88" fill="#d0bfae" />
      <polygon points="62 31.7 93 31.7 62 0.88 31 0.88 62 31.7" fill="#2a2959" />
      <rect x="24.78" y="68.67" width="12.44" height="12.33" fill="#2a2959" />
      <rect x="27" y="31.7" width="8.93" height="8.93" fill="#2a2959" />
      <rect x="73.03" y="48" width="8.93" height="17.92" fill="#2a2959" />
    </g>

    {/* Tiltak: Ventilasjon - scaled with y_scale=0.6299 */}
    <g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('ventilasjon') ? 'tiltak--visible' : ''}`}>
      <rect x="19.83" y="18.13" width="21.91" height="13.06" fill="#fff" />
      <path d="M40.82,18.99v11.36h-20.07v-11.36h20.07M42.67,17.28H18.9v14.77h23.77v-14.77h0Z" fill="#43f8b6" />
      <rect x="22.72" y="20.39" width="16.31" height="1.77" fill="#2a2859" />
      <rect x="22.72" y="23.89" width="16.31" height="1.77" fill="#2a2859" />
      <rect x="22.72" y="27.38" width="16.31" height="1.77" fill="#2a2859" />
    </g>

    {/* Tiltak: Solenergi - uniform scale 0.6846, positioned on roof */}
    <g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('solenergi') ? 'tiltak--visible' : ''}`}>
      <g transform="translate(5, -5)">
        <polygon points="39.84 8.51 39.84 15.51 38.06 13.78 38.06 8.51 39.84 8.51" fill="#bcbec0" />
        <polygon points="62.9 32.87 37.13 6.76 58.22 6.76 83.97 32.87 62.9 32.87" fill="#fff" />
        <path d="M57.64,8.14l23.02,23.33h-17.18L40.45,8.14h17.18M58.8,5.37h-24.98l4.66,4.73,23.02,23.33.82.83h24.98l-4.66-4.73L59.62,6.19l-.82-.83h0Z" fill="#42f8b5" />
        <polygon points="80.66 31.48 63.48 31.48 40.45 8.14 57.64 8.14 80.66 31.48" fill="#2a2859" />
        <path d="M82.65,32.32h-19.52L38.47,7.31h19.52l24.66,25.01ZM63.83,30.65h14.84l-21.38-21.67h-14.84l21.38,21.67Z" fill="#fff" />
        <rect x="48.43" y="15.13" width="16.67" height="1.67" fill="#fff" />
        <rect x="56.02" y="22.83" width="16.67" height="1.67" fill="#fff" />
        <rect x="56.81" y="3.6" width="1.67" height="32.43" transform="translate(2.69 46.19) rotate(-44.61)" fill="#fff" />
        <rect x="62.65" y="3.6" width="1.67" height="32.43" transform="translate(4.37 50.29) rotate(-44.61)" fill="#fff" />
      </g>
    </g>

    {/* Tiltak: Isolering av kjeller og loft - adjusted to fit viewBox */}
    <g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('etterisolering-kjeller-loft') ? 'tiltak--visible' : ''}`}>
      <path d="M62,35.5L31,4.5C20.67,14.83,10.33,25.17,0,35.5v-3.8c10.33-10.33,20.67-20.67,31-31l31,31v3.8Z" fill="#42f8b5" />
      <rect x="0" y="78.22" width="24.78" height="2.78" fill="#42f8b5" />
      <rect x="37.22" y="78.22" width="55.78" height="2.78" fill="#42f8b5" />
    </g>

    {/* Tiltak: Etterisolering av yttervegg - adjusted to fit viewBox */}
    <g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('etterisolering-yttervegg') ? 'tiltak--visible' : ''}`}>
      <path d="M2.78,81H0V31.7c.93-.93,1.85-1.85,2.78-2.78v52.08Z" fill="#43f8b6" />
      <rect x="90.22" y="31.7" width="2.78" height="49.3" fill="#43f8b6" />
    </g>

    {/* Tiltak: Temperaturstyring - scaled */}
    <g className={`tiltak-shape tiltak-temperaturstyring enebolig ${activeTiltak.includes('temperaturstyring') ? 'tiltak--visible' : ''}`}>
      <path d="M66.52,2.78c1.76,0,3.18,1.7,3.18,3.81v26.46c2.72,1.22,4.61,3.95,4.61,7.12,0,4.31-3.49,7.8-7.8,7.8s-7.8-3.49-7.8-7.8c0-3.17,1.9-5.9,4.61-7.12v-2.02h0v-.93h0v-4.41h0v-.93h0v-4.41h0v-.93h0v-4.41h0v-.93h0v-4.41h0v-.93h0v-2.14c0-2.1,1.42-3.81,3.18-3.81h0M66.52,0c-3.09,0-5.64,2.61-5.93,5.94h-.03v2.78s0,.93,0,.93v2.78h0v1.63s0,.93,0,.93v2.78h0v1.63s0,.93,0,.93v2.78h0v1.63s0,.93,0,.93v2.78h0v1.63s0,.93,0,.93v.4c-2.85,1.95-4.61,5.21-4.61,8.73,0,5.83,4.74,10.57,10.57,10.57s10.57-4.74,10.57-10.57c0-3.53-1.76-6.79-4.61-8.73V6.58c0-3.63-2.67-6.58-5.96-6.58h0Z" fill="#42f8b5" />
      <path d="M63.34,33.04v-11.95h6.36v11.95c2.72,1.22,4.61,3.95,4.61,7.12,0,4.31-3.49,7.8-7.8,7.8s-7.8-3.49-7.8-7.8c0-3.17,1.9-5.9,4.61-7.12Z" fill="#ff8274" />
      <path d="M63.34,6.58c0-2.1,1.42-3.81,3.18-3.81h0c1.76,0,3.18,1.7,3.18,3.81v14.51h-6.36V6.58Z" fill="#fff" />
      <path d="M63.33,30.1h2.33c.15,0,.27.21,.27.47h0c0,.26-.12.47-.27.47h-2.33v-.93Z" fill="#2a2859" />
      <path d="M63.33,24.76h2.33c.15,0,.27.21,.27.47h0c0,.26-.12.47-.27.47h-2.33v-.93Z" fill="#2a2859" />
      <path d="M63.33,19.41h2.33c.15,0,.27.21,.27.47h0c0,.26-.12.47-.27.47h-2.33v-.93Z" fill="#2a2859" />
      <path d="M63.33,14.06h2.33c.15,0,.27.21,.27.47h0c0,.26-.12.47-.27.47h-2.33v-.93Z" fill="#2a2859" />
      <path d="M63.33,8.72h2.33c.15,0,.27.21,.27.47h0c0,.26-.12.47-.27.47h-2.33v-.93Z" fill="#2a2859" />
      <path d="M60.86,42.61c0-1.54,.71-2.8,1.59-2.8s1.59,1.25,1.59,2.8-.71,2.8-1.59,2.8-1.59-1.25-1.59-2.8Z" fill="#fff" />
    </g>

    {/* Tiltak: Tetting - adjusted to fit viewBox */}
    <g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('tetting') ? 'tiltak--visible' : ''}`}>
      <path d="M35.93,31.7v8.93h-8.93v-8.93h8.93M37.78,29.85h-12.63v12.63h12.63v-12.63h0Z" fill="#43f8b6" />
      <polygon points="37.22 66.82 24.78 66.82 22.93 66.82 22.93 68.67 22.93 81 24.78 81 24.78 68.67 37.22 68.67 37.22 81 39.06 81 39.06 68.67 39.06 66.82 37.22 66.82" fill="#43f8b6" />
      <path d="M81.96,48v17.92h-8.93V48h8.93M83.81,46.15h-12.63v21.62h12.63V46.15h0Z" fill="#43f8b6" />
    </g>

    {/* Tiltak: Oppgradering av vindu - adjusted to fit viewBox */}
    <g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('vinduer') ? 'tiltak--visible' : ''}`}>
      <path d="M36.17,31.35v9.6h-9.6v-9.6h9.6M38.01,29.5h-13.3v13.3h13.3v-13.3h0Z" fill="#43f8b6" />
      <rect x="27.68" y="32.46" width="7.38" height="3.33" fill="#6a688b" />
      <path d="M36.17,40.95h-9.6v-9.6h9.6v9.6ZM28.61,39.84h6.38v-7.38h-6.38v7.38Z" fill="#fff" />
      <path d="M82.68,47.68v19.84h-10.53V47.68h10.53M84.52,45.83h-14.23v23.54h14.23V45.83h0Z" fill="#42f8b5" />
      <rect x="73.36" y="48.9" width="8.09" height="6.92" fill="#6a688b" />
      <path d="M82.68,67.52h-10.53V47.68h10.53v19.84ZM73.36,66.3h8.09v-17.4h-8.09v17.4Z" fill="#fff" />
      <path d="M22.09,30.54c2.69-.5,3.09-.9,3.59-3.59.5,2.69.9,3.09,3.59,3.59-2.69.5-3.09.9-3.59,3.59-.5-2.69-.9-3.09-3.59-3.59Z" fill="#fff" />
      <path d="M80.25,68.94c2.69-.5,3.09-.9,3.59-3.59.5,2.69.9,3.09,3.59,3.59-2.69.5-3.09.9-3.59,3.59-.5-2.69-.9-3.09-3.59-3.59Z" fill="#fff" />
    </g>

    {/* Tiltak: Varmepumpe - adjusted to fit viewBox, positioned at bottom of house */}
    <g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('varmepumpe') ? 'tiltak--visible' : ''}`}>
      <rect x="45.42" y="66.47" width="24.42" height="14.53" fill="#43f8b6" />
      <path d="M71.23,81h-27.2v-15.91h27.2V81ZM46.82,79.34h21.65v-11.76h-21.65v11.76Z" fill="#43f8b6" />
      <path d="M74.2,74.39c-.07-2.33-2.01-4.22-4.36-4.29v.93c1.85.06,3.38,1.55,3.43,3.39.03.93-.33,1.83-1,2.52-.65.67-1.51,1.05-2.43,1.08v.93c1.17-.03,2.27-.51,3.1-1.36.84-.86,1.3-2.02,1.26-3.19Z" fill="#43f8b6" />
      <path d="M68.45,80.38v-3.7l1.34-.05c.57-.02,1.09-.25,1.49-.66.41-.42.62-.95.61-1.51-.03-1.09-.97-2-2.09-2.04l-1.34-.05v-3.7l1.43.04c3.11.08,5.62,2.56,5.71,5.63h0c.05,1.54-.56,3.08-1.66,4.21-1.08,1.11-2.52,1.74-4.05,1.78l-1.43.04Z" fill="#43f8b6" />
      <path d="M74.2,72.26c-.07-2.33-2.01-4.23-4.36-4.29v.93c1.85.06,3.38,1.55,3.43,3.39.03.93-.33,1.83-1,2.52-.65.67-1.51,1.05-2.43,1.08v.93c1.17-.03,2.27-.51,3.1-1.36.84-.86,1.3-2.02,1.26-3.19Z" fill="#43f8b6" />
      <path d="M68.45,78.25v-3.7l1.34-.05c.57-.02,1.09-.25,1.49-.66.41-.42.62-.96.61-1.51-.03-1.09-.97-2-2.09-2.04l-1.34-.05v-3.7l1.42.04c3.11.08,5.62,2.56,5.71,5.63h0c.05,1.54-.56,3.08-1.66,4.21-1.08,1.11-2.52,1.74-4.05,1.78l-1.43.04Z" fill="#43f8b6" />
      <path d="M74.2,74.39c-.07-2.33-2.01-4.22-4.36-4.29v.93c1.85.06,3.38,1.55,3.43,3.39.03.93-.33,1.83-1,2.52-.65.67-1.51,1.05-2.43,1.08v.93c1.17-.03,2.27-.51,3.1-1.36.84-.86,1.3-2.02,1.26-3.19Z" fill="#2a2859" />
      <rect x="70.38" y="72.66" width="1.6" height="1.6" fill="#43f8b6" />
      <path d="M74.2,72.26c-.07-2.33-2.01-4.23-4.36-4.29v.93c1.85.06,3.38,1.55,3.43,3.39.03.93-.33,1.83-1,2.52-.65.67-1.51,1.05-2.43,1.08v.93c1.17-.03,2.27-.51,3.1-1.36.84-.86,1.3-2.02,1.26-3.19Z" fill="#fff" />
      <rect x="63.04" y="67.73" width="5.76" height=".68" fill="#2a2859" />
      <path d="M62.76,68.68v-1.23h6.32s0,1.23,0,1.23h-6.32ZM63.31,68v.12h5.21v-.12h-5.21Z" fill="#2a2859" />
      <rect x="63.04" y="71.34" width="5.76" height=".68" fill="#2a2859" />
      <path d="M62.76,72.29v-1.23h6.32s0,1.23,0,1.23h-6.32ZM63.31,71.61v.12h5.21v-.12h-5.21Z" fill="#2a2859" />
      <rect x="63.04" y="74.95" width="5.76" height=".68" fill="#2a2859" />
      <path d="M62.76,75.9v-1.23h6.32s0,1.23,0,1.23h-6.32ZM63.31,75.22v.12h5.21v-.12h-5.21Z" fill="#2a2859" />
      <rect x="63.04" y="78.57" width="5.76" height=".68" fill="#2a2859" />
      <path d="M62.76,79.51v-1.23h6.32s0,1.23,0,1.23h-6.32ZM63.31,78.83v.12h5.21v-.12h-5.21Z" fill="#2a2859" />
      <rect x="45.42" y="66.2" width="16.58" height="14.53" transform="translate(107.42 146.93) rotate(180)" fill="#fff" />
      <circle cx="53.89" cy="73.47" r="5.6" fill="#43f8b6" />
      <path d="M54.35,68.58v4.09l3.52-2.09c-.83-1.14-2.12-1.88-3.52-2.01Z" fill="#2a2859" />
      <path d="M49.92,70.58l3.52,2.09v-4.09c-1.4.13-2.69.87-3.52,2.01Z" fill="#2a2859" />
      <path d="M49.45,75.57l3.55-2.1-3.55-2.1c-.31.65-.47,1.38-.47,2.1s.16,1.45.47,2.1Z" fill="#2a2859" />
      <path d="M58.33,71.36l-3.55,2.1,3.55,2.1c.31-.65.47-1.38.47-2.1s-.16-1.45-.47-2.1Z" fill="#2a2859" />
      <path d="M53.43,78.36v-4.09l-3.52,2.09c.83,1.14,2.12,1.87,3.52,2.01Z" fill="#2a2859" />
      <path d="M57.87,76.35l-3.52-2.09v4.09c1.4-.13,2.69-.87,3.52-2.01Z" fill="#2a2859" />
      <circle cx="53.89" cy="73.47" r="1.37" fill="#2a2859" />
    </g>
  </svg>
);

/**
 * Blokk illustration with embedded tiltak overlays and arrow indicators.
 * Used in detail view to show energy improvement measures for apartment buildings.
 *
 * @param activeTiltak - Array of active tiltak names (e.g., ["Ventilasjon", "Solenergi"])
 * @param arrowState - Arrow animation state: 'add' (plus), 'remove' (minus), or null
 * @param arrowColor - Dynamic color for arrows based on energy rating change
 */
export const Blokk2LayerSvg: React.FC<BuildingWithTiltakProps> = ({
  activeTiltak = [],
  arrowState = null,
  arrowColor = '#43f8b6',
  ...props
}) => (
  <svg
    className="blokk2_layer"
    width="136"
    height="204"
    viewBox="0 0 136 204"
    id="blokk2_layer"
    {...props}
  >
    {/* Arrow indicators */}
    <polygon
      id="ARROW_ADD"
      className={`tiltak-arrow ${arrowState === 'add' ? 'tiltak-arrow--add' : ''}`}
      points="12.53 3.816 8.714 3.816 8.714 0 3.816 0 3.816 3.816 0 3.816 0 8.714 3.816 8.714 3.816 12.53 8.714 12.53 8.714 8.714 12.53 8.714 12.53 3.816"
      fill={arrowColor}
    />

    <rect
      id="ARROW_SUBTRACT"
      className={`tiltak-arrow ${arrowState === 'remove' ? 'tiltak-arrow--remove' : ''}`}
      y="3.816"
      width="12.53"
      height="4.898"
      fill={arrowColor}
    />

    {/* Tiltak: Solenergi - layer 03 (behind main building) */}
    <g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-03 ${activeTiltak.includes('solenergi') ? 'tiltak--visible' : ''}`}>
      <polygon points="7.771 41.726 35.687 1.917 61.872 1.917 33.955 41.726 7.771 41.726" fill="#fff" />
      <path d="M58.186,3.834l-25.228,35.975H11.456L36.684,3.834h21.501M65.557,0h-30.867l-1.145,1.633L8.317,37.607l-4.232,6.035h30.867l1.145-1.633L61.325,6.035l4.232-6.035h0Z" fill="#42f8b5" />
      <polygon points="36.684 3.834 58.186 3.834 32.958 39.809 11.456 39.809 36.684 3.834" fill="#2a2959" stroke="#2a2959" strokeMiterlimit="10" strokeWidth="2.556" />
      <rect x="39.578" y="5.931" width="2.452" height="13.837" transform="translate(78.744 -6.917) rotate(135)" fill="#bcbec0" />
    </g>

    {/* Roof structure */}
    <path id="blokk2-02" d="M120.744,41.319v-12.023h-12.1v-12.023h-12.544c-3.42-3.489-6.839-6.979-10.259-10.468h-35.318c3.65,3.65,7.299,7.299,10.949,10.949h12.269v11.542h12.1v12.023h11.434v12.023h34.902v-12.023h-11.434Z" fill="#2a2959" />

    {/* Tiltak: Solenergi - layer 02 */}
    <rect x="62.858" y="2.48" width="2.452" height="15.367" transform="translate(25.957 -42.337) rotate(45)" fill="#bcbec0" className={`tiltak-shape tiltak-solenergi tiltak-solenergi-02 ${activeTiltak.includes('solenergi') ? 'tiltak--visible' : ''}`} />

    {/* Base building layer */}
    <g id="blokk2-01">
      <rect x="97.276" y="53.342" width="34.902" height="145.509" fill="#f8f0dd" />
      <polygon points="85.842 41.319 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.217 29.296 15.217 41.319 3.783 41.319 3.783 53.342 3.783 198.851 97.276 198.851 97.276 53.342 97.276 41.319 85.842 41.319" fill="#d0bfae" />
      <rect x="44.967" y="111.844" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="44.967" y="187.725" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="44.967" y="88.439" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="44.967" y="65.034" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="68.158" y="111.844" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="68.158" y="88.439" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="68.158" y="65.034" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="21.775" y="111.844" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="21.775" y="88.439" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="21.775" y="65.034" width="11.126" height="11.126" fill="#2a2959" />
      <rect x="63.66" y="186.829" width="14.57" height="3.975" transform="translate(-117.872 259.761) rotate(-90)" fill="#d0bfae" />
    </g>

    {/* Tiltak: Isolering av kjeller og loft */}
    <g className={`tiltak-shape tiltak-etterisolering_kjeller_loft ${activeTiltak.includes('etterisolering-kjeller-loft') ? 'tiltak--visible' : ''}`}>
      <polygon points="19.051 45.153 19.051 41.32 19.051 33.13 27.317 33.13 31.151 33.13 31.151 29.296 31.151 21.588 39.575 21.588 41.163 21.588 42.286 20.465 50.524 12.227 58.762 20.465 59.885 21.588 61.473 21.588 69.908 21.588 69.908 29.296 69.908 33.13 73.742 33.13 82.008 33.13 82.008 41.32 82.008 45.153 85.842 45.153 97.276 45.153 97.276 41.32 85.842 41.32 85.842 29.296 73.742 29.296 73.742 17.754 61.473 17.754 50.524 6.805 39.575 17.754 27.317 17.754 27.317 29.296 15.218 29.296 15.218 41.32 3.783 41.32 3.783 45.153 15.218 45.153 19.051 45.153" fill="#42f8b5" />
      <rect x="56.092" y="195.017" width="76.086" height="3.834" fill="#42f8b5" />
      <rect x="3.783" y="195.017" width="41.184" height="3.834" fill="#42f8b5" />
    </g>

    {/* Tiltak: Varmepumpe */}
    <g className={`tiltak-shape tiltak-varmepumpe ${activeTiltak.includes('varmepumpe') ? 'tiltak--visible' : ''}`}>
      <rect x="74.425" y="178.783" width="33.724" height="20.069" fill="#43f8b6" />
      <path d="M110.066,200.769h-37.558v-23.903h37.558v23.903ZM76.342,196.935h29.89v-16.235h-29.89v16.235Z" fill="#43f8b6" />
      <path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" />
      <path d="M106.232,198.367v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.564-.579.861-1.32.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.104l1.969.053c4.292.116,7.754,3.533,7.883,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.476,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" />
      <path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#43f8b6" />
      <path d="M106.232,195.42v-5.104l1.851-.064c.788-.027,1.498-.342,2.053-.912.563-.578.861-1.319.838-2.086-.045-1.502-1.342-2.767-2.89-2.82l-1.852-.063v-5.103l1.967.051c4.293.112,7.756,3.53,7.885,7.78h0c.064,2.133-.769,4.25-2.286,5.807-1.489,1.528-3.477,2.402-5.597,2.459l-1.969.053Z" fill="#43f8b6" />
      <path d="M114.167,190.105c-.097-3.218-2.778-5.834-6.018-5.921v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.881,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#2a2859" />
      <rect x="108.893" y="187.708" width="2.206" height="2.206" fill="#43f8b6" />
      <path d="M114.167,187.159c-.097-3.218-2.777-5.837-6.018-5.922v1.282c2.555.087,4.665,2.144,4.741,4.678.039,1.291-.452,2.528-1.381,3.481-.901.925-2.089,1.446-3.36,1.49v1.282c1.619-.044,3.131-.706,4.275-1.88,1.156-1.187,1.791-2.795,1.743-4.412Z" fill="#fff" />
      <rect x="98.754" y="180.872" width="7.957" height=".934" fill="#2a2859" />
      <path d="M98.371,182.189v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,181.255v.167h7.19v-.168h-7.19Z" fill="#2a2859" />
      <rect x="98.754" y="185.857" width="7.957" height=".934" fill="#2a2859" />
      <path d="M98.371,187.175v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,186.241v.167h7.19v-.167h-7.19Z" fill="#2a2859" />
      <rect x="98.754" y="190.843" width="7.957" height=".934" fill="#2a2859" />
      <path d="M98.371,192.161v-1.701h8.723s0,1.701,0,1.701h-8.723ZM99.138,191.227v.167h7.19v-.167h-7.19Z" fill="#2a2859" />
      <rect x="98.754" y="195.829" width="7.957" height=".934" fill="#2a2859" />
      <path d="M98.371,197.146v-1.701h8.723s0,1.7,0,1.7h-8.723ZM99.138,196.212v.167h7.19v-.168h-7.19Z" fill="#2a2859" />
      <rect x="74.425" y="178.782" width="22.892" height="20.069" transform="translate(171.741 377.633) rotate(180)" fill="#fff" />
      <circle cx="86.116" cy="188.817" r="7.737" fill="#43f8b6" />
      <path d="M86.745,182.057v5.649l4.86-2.88c-1.145-1.573-2.929-2.589-4.86-2.769Z" fill="#2a2859" />
      <path d="M80.627,184.826l4.86,2.88v-5.65c-1.931.18-3.715,1.196-4.86,2.769Z" fill="#2a2859" />
      <path d="M79.984,191.714l4.898-2.902-4.898-2.903c-.427.901-.651,1.899-.651,2.903s.225,2.001.651,2.902Z" fill="#2a2859" />
      <path d="M92.248,185.909l-4.898,2.903,4.898,2.902c.427-.901.651-1.899.651-2.902s-.225-2.001-.651-2.903Z" fill="#2a2859" />
      <path d="M85.487,195.565v-5.649l-4.86,2.88c1.145,1.573,2.929,2.589,4.86,2.769Z" fill="#2a2859" />
      <path d="M91.605,192.796l-4.86-2.88v5.649c1.931-.18,3.715-1.196,4.86-2.769Z" fill="#2a2859" />
      <circle cx="86.116" cy="188.817" r="1.885" fill="#2a2859" />
    </g>

    {/* Tiltak: Ventilasjon */}
    <g className={`tiltak-shape tiltak-ventilasjon ${activeTiltak.includes('ventilasjon') ? 'tiltak--visible' : ''}`}>
      <rect x="35.331" y="31.715" width="30.261" height="19.609" fill="#fff" />
      <path d="M64.314,32.993v17.053h-27.705v-17.053h27.705M66.87,30.437h-32.817v22.165h32.817v-22.165h0Z" fill="#43f8b6" />
      <rect x="39.327" y="35.103" width="22.519" height="2.649" fill="#2a2859" />
      <rect x="39.327" y="40.349" width="22.519" height="2.649" fill="#2a2859" />
      <rect x="39.327" y="45.596" width="22.519" height="2.649" fill="#2a2859" />
    </g>

    {/* Tiltak: Solenergi - layer 01 */}
    <g className={`tiltak-shape tiltak-solenergi tiltak-solenergi-01 ${activeTiltak.includes('solenergi') ? 'tiltak--visible' : ''}`}>
      <polygon points="98.517 41.755 64.135 1.947 95.682 1.947 130.065 41.755 98.517 41.755" fill="#fff" />
      <path d="M94.805,3.864l31.071,35.975h-26.481L68.323,3.864h26.481M96.559.03h-36.613l5.476,6.34,31.071,35.975,1.147,1.328h36.613l-5.476-6.34L97.706,1.358l-1.147-1.328h0Z" fill="#42f8b5" />
      <polygon points="125.876 39.838 99.395 39.838 68.323 3.864 94.805 3.864 125.876 39.838" fill="#2a2959" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" />
      <line x1="79.123" y1="15.919" x2="104.829" y2="15.919" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" />
      <line x1="89.37" y1="27.783" x2="115.077" y2="27.783" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" />
      <line x1="77.23" y1="4.054" x2="107.973" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" />
      <line x1="86.227" y1="4.054" x2="116.969" y2="39.648" fill="none" stroke="#fff" strokeMiterlimit="10" strokeWidth="2.556" />
    </g>

    {/* Tiltak: Etterisolering av yttervegg */}
    <g className={`tiltak-shape tiltak-etterisolering_yttervegger ${activeTiltak.includes('etterisolering-yttervegg') ? 'tiltak--visible' : ''}`}>
      <rect x="130.928" y="41.296" width="3.834" height="157.576" fill="#42f8b5" />
      <rect x=".001" y="41.296" width="3.834" height="157.578" fill="#42f8b5" />
    </g>

    {/* Tiltak: Temperaturstyring */}
    <g className={`tiltak-shape tiltak-temperaturstyring ${activeTiltak.includes('temperaturstyring') ? 'tiltak--visible' : ''}`}>
      <path d="M96.5,60.937c0-2.905,1.967-5.259,4.394-5.259h0c2.426,0,4.394,2.355,4.394,5.259v20.039h-8.787v-20.039Z" fill="#fff" />
      <path d="M100.893,55.677c2.426,0,4.394,2.355,4.394,5.259v36.534c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829v-2.782h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.088h-.001v-1.29h.001v-6.089h-.001v-1.29h.001v-2.95c0-2.905,1.967-5.259,4.394-5.259h0M100.893,51.843c-4.267,0-7.785,3.608-8.189,8.209h-.039v3.834s-.001,1.29-.001,1.29v3.834h0v2.255s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.254s0,1.29,0,1.29v3.834h0v2.255s0,1.29,0,1.29v.552c-3.937,2.69-6.373,7.19-6.373,12.06,0,8.051,6.55,14.601,14.601,14.601s14.601-6.55,14.601-14.601c0-4.87-2.436-9.37-6.374-12.06v-34.303c0-5.014-3.691-9.093-8.227-9.093h0Z" fill="#42f8b5" />
      <path d="M96.5,97.471v-16.495h8.787v16.495c3.756,1.681,6.374,5.448,6.374,9.829,0,5.947-4.821,10.767-10.767,10.767s-10.767-4.821-10.767-10.767c0-4.381,2.618-8.148,6.374-9.829Z" fill="#ff8274" />
      <path d="M96.499,93.399h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" />
      <path d="M96.499,86.021h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" />
      <path d="M96.499,78.642h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" />
      <path d="M96.499,71.264h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" />
      <path d="M96.499,63.886h3.217c.205,0,.372.289.372.645h0c0,.356-.166.645-.372.645h-3.217v-1.29Z" fill="#2a2859" />
      <path d="M93.088,110.678c0-2.133.98-3.862,2.19-3.862s2.19,1.729,2.19,3.862-.98,3.862-2.19,3.862-2.19-1.729-2.19-3.862Z" fill="#fff" />
    </g>

    {/* Tiltak: Tetting */}
    <g className={`tiltak-shape tiltak-tetting_vinduer_dorer ${activeTiltak.includes('tetting') ? 'tiltak--visible' : ''}`}>
      <path d="M56.149,111.858v11.126h-11.126v-11.126h11.126M58.705,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <polygon points="56.149 185.183 45.024 185.183 42.468 185.183 42.468 187.739 42.468 198.865 45.024 198.865 45.024 187.739 56.149 187.739 56.149 198.865 58.705 198.865 58.705 187.739 58.705 185.183 56.149 185.183" fill="#43f8b6" />
      <path d="M56.149,88.453v11.126h-11.126v-11.126h11.126M58.705,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M56.149,65.048v11.126h-11.126v-11.126h11.126M58.705,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M79.341,111.858v11.126h-11.126v-11.126h11.126M81.896,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M79.341,88.453v11.126h-11.126v-11.126h11.126M81.896,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M79.341,65.048v11.126h-11.126v-11.126h11.126M81.896,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M32.958,111.858v11.126h-11.126v-11.126h11.126M35.514,109.302h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M32.958,88.453v11.126h-11.126v-11.126h11.126M35.514,85.897h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
      <path d="M32.958,65.048v11.126h-11.126v-11.126h11.126M35.514,62.492h-16.238v16.238h16.238v-16.238h0Z" fill="#43f8b6" />
    </g>

    {/* Tiltak: Oppgradering av vindu */}
    <g className={`tiltak-shape tiltak-oppgradering_vinduer ${activeTiltak.includes('vinduer') ? 'tiltak--visible' : ''}`}>
      {/* Row 3 - bottom */}
      <path d="M80.712,111.384v13.261h-13.261v-13.261h13.261M83.268,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="68.985" y="112.917" width="10.194" height="4.596" transform="translate(148.164 230.43) rotate(180)" fill="#6a688b" />
      <path d="M67.452,124.644h13.261v-13.261h-13.261v13.261ZM79.179,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M57.516,111.384v13.261h-13.261v-13.261h13.261M60.072,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="45.788" y="112.917" width="10.194" height="4.596" transform="translate(101.77 230.43) rotate(180)" fill="#6a688b" />
      <path d="M44.255,124.644h13.261v-13.261h-13.261v13.261ZM55.982,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M34.33,111.384v13.261h-13.261v-13.261h13.261M36.886,108.828h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="22.603" y="112.917" width="10.194" height="4.596" transform="translate(55.399 230.43) rotate(180)" fill="#6a688b" />
      <path d="M21.069,124.644h13.261v-13.261h-13.261v13.261ZM32.796,123.111h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      {/* Row 2 - middle */}
      <path d="M80.707,87.978v13.261h-13.261v-13.261h13.261M83.263,85.423h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="68.98" y="89.512" width="10.194" height="4.596" transform="translate(148.153 183.62) rotate(180)" fill="#6a688b" />
      <path d="M67.446,101.239h13.261v-13.261h-13.261v13.261ZM79.173,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M57.51,87.978v13.261h-13.261v-13.261h13.261M60.066,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="45.783" y="89.512" width="10.194" height="4.596" transform="translate(101.759 183.619) rotate(180)" fill="#6a688b" />
      <path d="M44.249,101.239h13.261v-13.261h-13.261v13.261ZM55.976,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M34.324,87.978v13.261h-13.261v-13.261h13.261M36.88,85.422h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="22.597" y="89.512" width="10.194" height="4.596" transform="translate(55.388 183.62) rotate(180)" fill="#6a688b" />
      <path d="M21.064,101.239h13.261v-13.261h-13.261v13.261ZM32.791,99.706h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      {/* Row 1 - top */}
      <path d="M80.712,64.573v13.261h-13.261v-13.261h13.261M83.268,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="68.985" y="66.107" width="10.194" height="4.596" transform="translate(148.164 136.809) rotate(180)" fill="#6a688b" />
      <path d="M67.452,77.834h13.261v-13.261h-13.261v13.261ZM79.179,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M57.516,64.573v13.261h-13.261v-13.261h13.261M60.072,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="45.788" y="66.107" width="10.194" height="4.596" transform="translate(101.77 136.809) rotate(180)" fill="#6a688b" />
      <path d="M44.255,77.834h13.261v-13.261h-13.261v13.261ZM55.982,76.3h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      <path d="M34.33,64.573v13.261h-13.261v-13.261h13.261M36.886,62.017h-18.373v18.373h18.373v-18.373h0Z" fill="#43f8b6" />
      <rect x="22.603" y="66.107" width="10.194" height="4.596" transform="translate(55.399 136.809) rotate(180)" fill="#6a688b" />
      <path d="M21.069,77.834h13.261v-13.261h-13.261v13.261ZM32.796,76.301h-10.194v-10.194h10.194v10.194Z" fill="#fff" />

      {/* Sparkle decorations */}
      <path d="M11.895,63.304c5.924-1.091,6.809-1.975,7.899-7.899,1.091,5.924,1.975,6.809,7.899,7.899-5.924,1.091-6.809,1.975-7.899,7.899-1.091-5.924-1.975-6.809-7.899-7.899Z" fill="#fff" />
      <path d="M77.659,126.704c3.717-.684,4.272-1.239,4.956-4.956.684,3.717,1.239,4.272,4.956,4.956-3.717.684-4.272,1.239-4.956,4.956-.684-3.717-1.239-4.272-4.956-4.956Z" fill="#fff" />
    </g>
  </svg>
);
