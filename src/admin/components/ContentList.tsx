import {
  PktAlert,
  PktButton,
  PktCard,
  PktTag,
} from "@oslokommune/punkt-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AdminCatalogFilters,
  AdminCatalogMetadata,
  AdminCatalogStatus,
  AdminContentItem,
  AdminMode,
  AdminPaginationState,
  DEFAULT_CATALOG_FILTERS,
  DEFAULT_PAGINATION,
} from "../types";
import { PreviewPanel } from "./PreviewPanel";
import { CatalogFilters } from "./CatalogFilters";
import { CatalogPagination } from "./CatalogPagination";
import "./ContentList.css";

interface ContentListProps {
  mode: AdminMode;
  items: AdminContentItem[];
  status: AdminCatalogStatus;
  metadata: AdminCatalogMetadata | null;
  error?: string | null;
  onReload?: () => void;
  onPreview?: (item: AdminContentItem) => void;
  onEdit?: (item: AdminContentItem) => void;
  onCreateNew?: () => void;
  previewItem: AdminContentItem | null;
  previewMode: AdminMode | null;
  onClosePreview: () => void;
  onOpenBenefits?: () => void;
  onOpenGlossary?: () => void;
  onBack?: () => void;
}

const statusLabel: Record<string, string> = {
  "in-review": "Til gjennomgang",
  draft: "Kladd",
  published: "Publisert",
  archived: "Arkivert",
};

const statusSkin: Record<string, "yellow" | "blue" | "green" | "grey"> = {
  draft: "blue",
  "in-review": "yellow",
  published: "green",
  archived: "grey",
};

const MIN_CARD_WIDTH = 320;

function filterItems(
  items: AdminContentItem[],
  filters: AdminCatalogFilters
): AdminContentItem[] {
  return items.filter((item) => {
    // Status filter
    if (filters.status !== "all" && item.status !== filters.status) {
      return false;
    }

    // Audience filter
    if (filters.audience !== "all") {
      const audiences = item.audiences ?? [];
      const variantAudiences = item.variantAudiences ?? [];
      const allAudiences = [...audiences, ...variantAudiences];
      if (!allAudiences.includes(filters.audience)) {
        return false;
      }
    }

    // Building type filter
    if (filters.buildingType !== "all") {
      const buildingTypes = item.buildingTypes ?? [];
      if (!buildingTypes.includes(filters.buildingType)) {
        return false;
      }
    }

    // Search filter
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase().trim();
      const titleMatch = item.title.toLowerCase().includes(searchLower);
      const summaryMatch = item.summary?.toLowerCase().includes(searchLower);
      const idMatch = item.id.toLowerCase().includes(searchLower);
      if (!titleMatch && !summaryMatch && !idMatch) {
        return false;
      }
    }

    return true;
  });
}

