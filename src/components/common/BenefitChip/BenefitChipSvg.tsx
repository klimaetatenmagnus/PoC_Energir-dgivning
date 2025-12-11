import React from 'react';
import './BenefitChip.css';

export interface BenefitChipSvgProps {
  /** Liste med fordeler som skal vises */
  benefits: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: string;
  }>;
  /** X-posisjon i SVG */
  x: number;
  /** Y-posisjon i SVG */
  y: number;
  /** Bredde på foreignObject */
  width?: number;
  /** Maks antall fordeler (default: 4) */
  maxItems?: number;
}

/**
 * BenefitChipSvg - Wrapper for å bruke BenefitChipList inne i SVG via foreignObject
 *
 * Denne komponenten lar deg bruke den felles BenefitChipList-komponenten
 * i SVG-baserte tiltak-kort ved å wrappe den i et foreignObject.
 *
 * Fordelene rendres vertikalt med 12px mellomrom (gap).
 */
export const BenefitChipSvg: React.FC<BenefitChipSvgProps> = ({
  benefits,
  x,
  y,
  width = 220,
  maxItems = 4
}) => {
  const displayedBenefits = benefits.slice(0, maxItems);

  // Beregn høyde basert på antall fordeler (30px per chip + 12px gap)
  const chipHeight = 30;
  const gap = 12;
  const height = displayedBenefits.length * chipHeight + (displayedBenefits.length - 1) * gap;

  if (displayedBenefits.length === 0) {
    return null;
  }

  return (
    <foreignObject x={x} y={y} width={width} height={height}>
      <div
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as any)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${gap}px`
        }}
      >
        {displayedBenefits.map((benefit) => (
          <div
            key={benefit.id}
            className="benefit-chip"
            title={benefit.description}
          >
            {benefit.icon && (
              <span className="benefit-chip__icon" aria-hidden="true">
                {/* pkt-icon fungerer ikke alltid i foreignObject, så vi bruker en fallback */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {React.createElement('pkt-icon' as any, { name: benefit.icon })}
              </span>
            )}
            <span className="benefit-chip__title">{benefit.title}</span>
          </div>
        ))}
      </div>
    </foreignObject>
  );
};

export default BenefitChipSvg;
