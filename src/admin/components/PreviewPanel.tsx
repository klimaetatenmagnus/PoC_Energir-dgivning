import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  PktAccordion,
  PktAccordionItem,
  PktAlert,
  PktButton,
  PktModal,
  PktSelect,
  PktRadioButton,
  PktTag,
} from "@oslokommune/punkt-react";
import type { ContentAudience } from "../../../content/schema-helpers";
import { TiltakCardRenderer } from "../../components/FigmaBlokk/components/Tiltak/TiltakCardRenderer";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import {
  useContentFetchSettings,
  useTilskuddBatch,
  useTilskuddContent,
  useTiltakCatalog,
  useTiltakContent,
} from "../../hooks/contentHooks";
import type {
  AdminContentItem,
  AdminMode,
} from "../types";
import type { TilskuddContent } from "../../../content/tilskudd/schema";
import "./PreviewPanel.css";

// Import legacy tiltak content components for preview parity
import { VarmepumpeContentComponent } from "../../components/FigmaBlokk/components/Tiltak/Varmepumpe";
import { SolenergiContentComponent } from "../../components/FigmaBlokk/components/Tiltak/Solenergi";
import { TettingContentComponent } from "../../components/FigmaBlokk/components/Tiltak/Tetting";
import { TemperaturstyringContentComponent } from "../../components/FigmaBlokk/components/Tiltak/Temperaturstyring";
import { UtskiftningAvVinduContentComponent } from "../../components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu";
import { IsoleringAvKjellerOgLoftContentComponent } from "../../components/FigmaBlokk/components/Tiltak/IsoleringAvKjellerOgLoft";
import { EtterisoleringYtterveggContentComponent } from "../../components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg";
import { VentilasjonContentComponent } from "../../components/FigmaBlokk/components/Tiltak/Ventilasjon";
import type { TiltakComponentProps } from "../../components/FigmaBlokk/components/Tiltak/shared";

// Map slug to legacy component for preview parity
type LegacyTiltakComponentProps = TiltakComponentProps & { audience?: ContentAudience };
type LegacyTiltakComponent = ComponentType<LegacyTiltakComponentProps>;

const TILTAK_COMPONENT_MAP: Record<string, LegacyTiltakComponent> = {
  'varmepumpe': VarmepumpeContentComponent,
  'solenergi': SolenergiContentComponent,
  'tetting': TettingContentComponent,
  'temperaturstyring': TemperaturstyringContentComponent,
  'vinduer': UtskiftningAvVinduContentComponent,
  'etterisolering-kjeller-loft': IsoleringAvKjellerOgLoftContentComponent,
  'etterisolering-yttervegg': EtterisoleringYtterveggContentComponent,
  'ventilasjon': VentilasjonContentComponent,
};

type BuildingTypeOption = {
  id: string;
  label: string;
  description?: string;
};

type DrawerModalElement = HTMLElement & {
  showModal?: (event?: Event | null) => void;
  close?: (event?: Event) => void;
};

interface PreviewPanelProps {
  item: AdminContentItem | null;
  mode: AdminMode | null;
  onClose: () => void;
  display?: "drawer" | "inline";
}

