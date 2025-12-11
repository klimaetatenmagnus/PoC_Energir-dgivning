import React from 'react';
import './BenefitChip.css';

/**
 * pkt-icon web component wrapper
 * Bruker React.createElement for å unngå TypeScript-feil med custom elements
 */
type PunktIconProps = React.HTMLAttributes<HTMLElement> & {
  name?: string;
};
const PunktIcon: React.FC<PunktIconProps> = (props) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pkt-icon er et webcomponent uten typings
  React.createElement('pkt-icon' as any, props);

export interface BenefitChipProps {
  /** Tittel som vises i chippen */
  title: string;
  /** Valgfri beskrivelse (vises som tooltip) */
  description?: string;
  /** Ikon-navn fra Punkt ikonbibliotek */
  icon?: string;
  /** Ekstra CSS-klasse */
  className?: string;
}

/**
 * BenefitChip - Felles komponent for fordelsbokser på tvers av tiltak
 *
 * Brukes både på desktop og mobil for konsistent visning av fordeler.
 * Stilen er definert sentralt i BenefitChip.css.
 *
 * Fordeler hentes fra dictionary (content/dictionaries/index.json) og
 * kan tilpasses per tiltak.
 */
export const BenefitChip: React.FC<BenefitChipProps> = ({
  title,
  description,
  icon,
  className = ''
}) => {
  return (
    <div
      className={`benefit-chip ${className}`.trim()}
      title={description}
    >
      {icon && (
        <span className="benefit-chip__icon" aria-hidden="true">
          <PunktIcon name={icon} />
        </span>
      )}
      <span className="benefit-chip__title">{title}</span>
    </div>
  );
};

export interface BenefitChipListProps {
  /** Liste med fordeler som skal vises */
  benefits: Array<{
    id: string;
    title: string;
    description?: string;
    icon?: string;
  }>;
  /** Maks antall fordeler som vises (default: 4) */
  maxItems?: number;
  /** Ekstra CSS-klasse for container */
  className?: string;
}

/**
 * BenefitChipList - Viser en liste med fordelsbokser
 *
 * Wrapper-komponent som rendrer flere BenefitChip-komponenter
 * med konsistent spacing og wrapping.
 */
export const BenefitChipList: React.FC<BenefitChipListProps> = ({
  benefits,
  maxItems = 4,
  className = ''
}) => {
  const displayedBenefits = benefits.slice(0, maxItems);

  if (displayedBenefits.length === 0) {
    return null;
  }

  return (
    <div className={`benefit-chip-list ${className}`.trim()}>
      {displayedBenefits.map((benefit) => (
        <BenefitChip
          key={benefit.id}
          title={benefit.title}
          description={benefit.description}
          icon={benefit.icon}
        />
      ))}
    </div>
  );
};

export default BenefitChip;
