import {
  PktAlert,
  PktButton,
  PktCard,
  PktTag,
} from "@oslokommune/punkt-react";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AdminCatalogMetadata,
  AdminCatalogStatus,
  AdminContentItem,
  AdminEnvironment,
  AdminMode,
} from "../types";
import { PreviewPanel } from "./PreviewPanel";
import "./ContentList.css";

interface ContentListProps {
  mode: AdminMode;
  environment: AdminEnvironment;
  items: AdminContentItem[];
  status: AdminCatalogStatus;
  metadata: AdminCatalogMetadata | null;
  error?: string | null;
  onReload?: () => void;
  onPreview?: (item: AdminContentItem) => void;
  previewItem: AdminContentItem | null;
  previewMode: AdminMode | null;
  onClosePreview: () => void;
  onOpenBenefits?: () => void;
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

export function ContentList({
  mode,
  environment,
  items,
  status,
  metadata,
  error,
  onReload,
  onPreview,
  previewItem,
  previewMode,
  onClosePreview,
  onOpenBenefits,
}: ContentListProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [columnCount, setColumnCount] = useState(1);
  const previewIndex = useMemo(() => {
    if (!previewItem) {
      return -1;
    }
    return items.findIndex((entry) => entry.id === previewItem.id);
  }, [items, previewItem]);

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
    if (!items.length) {
      return [];
    }

    const slices: Array<{
      cards: AdminContentItem[];
      hasPreview: boolean;
    }> = [];

    for (let index = 0; index < items.length; index += chunkSize) {
      const cards = items.slice(index, index + chunkSize);
      const hasPreview =
        !!previewItem &&
        !!previewMode &&
        cards.some((card) => card.id === previewItem.id);
      slices.push({ cards, hasPreview });
    }

    return slices;
  }, [chunkSize, items, previewItem, previewMode]);

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
            <PktButton size="small" skin="primary" variant="label-only">
              Åpne
            </PktButton>
          </div>
        </footer>
      </div>
    </PktCard>
  );

  return (
    <section className="admin-content">
      <header className="admin-content__header">
        <div className="admin-content__heading">
          <div className="admin-content__heading-row">
            <h2>
              {mode === "tiltak"
                ? "Tiltak som kan redigeres"
                : "Tilskuddsordninger"}
            </h2>
            {mode === "tiltak" && (
              <PktButton
                skin="secondary"
                variant="label-only"
                onClick={() => onOpenBenefits?.()}
              >
                Rediger fordeler
              </PktButton>
            )}
          </div>
          <div className="admin-content__primary-action">
            <PktButton
              skin="primary"
              size="medium"
              variant="icon-left"
              iconName="plus-sign"
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
          Laster inn {mode === "tiltak" ? "tiltak" : "tilskudd"} fra{" "}
          {environment === "prod" ? "produksjon" : "staging"}.
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

      {environment === "prod" && (
        <PktAlert
          skin="warning"
          title="Produksjon er skrivebeskyttet"
          ariaLive="off"
        >
          Gjør endringer i staging først. Når QA er ferdig trykker du
          “Publiser til energinokkelen.no” for å sende en Cloud Build job til
          godkjenning.
        </PktAlert>
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
                    environment={environment}
                    onClose={onClosePreview}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
        {items.length === 0 && (
          <PktAlert
            className="admin-content__empty"
            skin="info"
            title="Ingen elementer matcher filtrene"
            ariaLive="off"
          >
            Ingen elementer tilgjengelig ennå.
          </PktAlert>
        )}
      </div>

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