export function PreviewPanel({
  item,
  mode,
  onClose,
  display = "drawer",
}: PreviewPanelProps) {
  const isDrawer = display === "drawer";
  const { dictionary } = useAdminDictionary();
  const { includeDrafts } = useContentFetchSettings();
  const [audience, setAudience] = useState<ContentAudience>("standard");
  const [buildingType, setBuildingType] = useState<string>("default");
  const [selectedTiltakId, setSelectedTiltakId] =
    useState<string | null>(null);
  const { data: tilskuddContent } = useTilskuddContent(
    mode === "tilskudd" ? item?.id : null
  );
  const { data: tiltakCatalog } = useTiltakCatalog();
  const modalRef = useRef<DrawerModalElement | null>(null);
  const handleModalClose = useCallback(() => {
    onClose();
  }, [onClose]);
  const setModalRef = useCallback(
    (node: DrawerModalElement | null) => {
      if (!isDrawer) {
        return;
      }
      if (modalRef.current) {
        modalRef.current.removeEventListener("close", handleModalClose);
        modalRef.current = null;
      }
      if (node) {
        node.addEventListener("close", handleModalClose);
        if (item) {
          requestAnimationFrame(() => node.showModal?.());
        }
      }
      modalRef.current = node;
    },
    [handleModalClose, isDrawer, item]
  );

  useEffect(() => {
    setAudience("standard");
    setBuildingType("default");
    setSelectedTiltakId(null);
  }, [item, mode]);

  useEffect(() => {
    if (mode !== "tilskudd") {
      return;
    }
    const applies = tilskuddContent?.appliesToTiltak ?? [];
    if (!applies.length) {
      setSelectedTiltakId(null);
      return;
    }
    setSelectedTiltakId((current) =>
      current && applies.includes(current) ? current : applies[0]
    );
  }, [mode, tilskuddContent?.appliesToTiltak]);

  const buildingTypeOptions = useMemo<BuildingTypeOption[]>(() => {
    const entries = dictionary?.buildingTypes ?? [];
    const allowed =
      mode === "tilskudd" && tilskuddContent?.buildingTypes?.length
        ? new Set(tilskuddContent.buildingTypes)
        : null;
    return [
      {
        id: "default",
        label: "Standard (fallback)",
        description: "Viser standardtekst når ingen spesifikk byggtype er valgt.",
      },
      ...entries
        .filter(
          (entry) =>
            !entry.internalOnly && (!allowed || allowed.has(entry.id))
        )
        .map((entry) => ({
          id: entry.id,
          label: entry.label,
          description: entry.description,
        })),
    ];
  }, [dictionary, mode, tilskuddContent?.buildingTypes]);

  useEffect(() => {
    if (buildingTypeOptions.every((option) => option.id !== buildingType)) {
      setBuildingType("default");
    }
  }, [buildingTypeOptions, buildingType]);

  useEffect(() => {
    if (!isDrawer) {
      return;
    }
    if (item) {
      modalRef.current?.showModal?.();
    } else {
      modalRef.current?.close?.(new Event("close"));
    }
  }, [item, isDrawer]);

  const tiltakOptions = useMemo(() => {
    if (mode !== "tilskudd") {
      return [];
    }
    const applies = tilskuddContent?.appliesToTiltak ?? [];
    if (!applies.length) {
      return [];
    }
    const katalogMap = new Map(
      (tiltakCatalog?.items ?? []).map((entry) => [entry.id, entry.title])
    );
    return applies.map((slug) => ({
      id: slug,
      label: katalogMap.get(slug) ?? slug,
    }));
  }, [mode, tilskuddContent?.appliesToTiltak, tiltakCatalog]);

  const handleTiltakOptionToggle = (
    optionId: string,
    event: SyntheticEvent<HTMLDetailsElement>
  ) => {
    if (event.currentTarget.open) {
      setSelectedTiltakId(optionId);
    } else {
      event.currentTarget.open = true;
    }
  };

  if (!item || !mode) {
    return null;
  }

  const previewContent = (
    <div className="admin-preview__content">
      <header className="admin-preview__header">
        <div>
          <p className="admin-content__eyebrow">
            {mode === "tiltak" ? "Tiltak" : "Tilskudd"}
          </p>
          <p className="admin-preview__slug">{item.id}</p>
        </div>
        <div className="admin-preview__header-tags">
          {includeDrafts && (
            <PktTag skin="yellow">Viser upubliserte endringer</PktTag>
          )}
        </div>
      </header>

      <section className="admin-preview__controls">
        {mode === "tilskudd" && (
          <div className="admin-preview__control admin-preview__control--tiltak">
            <p className="admin-preview__control-label">
              Forhåndsvis med tiltak
            </p>
            {tiltakOptions.length > 0 ? (
              <PktAccordion
                compact
                skin="borderless"
                name="preview-tilskudd-tiltak"
                className="admin-preview__list-accordion"
              >
                {tiltakOptions.map((option) => (
                  <PktAccordionItem
                    key={option.id}
                    id={`preview-tiltak-${option.id}`}
                    compact
                    name="preview-tilskudd-tiltak"
                    title={
                      <span className="admin-preview__option-title">
                        {option.label}
                        {selectedTiltakId === option.id && (
                          <PktTag skin="blue">Valgt</PktTag>
                        )}
                      </span>
                    }
                    isOpen={selectedTiltakId === option.id}
                    onToggle={(event) =>
                      handleTiltakOptionToggle(option.id, event)
                    }
                  >
                    <p className="admin-preview__option-helper">
                      Viser hvordan tilskuddet rendres sammen med{" "}
                      {option.label}.
                    </p>
                  </PktAccordionItem>
                ))}
              </PktAccordion>
            ) : (
              <PktAlert
                skin="warning"
                title="Ingen tilknyttede tiltak"
                ariaLive="polite"
              >
                Legg ID-er i `appliesToTiltak` for å simulere hvordan
                ordningen vises sammen med et tiltak.
              </PktAlert>
            )}
          </div>
        )}

        {mode === "tiltak" && (
          <div className="admin-preview__control admin-preview__control--variant">
            <p className="admin-preview__control-label">Variant</p>
            <div className="admin-preview__radio-group">
              <PktRadioButton
                id="preview-variant-standard"
                name="preview-variant"
                label="Standard"
                value="standard"
                checked={audience === "standard"}
                onChange={() => setAudience("standard")}
              />
              <PktRadioButton
                id="preview-variant-gulliste"
                name="preview-variant"
                label="Gulliste"
                value="gulliste"
                checked={audience === "gulliste"}
                onChange={() => setAudience("gulliste")}
              />
            </div>
          </div>
        )}

        <div className="admin-preview__control admin-preview__control--building">
          <PktSelect
            id="preview-building-type"
            label="Byggtype"
            fullwidth
            value={buildingType}
            onChange={(event) => setBuildingType(event.target.value)}
          >
            {buildingTypeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </PktSelect>
        </div>
      </section>

      <section className="admin-preview__body">
        {mode === "tiltak" ? (
          <TiltakPreviewCanvas
            tiltakId={item.id}
            buildingType={buildingType}
            audience={audience}
          />
        ) : (
          <TilskuddPreviewDetails
            tilskudd={tilskuddContent}
            selectedTiltakId={selectedTiltakId}
            buildingType={buildingType}
            buildingTypeLabel={
              buildingTypeOptions.find(
                (option) => option.id === buildingType
              )?.label ?? "Standard"
            }
            audience={audience}
            tiltakOptions={tiltakOptions}
          />
        )}
      </section>
    </div>
  );

  if (!isDrawer) {
    return (
      <section className="admin-preview admin-preview--inline">
        <div className="admin-preview__inline-actions">
          <PktButton
            size="small"
            variant="label-only"
            skin="secondary"
            onClick={onClose}
          >
            Skjul forhåndsvisning
          </PktButton>
        </div>
        {previewContent}
      </section>
    );
  }

  return (
    <PktModal
      className="admin-preview-modal"
      ref={setModalRef}
      headingText={item.title}
      variant="drawer"
      drawerPosition="right"
      size="large"
      closeOnBackdropClick
    >
      {previewContent}
    </PktModal>
  );
}

function TiltakPreviewCanvas({
  tiltakId,
  buildingType,
  audience,
}: {
  tiltakId: string;
  buildingType: string;
  audience: ContentAudience;
}) {
  // Use legacy component if available, otherwise fall back to generic renderer
  const LegacyComponent = TILTAK_COMPONENT_MAP[tiltakId];

  return (
    <div className="admin-preview__canvas">
      {LegacyComponent ? (
        <LegacyComponent
          buildingType={buildingType === "default" ? undefined : buildingType}
          audience={audience}
        />
      ) : (
        <TiltakCardRenderer
          slug={tiltakId}
          buildingType={buildingType === "default" ? undefined : buildingType}
          audience={audience}
        />
      )}
    </div>
  );
}

interface TilskuddPreviewDetailsProps {
  tilskudd: TilskuddContent | undefined;
  selectedTiltakId: string | null;
  buildingType: string;
  buildingTypeLabel: string;
  audience: ContentAudience;
  tiltakOptions: { id: string; label: string }[];
}

function TilskuddPreviewDetails({
  tilskudd,
  selectedTiltakId,
  buildingType,
  buildingTypeLabel,
  audience,
  tiltakOptions,
}: TilskuddPreviewDetailsProps) {
  const {
    data: selectedTiltak,
    isLoading: tiltakLoading,
    error: tiltakError,
  } = useTiltakContent(selectedTiltakId);

  const grantIds = selectedTiltak?.grants ?? [];
  const {
    data: grantTilskudd,
    isLoading: grantsLoading,
    error: grantsError,
  } = useTilskuddBatch(grantIds.length ? grantIds : null);

  const filteredTilskudd = useMemo(() => {
    if (!grantTilskudd || !selectedTiltakId) {
      return [];
    }
    return grantTilskudd.filter((entry) =>
      matchesTilskuddCombo(entry, {
        tiltakId: selectedTiltakId,
        buildingType,
        audience,
      })
    );
  }, [grantTilskudd, selectedTiltakId, buildingType, audience]);

  const selectedPresent = tilskudd
    ? filteredTilskudd.some((entry) => entry.id === tilskudd.id)
    : false;

  const readMoreUrl =
    tilskudd?.application?.url ?? tilskudd?.links?.[0]?.url ?? null;

  return (
    <div className="tilskudd-preview">
      <section className="tilskudd-preview__summary">
        <h3>{tilskudd?.title ?? "Tilskuddsordning"}</h3>
        <dl>
          <div>
            <dt>Avsender</dt>
            <dd>{tilskudd?.provider?.name ?? "Ikke satt"}</dd>
          </div>
          <div>
            <dt>Lenke til “Les mer”</dt>
            <dd>
              {readMoreUrl ? (
                <a href={readMoreUrl} target="_blank" rel="noreferrer">
                  {readMoreUrl}
                </a>
              ) : (
                "Ingen lenke registrert"
              )}
            </dd>
          </div>
          <div>
            <dt>Byggtyper</dt>
            <dd>
              {tilskudd?.buildingTypes?.length
                ? tilskudd.buildingTypes.join(", ")
                : "Gjelder alle byggtyper"}
            </dd>
          </div>
          <div>
            <dt>Målgrupper</dt>
            <dd>
              {tilskudd?.audiences?.length
                ? tilskudd.audiences.join(", ")
                : "Standard"}
            </dd>
          </div>
          <div>
            <dt>Tiltak</dt>
            <dd>
              {tiltakOptions.length
                ? tiltakOptions.map((option) => option.label).join(", ")
                : "Ingen tilknyttede tiltak"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="tilskudd-preview__results">
        <header>
          <div>
            <h4>Støtteordninger i tiltakskortet</h4>
            <p>
              Kombinasjon:{" "}
              {selectedTiltakId ? (
                <strong>{selectedTiltakId}</strong>
              ) : (
                "ingen tiltak valgt"
              )}{" "}
              · {buildingTypeLabel} ·{" "}
              {audience === "gulliste" ? "Gulliste" : "Standard"}
            </p>
          </div>
        </header>

        {!selectedTiltakId && (
          <PktAlert skin="warning" title="Velg et tiltak" ariaLive="assertive">
            Tilskuddet må kobles til minst ett tiltak via `appliesToTiltak`
            før forhåndsvisning kan kjøres.
          </PktAlert>
        )}

        {selectedTiltakId && tiltakLoading && (
          <PktAlert skin="info" title="Laster tiltak" ariaLive="polite">
            Henter innhold for {selectedTiltakId} …
          </PktAlert>
        )}

        {selectedTiltakId && tiltakError && (
          <PktAlert skin="error" title="Feil i tiltak" ariaLive="assertive">
            {tiltakError.message}
          </PktAlert>
        )}

        {selectedTiltakId && !tiltakLoading && !grantIds.length && (
          <PktAlert skin="warning" title="Ingen tilskudd registrert">
            Det valgte tiltaket har ingen `grants[]`. Legg til ID-ene for
            tilskudd som skal vises.
          </PktAlert>
        )}

        {selectedTiltakId && grantsError && (
          <PktAlert skin="error" title="Kunne ikke hente tilskudd">
            {grantsError.message}
          </PktAlert>
        )}

        {selectedTiltakId &&
          !grantsLoading &&
          grantIds.length > 0 &&
          filteredTilskudd.length === 0 && (
            <PktAlert
              skin="info"
              title="Ingen tilskudd matcher denne kombinasjonen"
            >
              Sjekk `buildingTypes`, `audiences` og `appliesToTiltak` for
              de ulike ordningene slik at minst én treffer valgt
              kombinasjon.
            </PktAlert>
          )}

        {selectedTiltakId && filteredTilskudd.length > 0 && (
          <div className="tilskudd-preview__list">
            {filteredTilskudd.map((entry) => (
              <article
                key={entry.id}
                className={`tilskudd-preview__card${
                  tilskudd && entry.id === tilskudd.id
                    ? " tilskudd-preview__card--highlight"
                    : ""
                }`}
              >
                <header>
                  <h5>{entry.title}</h5>
                  <PktTag skin="blue">
                    {entry.provider?.name ?? "Ukjent avsender"}
                  </PktTag>
                </header>
                <p className="tilskudd-preview__funding">
                  {formatFundingSummary(entry.funding) ??
                    "Ingen beløpsinfo"}
                </p>
                <dl className="tilskudd-preview__meta">
                  <div>
                    <dt>Byggtyper</dt>
                    <dd>
                      {entry.buildingTypes?.length
                        ? entry.buildingTypes.join(", ")
                        : "Alle"}
                    </dd>
                  </div>
                  <div>
                    <dt>Målgrupper</dt>
                    <dd>
                      {entry.audiences?.length
                        ? entry.audiences.join(", ")
                        : "Standard"}
                    </dd>
                  </div>
                </dl>
                <footer>
                  <a
                    href={
                      entry.application?.url ??
                      entry.links?.[0]?.url ??
                      "#"
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {entry.application?.url
                      ? "Søknad / Les mer"
                      : entry.links?.[0]?.label ?? "Åpne lenke"}
                  </a>
                </footer>
              </article>
            ))}
          </div>
        )}

        {selectedTiltakId &&
          filteredTilskudd.length > 0 &&
          tilskudd &&
          !selectedPresent && (
            <PktAlert
              skin="warning"
              title="Dette tilskuddet vises ikke i valgt kombinasjon"
            >
              Oppdater `buildingTypes`, `audiences` eller
              `appliesToTiltak` slik at ordningen vises sammen med{" "}
              {selectedTiltakId}.
            </PktAlert>
          )}
      </section>
    </div>
  );
}

function matchesTilskuddCombo(
  tilskudd: TilskuddContent,
  options: { tiltakId: string; buildingType: string; audience: ContentAudience }
): boolean {
  if (!tilskudd.appliesToTiltak.includes(options.tiltakId)) {
    return false;
  }

  const matchesBuilding =
    options.buildingType === "default" ||
    !tilskudd.buildingTypes?.length ||
    tilskudd.buildingTypes.includes(options.buildingType);

  const matchesAudience =
    !tilskudd.audiences?.length ||
    tilskudd.audiences.includes(options.audience);

  return matchesBuilding && matchesAudience;
}

function formatFundingSummary(
  funding: TilskuddContent["funding"] | undefined
): string | null {
  if (!funding?.length) {
    return null;
  }

  const primary = funding[0];
  switch (primary.kind) {
    case "range": {
      const min = formatCurrency(primary.minAmount, primary.currency);
      const max = formatCurrency(primary.maxAmount, primary.currency);
      return primary.minAmount === primary.maxAmount ? max : `${min}–${max}`;
    }
    case "fixed": {
      const value = formatCurrency(primary.amount, primary.currency);
      return primary.perUnit ? `${value} ${primary.perUnit}` : value;
    }
    case "percentage":
      return `${primary.rate}% av kostnadene`;
    case "custom":
      return primary.description ?? null;
    default:
      return null;
  }
}

function formatCurrency(amount: number, currency = "NOK"): string {
  try {
    return new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  } catch {
    return new Intl.NumberFormat("nb-NO", {
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  }
}
