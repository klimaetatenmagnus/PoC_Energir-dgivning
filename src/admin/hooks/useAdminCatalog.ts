import { useCallback, useMemo } from "react";
import type { TiltakCatalogItem, TilskuddCatalogItem } from "../../types/contentCatalog";
import {
  useTiltakCatalog,
  useTilskuddCatalog,
} from "../../hooks/contentHooks";
import type {
  AdminCatalogMetadata,
  AdminCatalogStatus,
  AdminContentItem,
  AdminMode,
} from "../types";

export function useAdminCatalog(mode: AdminMode | null): {
  items: AdminContentItem[];
  metadata: AdminCatalogMetadata | null;
  status: AdminCatalogStatus;
  error: string | null;
  reload: () => Promise<unknown> | undefined;
} {
  const tiltakCatalog = useTiltakCatalog();
  const tilskuddCatalog = useTilskuddCatalog();

  const activeCatalog =
    mode === "tiltak"
      ? tiltakCatalog
      : mode === "tilskudd"
      ? tilskuddCatalog
      : null;

  const metadata = useMemo<AdminCatalogMetadata | null>(() => {
    if (!mode) {
      return null;
    }
    const source =
      mode === "tiltak" ? tiltakCatalog.data : tilskuddCatalog.data;
    if (!source) {
      return null;
    }

    return {
      total: source.total,
      includeDrafts: source.includeDrafts,
      generatedAt: source.generatedAt,
      skippedLegacy: source.skippedLegacy,
      skippedInvalid: source.skippedInvalid,
      skippedUnpublished: source.skippedUnpublished,
    };
  }, [mode, tiltakCatalog.data, tilskuddCatalog.data]);

  const items = useMemo<AdminContentItem[]>(() => {
    if (!mode) {
      return [];
    }
    const source =
      mode === "tiltak" ? tiltakCatalog.data : tilskuddCatalog.data;
    if (!source) {
      return [];
    }

    if (mode === "tiltak") {
      return source.items.map(mapTiltakCatalogItem);
    }

    return source.items.map(mapTilskuddCatalogItem);
  }, [mode, tiltakCatalog.data, tilskuddCatalog.data]);

  const status: AdminCatalogStatus = (() => {
    if (!mode) {
      return "idle";
    }
    if (!activeCatalog) {
      return "idle";
    }

    if (!activeCatalog.data) {
      if (activeCatalog.error) {
        return "error";
      }
      if (activeCatalog.isLoading) {
        return "loading";
      }
    }

    return "ready";
  })();

  const reload = useCallback(() => {
    if (!mode || !activeCatalog) {
      return undefined;
    }
    return activeCatalog.refresh();
  }, [mode, activeCatalog]);

  const error =
    !mode || !activeCatalog?.error
      ? null
      : activeCatalog.error.message || "Kunne ikke hente katalogdata";

  return { items, metadata, status, error, reload };
}

function mapTiltakCatalogItem(
  item: TiltakCatalogItem
): AdminContentItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    updatedAt: item.updatedAt,
    updatedBy: item.updatedBy,
    status: item.status,
    changeSummary: undefined,
    grants: item.grants.length,
    buildingTypes: item.buildingTypes,
    tags: item.supportTags,
    schemaVersion: item.schemaVersion,
    audiences: item.audiences,
    variantAudiences: item.variantAudiences,
    path: item.path,
  };
}

function mapTilskuddCatalogItem(
  item: TilskuddCatalogItem
): AdminContentItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    updatedAt: item.updatedAt,
    updatedBy: item.updatedBy,
    status: item.status,
    changeSummary: undefined,
    buildingTypes: item.buildingTypes,
    tags: item.tags,
    schemaVersion: item.schemaVersion,
    audiences: item.audiences,
    appliesToTiltak: item.appliesToTiltak,
    path: item.path,
    validFrom: item.validFrom ?? undefined,
    validTo: item.validTo ?? undefined,
  };
}
