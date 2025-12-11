import type { TiltakContent } from '../../content/tiltak/schema';
import type { ContentDictionary, BenefitDictionaryEntry } from '../../content/dictionaries/schema';

export interface ResolvedBenefit {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

/**
 * Løser opp fordeler for et tiltak.
 * Prioriterer benefitRefs (slår opp i dictionary), faller tilbake til benefits-array.
 */
export function resolveTiltakBenefits(
  content: TiltakContent | undefined,
  dictionary: ContentDictionary | undefined,
  maxItems: number = 4
): ResolvedBenefit[] {
  if (!content) return [];

  const benefitsLookup = new Map<string, BenefitDictionaryEntry>(
    (dictionary?.benefits ?? []).map(b => [b.id, b])
  );

  // Prioritet 1: Bruk benefitRefs og slå opp i dictionary
  if (content.benefitRefs && content.benefitRefs.length > 0) {
    return content.benefitRefs.slice(0, maxItems).map((refId) => {
      const entry = benefitsLookup.get(refId);
      return {
        id: refId,
        title: entry?.title ?? refId,
        description: entry?.description,
        icon: entry?.icon
      };
    });
  }

  // Prioritet 2: Bruk benefits-array og berik med dictionary-data
  if (content.benefits && content.benefits.length > 0) {
    return content.benefits.slice(0, maxItems).map((benefit, index) => {
      const entry = benefit.id ? benefitsLookup.get(benefit.id) : undefined;
      return {
        id: benefit.id ?? `benefit-${index}`,
        title: benefit.title || entry?.title || 'Fordel',
        description: benefit.description || entry?.description,
        icon: entry?.icon ?? benefit.icon
      };
    });
  }

  return [];
}