function paginateItems(
  items: AdminContentItem[],
  pagination: AdminPaginationState
): AdminContentItem[] {
  const { page, pageSize } = pagination;
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

export function ContentList({
  mode,
  items,
  status,
  metadata,
  error,
  onReload,
  onPreview,
  onEdit,
  onCreateNew,
  previewItem,
  previewMode,
  onClosePreview,
  onOpenBenefits,
  onOpenGlossary,
  onBack,
}: ContentListProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [filters, setFilters] = useState<AdminCatalogFilters>(DEFAULT_CATALOG_FILTERS);
  const [pagination, setPagination] = useState<AdminPaginationState>(DEFAULT_PAGINATION);

  // Nullstill filtre og paginering når mode endres
  useEffect(() => {
    setFilters(DEFAULT_CATALOG_FILTERS);
    setPagination(DEFAULT_PAGINATION);
  }, [mode]);

  // Filtrer og paginer items
  const filteredItems = useMemo(
    () => filterItems(items, filters),
    [items, filters]
  );

  const paginatedItems = useMemo(
    () => paginateItems(filteredItems, pagination),
    [filteredItems, pagination]
  );

  // Nullstill til side 1 når filtre endres
  const handleFiltersChange = (newFilters: AdminCatalogFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  useEffect(() => {
    const element = gridRef.current;
    if (!element) {
      return;
    }

    const calculateColumns = () => {
      const rect = element.getBoundingClientRect();
      const styles = window.getComputedStyle(element);
      const gapValue =
        parseFloat(styles.rowGap || styles.gap || "0") || 0;
      const availableWidth = rect.width;
      if (!availableWidth) {
        setColumnCount(1);
        return;
      }
      const estimated = Math.max(
        1,
        Math.floor((availableWidth + gapValue) / (MIN_CARD_WIDTH + gapValue))
      );
      setColumnCount((prev) =>
        prev === estimated ? prev : estimated
      );
    };

    calculateColumns();
    window.addEventListener("resize", calculateColumns);
    return () => window.removeEventListener("resize", calculateColumns);
  }, []);

  const chunkSize = Math.max(columnCount, 1);

  const hasSkipped =
    metadata &&
    (metadata.skippedLegacy +
      metadata.skippedInvalid +
      metadata.skippedUnpublished >
      0);

  const rows = useMemo(() => {
    if (!paginatedItems.length) {
      return [];
    }

    const slices: Array<{
      cards: AdminContentItem[];
      hasPreview: boolean;
    }> = [];

    for (let index = 0; index < paginatedItems.length; index += chunkSize) {
      const cards = paginatedItems.slice(index, index + chunkSize);
      const hasPreview =
        !!previewItem &&
        !!previewMode &&
        cards.some((card) => card.id === previewItem.id);
      slices.push({ cards, hasPreview });
    }

    return slices;
  }, [chunkSize, paginatedItems, previewItem, previewMode]);

  const renderCard = (item: AdminContentItem) => (
    <PktCard key={item.id} className="admin-content__card" skin="outlined">
      <div className="admin-content__card-body">
        <header>
          <div>
            <h3 className="admin-content__title">{item.title}</h3>
          </div>
          <PktTag skin={statusSkin[item.status]} className="admin-content__status">
            {statusLabel[item.status] ?? item.status}
          </PktTag>
        </header>
        {item.summary?.trim() && (
          <p className="admin-content__summary">{item.summary.trim()}</p>
        )}
        <dl className="admin-content__meta">
          <div>
            <dt>Sist oppdatert</dt>
            <dd>
              {new Date(item.updatedAt).toLocaleString("nb-NO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div>
            <dt>Av</dt>
            <dd>{item.updatedBy}</dd>
          </div>
          {item.grants !== undefined && (
            <div>
              <dt>Tilskudd</dt>
              <dd>{item.grants}</dd>
            </div>
          )}
        </dl>
        <footer className="admin-content__footer">
          {item.changeSummary?.trim() && (
            <div>
              <small>{item.changeSummary.trim()}</small>
            </div>
          )}
          <div className="admin-content__footer-actions">
            <PktButton
              size="small"
              skin="secondary"
              variant="label-only"
              onClick={() => onPreview?.(item)}
            >
              Forhåndsvis
            </PktButton>
            <PktButton
              size="small"
              skin="primary"
              variant="label-only"
              onClick={() => onEdit?.(item)}
            >
              Endre
            </PktButton>
          </div>
        </footer>
      </div>
    </PktCard>
  );

  return (
    <section className="admin-content">
      <header className="admin-content__header">
        {onBack && (
          <PktButton
            skin="secondary"
            size="medium"
            variant="icon-left"
            iconName="arrow-return"
            onClick={onBack}
          >
            <span>Tilbake</span>
          </PktButton>
        )}
        <div className="admin-content__heading">
          <div className="admin-content__heading-row">
            <h2>
              {mode === "tiltak"
                ? "Tiltak som kan redigeres"
                : "Tilskuddsordninger"}
            </h2>
            {mode === "tiltak" && (
              <div className="admin-content__dictionary-buttons">
                <PktButton
                  skin="secondary"
                  variant="label-only"
                  onClick={() => onOpenBenefits?.()}
                >
                  Rediger fordeler
                </PktButton>
                <PktButton
                  skin="secondary"
                  variant="label-only"
                  onClick={() => onOpenGlossary?.()}
                >
                  Rediger ordliste
                </PktButton>
              </div>
            )}
          </div>
          <div className="admin-content__primary-action">
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="plus-sign"
              onClick={() => onCreateNew?.()}
            >
              <span>
                {mode === "tiltak" ? "Opprett tiltak" : "Opprett tilskudd"}
              </span>
            </PktButton>
          </div>
        </div>
      </header>

      {status === "loading" && (
        <PktAlert skin="info" title="Henter katalog" ariaLive="polite">
          Laster inn {mode === "tiltak" ? "tiltak" : "tilskudd"}…
        </PktAlert>
      )}

      {status === "error" && (
        <PktAlert
          skin="error"
          title="Kunne ikke hente katalogen"
          ariaLive="assertive"
        >
          <p>{error ?? "Ukjent feil ved henting av innhold."}</p>
          <PktButton
            size="small"
            skin="secondary"
            variant="label-only"
            onClick={() => onReload?.()}
          >
            Prøv igjen
          </PktButton>
        </PktAlert>
      )}

      {status === "ready" && items.length > 0 && (
        <CatalogFilters
          mode={mode}
          filters={filters}
          onChange={handleFiltersChange}
          resultCount={filteredItems.length}
          totalCount={items.length}
        />
      )}

      <div className="admin-content__grid" ref={gridRef}>
        {rows.map((row, rowIndex) => {
          const columns = Math.min(row.cards.length, chunkSize);
          return (
            <Fragment key={`row-${rowIndex}`}>
              <div
                className="admin-content__row"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(${MIN_CARD_WIDTH}px, 1fr))`,
                }}
              >
                {row.cards.map((item) => renderCard(item))}
              </div>
              {row.hasPreview && previewItem && previewMode && (
                <div className="admin-content__preview-row">
                  <PreviewPanel
                    display="inline"
                    item={previewItem}
                    mode={previewMode}
                    onClose={onClosePreview}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
        {items.length === 0 && status === "ready" && (
          <PktAlert
            className="admin-content__empty"
            skin="info"
            title="Ingen elementer"
            ariaLive="off"
          >
            Ingen {mode === "tiltak" ? "tiltak" : "tilskudd"} er tilgjengelig ennå.
          </PktAlert>
        )}
        {items.length > 0 && filteredItems.length === 0 && (
          <PktAlert
            className="admin-content__empty"
            skin="info"
            title="Ingen treff"
            ariaLive="off"
          >
            Ingen {mode === "tiltak" ? "tiltak" : "tilskudd"} matcher de valgte filtrene.
            Prøv å endre søkekriteriene.
          </PktAlert>
        )}
      </div>

      {filteredItems.length > 0 && (
        <CatalogPagination
          pagination={pagination}
          totalItems={filteredItems.length}
          onChange={setPagination}
        />
      )}

      {metadata && status !== "loading" && (
        <div className="admin-content__catalog-meta">
          <span>
            Sist generert{" "}
            {formatCatalogTimestamp(metadata.generatedAt) ?? "ukjent"} –{" "}
            {metadata.total} elementer tilgjengelig.
          </span>
          {metadata.includeDrafts && (
            <span>Inkluderer kladder (draft=1) fra staging.</span>
          )}
          {hasSkipped && (
            <span>
              Hoppet over {metadata.skippedUnpublished} upubliserte,{" "}
              {metadata.skippedLegacy} legacy og {metadata.skippedInvalid}{" "}
              ugyldige filer.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
 
function formatCatalogTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
