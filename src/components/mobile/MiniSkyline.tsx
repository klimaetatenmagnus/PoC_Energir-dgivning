import React from 'react';
import { useSkylineLights } from '../FigmaBlokk/hooks/useSkylineLights';

interface MiniSkylineProps {
  enableLights?: boolean;
}

/**
 * MiniSkyline - Forenklet Oslo skyline for mobil
 * Bruker komplette bygninger direkte kopiert fra OsloSkyline.tsx
 * Støtter blinkende vinduer via useSkylineLights hook
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

      {/* Enebolig med skråtak (linje 149-158) - midt */}
      <g transform="translate(-100, 80) scale(1)">
        {/* Hovedhus med skråtak */}
        <path d="M320.018 271.883L350.789 302.697V352H320.018H289.248V302.697L320.018 271.883Z" fill="#D0BFAE" transform="translate(0, -272)"/>
        {/* Tilbygg */}
        <path d="M350.783 302.697H381.554V352H350.783V302.697Z" fill="#F8F0DD" transform="translate(0, -272)"/>
        {/* Tak-detalj (skygge) */}
        <path d="M350.783 302.697H381.554L350.783 271.883H320.013L350.783 302.697Z" fill="#2A2859" transform="translate(0, -272)"/>
        {/* Dør */}
        <path d="M313.862 339.674H326.17V351.999H313.862V339.674Z" fill="#2A2859" transform="translate(0, -272)"/>
      </g>

      {/* Bygning med trapp-tak (linje 188-210) - høyre */}
      <g transform="translate(-230, 7) scale(0.85)">
        <path d="M646.185 197.928V185.602H658.493V173.276H670.802V185.602H683.11V197.928H695.419V351.999H633.877V197.928H646.185Z" fill="#D0BFAE" transform="translate(0, -173)"/>
        <path d="M683.111 173.276H685.45H695.42V185.602H697.174H707.728V197.928H697.174H695.42H683.111V185.602H670.803V173.276H683.111Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M658.495 339.674H670.803V352H658.495V339.674Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M646.186 315.023H658.494V327.349H646.186V315.023Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M670.804 315.023H683.113V327.349H670.804V315.023Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M646.186 302.698H658.494V315.023H646.186V302.698Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M670.804 302.698H683.113V315.023H670.804V302.698Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M646.186 278.043H658.494V290.369H646.186V278.043Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M670.804 278.043H683.113V290.369H670.804V278.043Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M646.186 265.718H658.494V278.043H646.186V265.718Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M670.804 265.718H683.113V278.043H670.804V265.718Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M646.186 241.067H658.494V253.392H646.186V241.067Z" fill="#2A2859" transform="translate(0, -173)"/>
        <path d="M670.804 241.067H683.113V253.392H670.804V241.067Z" fill="#2A2859" transform="translate(0, -173)"/>
        {/* Mørk seksjon mellom bygninger */}
        <path d="M695.419 197.927H716.959V351.999H695.419V197.927Z" fill="#2A2859" transform="translate(0, -173)"/>
        {/* Rundt vindu/dekor */}
        <path d="M664.649 228.741C656.152 228.741 649.264 221.843 649.264 213.334C649.264 204.825 656.152 197.927 664.649 197.927C673.146 197.927 680.034 204.825 680.034 213.334C680.034 221.843 673.146 228.741 664.649 228.741Z" fill="#2A2859" transform="translate(0, -173)"/>
      </g>

      {/* Enebolig med tilbygg (linje 190-197) - helt til høyre */}
      <g transform="translate(-240, 54) scale(0.85)">
        <path d="M809.271 259.555V321.183V351.998H778.5V321.183V259.555H809.271Z" fill="#F8F0DD" transform="translate(0, -228)"/>
        <path d="M747.728 228.741L778.499 259.555V351.998H716.958V259.555L747.728 228.741Z" fill="#D0BFAE" transform="translate(0, -228)"/>
        <path d="M778.5 259.555H809.271L778.5 228.741H747.729L778.5 259.555Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M738.498 339.674H750.806V352H738.498V339.674Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M753.881 268.799H766.19V281.125H753.881V268.799Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M729.27 268.799H741.578V281.125H729.27V268.799Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M753.881 293.454H766.19V305.779H753.881V293.454Z" fill="#2A2859" transform="translate(0, -228)"/>
        <path d="M729.27 293.454H741.578V305.779H729.27V293.454Z" fill="#2A2859" transform="translate(0, -228)"/>
      </g>
    </svg>
  );
};
