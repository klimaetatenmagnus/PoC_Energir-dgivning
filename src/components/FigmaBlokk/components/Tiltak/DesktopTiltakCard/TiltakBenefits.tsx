import React from 'react';
import { BenefitChipList } from '../../../../common/BenefitChip/BenefitChip';
import type { TiltakBenefitsProps } from './types';

export const TiltakBenefits: React.FC<TiltakBenefitsProps> = ({ benefits }) => {
  if (!benefits.length) {
    return null;
  }

  return (
    <section className="desktop-tiltak-card__benefits">
      <h2 className="desktop-tiltak-card__section-title">Fordeler</h2>
      <BenefitChipList
        benefits={benefits}
        maxItems={4}
        className="desktop-tiltak-card__benefits-list"
      />
    </section>
  );
};
