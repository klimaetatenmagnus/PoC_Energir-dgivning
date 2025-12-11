import type { TiltakContent } from '../../content/tiltak/schema';
import type { ContentAudience } from '../../content/schema-helpers';

export type TiltakAudience = ContentAudience;

export function applyTiltakVariant(
  content: TiltakContent | undefined,
  audience: TiltakAudience = 'standard'
): TiltakContent | undefined {
  if (!content || audience === 'standard') {
    return content;
  }

  const variant = content.variants.find((entry) => entry.audience === audience);
  if (!variant) {
    return content;
  }

  return {
    ...content,
    title: variant.title ?? content.title,
    introParagraphs: variant.introParagraphs ?? content.introParagraphs,
    buildingTypeParagraphs: variant.buildingTypeParagraphs
      ? { ...content.buildingTypeParagraphs, ...variant.buildingTypeParagraphs }
      : content.buildingTypeParagraphs,
    benefitRefs: variant.benefitRefs?.length
      ? variant.benefitRefs
      : content.benefitRefs,
    benefits: variant.benefits ?? content.benefits,
    readMore: variant.readMore ?? content.readMore,
    callsToAction: variant.callsToAction ?? content.callsToAction,
    customSections: variant.customSections ?? content.customSections,
    tabs: variant.tabs ?? content.tabs,
    accordion: variant.accordion ?? content.accordion,
    stats: variant.stats ?? content.stats,
    grants: variant.grants ?? content.grants,
    supportTags: variant.supportTags ?? content.supportTags
  };
}

export function normaliseBuildingTypeKey(buildingType?: string | null): string {
  if (!buildingType) {
    return 'default';
  }

  const normalized = buildingType.trim().toLowerCase();
  if (!normalized) {
    return 'default';
  }

  if (normalized.includes('enebolig') || normalized.includes('småhus')) {
    return 'enebolig';
  }

  if (normalized.includes('rekke')) {
    return 'rekkehus';
  }

  if (normalized.includes('tomanns')) {
    return 'tomannsbolig';
  }

  if (normalized.includes('blokk') || normalized.includes('leilig')) {
    return 'blokk';
  }

  return normalized.replace(/\s+/g, '-');
}

export function getBuildingParagraphs(
  content: Pick<TiltakContent, 'buildingTypeParagraphs'>,
  buildingType?: string | null
): string[] {
  const key = normaliseBuildingTypeKey(buildingType);
  return (
    content.buildingTypeParagraphs[key] ??
    content.buildingTypeParagraphs.default ??
    []
  );
}
