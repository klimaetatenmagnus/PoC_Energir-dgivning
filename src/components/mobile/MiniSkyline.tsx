import React from 'react';
import { useSkylineLights } from '../FigmaBlokk/hooks/useSkylineLights';
import { EneboligSvg, BlokkSvg } from '../FigmaBlokk/components/BuildingSprites';

interface MiniSkylineProps {
  enableLights?: boolean;
}

/**
 * MiniSkyline - Forenklet Oslo skyline for mobil landing page
 * Bruker EneboligSvg og BlokkSvg fra BuildingSprites for visuell konsistens
 * med MobileEnergySolutions. De gjenbrukbare bygningene har unike ID-er
 * (mobile-anim-enebolig, mobile-anim-blokk) for fremtidig animasjonsfangst.
 * Støtter blinkende vinduer via useSkylineLights hook.
 */
export const MiniSkyline: React.FC<MiniSkylineProps> = ({ enableLights = true }) => {
  const { svgRef } = useSkylineLights({ enabled: enableLights });

  return (
    <svg
      ref={svgRef}
      className="mini-skyline"
      viewBox="-20 0 540 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      {/* Bakgrunn - grå "bakke" */}
      <rect x="-20" y="160" width="560" height="20" fill="#F7F5F0" />

      {/* Høy blokk med vinduer (linje 171-187) - venstre */}
      <g transform="translate(-70, -13) scale(0.9)">
        <path d="M190.775 173.276H252.317V351.999H190.775V173.276Z" fill="#F8F0DD" transform="translate(0, -160)"/>
        <path d="M116.927 173.276H190.777V351.999H116.927V173.276Z" fill="#D0BFAE" transform="translate(0, -160)"/>
        <path d="M147.696 339.674H160.005V352H147.696V339.674Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M160.002 293.454H172.311V305.779H160.002V293.454Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M135.387 293.454H147.695V305.779H135.387V293.454Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M160.002 268.799H172.311V281.125H160.002V268.799Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M135.387 268.799H147.695V281.125H135.387V268.799Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M160.002 244.148H172.311V256.474H160.002V244.148Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M135.387 244.148H147.695V256.474H135.387V244.148Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M160.002 219.497H172.311V231.822H160.002V219.497Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M135.387 219.497H147.695V231.822H135.387V219.497Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M160.002 194.845H172.311V207.171H160.002V194.845Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M135.387 194.845H147.695V207.171H135.387V194.845Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M215.393 305.779H227.701V330.431H215.393V305.779Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M215.393 268.799H227.701V293.45H215.393V268.799Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M215.393 231.822H227.701V256.474H215.393V231.822Z" fill="#2A2859" transform="translate(0, -160)"/>
        <path d="M215.393 194.845H227.701V219.497H215.393V194.845Z" fill="#2A2859" transform="translate(0, -160)"/>
      </g>

      {/* Enebolig med skråtak - midt (bruker gjenbrukbar komponent) */}
      <g transform="translate(190, 79)">
        <EneboligSvg id="mobile-anim-enebolig" width="93" height="81" />
      </g>

      {/* Enebolig med tilbygg - plassert FØR blokken i DOM for korrekt z-rekkefølge
          (tilbygget overlapper kun litt med blokken og skal være bak) */}
      <g transform="translate(-190, 54) scale(0.85)">
        <path d="M809.271 259.555V321.183V351.998H778.5V321.183V259.555H809.271Z" fill="#F8F0DD" transform="translate(0, -228)"/>
        <path d="M747.728 228.741L778.499 259.555V351.998H716.958V259.555L747.728 228.741Z" fill="#D0BFAE" transform="translate(0, -228)"/>
        <path d="M778.5 259.555H809.271L778.5 228.741H747.729L778.5 259.555Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M738.498 339.674H750.806V352H738.498V339.674Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M753.881 268.799H766.19V281.125H753.881V268.799Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M729.27 268.799H741.578V281.125H729.27V268.799Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M753.881 293.454H766.19V305.779H753.881V293.454Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M729.27 293.454H741.578V305.779H729.27V293.454Z" fill="#2A2859" transform="translate(0, -228)"/>
      </g>

      {/* Blokk med trapp-tak - høyre (bruker gjenbrukbar komponent)
          Plassert ETTER tilbygget i DOM så den rendres foran */}
      <g transform="translate(305, 10.9)">
        <BlokkSvg id="mobile-anim-blokk" width="102" height="153" />
      </g>
    </svg>
  );
};
