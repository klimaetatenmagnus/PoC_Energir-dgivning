import type {
  ContentAudience,
  ContentStatus
} from '../../content/schema-helpers';

export type ContentCollection = 'tiltak' | 'tilskudd';

type ContentCatalogItemBase<Type extends ContentCollection> = {
  type: Type;
  id: string;
  title: string;
  summary?: string;
  status: ContentStatus;
  updatedAt: string;
  updatedBy: string;
  audiences: ContentAudience[];
  schemaVersion: number;
  path: string;
};

export type TiltakCatalogItem = ContentCatalogItemBase<'tiltak'> & {
  grants: string[];
  supportTags: string[];
  buildingTypes: string[];
  variantAudiences: string[];
  // Synlighet-filtrering
  visibleForBuildingTypes: string[]; // Tom array = vis for ingen byggtyper
  minBuildingYear?: number; // Bygg må være eldre enn dette året
};

export type TilskuddCatalogItem = ContentCatalogItemBase<'tilskudd'> & {
  buildingTypes: string[];
  appliesToTiltak: string[];
  tags: string[];
  validFrom?: string;
  validTo?: string;
};

export type ContentCatalogItem = TiltakCatalogItem | TilskuddCatalogItem;

export type ContentCatalogResponse<
  TItem extends ContentCatalogItem = ContentCatalogItem
> = {
  collection: ContentCollection;
  generatedAt: string;
  includeDrafts: boolean;
  total: number;
  items: TItem[];
  skippedLegacy: number;
  skippedUnpublished: number;
  skippedInvalid: number;
};
