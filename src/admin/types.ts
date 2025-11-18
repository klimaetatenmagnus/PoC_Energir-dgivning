import type { ContentMetadata } from "../../content/schema-helpers";

export type AdminEnvironment = "staging" | "prod";

export type AdminMode = "tiltak" | "tilskudd";

export type AdminStatus =
  | "draft"
  | "in-review"
  | "published"
  | "archived";

export interface AdminContentItem {
  id: string;
  title: string;
  summary?: string;
  updatedAt: string;
  updatedBy: string;
  status: AdminStatus;
  changeSummary?: string;
  grants?: number;
  buildingTypes?: string[];
  tags?: string[];
  audiences?: string[];
  variantAudiences?: string[];
  schemaVersion?: number;
  appliesToTiltak?: string[];
  path?: string;
  validFrom?: string;
  validTo?: string;
}

export interface AdminContentGroup {
  mode: AdminMode;
  items: AdminContentItem[];
}

export type AdminDictionaryStatus = "idle" | "loading" | "ready" | "error";

export interface AdminBuildingTypeDictionaryEntry {
  id: string;
  label: string;
  description?: string;
  aliases: string[];
  internalOnly: boolean;
}

export interface AdminBenefitDictionaryEntry {
  id: string;
  title: string;
  description: string;
  icon?: string;
  tags: string[];
}

export interface AdminSupportTagDictionaryEntry {
  id: string;
  label: string;
  description?: string;
  synonyms: string[];
  category?: string;
}

export interface AdminContentDictionary {
  schemaVersion: number;
  buildingTypes: AdminBuildingTypeDictionaryEntry[];
  benefits: AdminBenefitDictionaryEntry[];
  supportTags: AdminSupportTagDictionaryEntry[];
}

export interface AdminDictionaryContextValue {
  dictionary: AdminContentDictionary | null;
  generation: string | null;
  status: AdminDictionaryStatus;
  error: string | null;
  reload: () => void;
}

export type AdminCatalogStatus = "idle" | "loading" | "ready" | "error";

export interface AdminCatalogMetadata {
  total: number;
  includeDrafts: boolean;
  generatedAt: string;
  skippedLegacy: number;
  skippedInvalid: number;
  skippedUnpublished: number;
}

export interface AdminDictionaryResponse {
  dictionary: AdminContentDictionary;
  generation: string | null;
  etag: string | null;
  schemaVersion: number;
}

export interface AdminTiltakMetadata {
  id: string;
  path: string;
  generation: string | null;
  etag: string | null;
  benefitRefs: string[];
  metadata: ContentMetadata;
}
