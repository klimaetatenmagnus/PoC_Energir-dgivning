import {
  SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PktAccordion,
  PktAccordionItem,
  PktAlert,
  PktButton,
  PktTextinput,
  PktModal,
  PktSelect,
  PktRadioButton,
  PktTag,
} from "@oslokommune/punkt-react";
import type { ContentAudience } from "../../../content/schema-helpers";
import {
  EtterisoleringYtterveggContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/EtterisoleringYttervegg";
import {
  IsoleringAvKjellerOgLoftContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/IsoleringAvKjellerOgLoft";
import {
  SolenergiContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/Solenergi";
import {
  TemperaturstyringContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/Temperaturstyring";
import {
  TettingContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/Tetting";
import {
  UtskiftningAvVinduContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/UtskiftningAvVindu";
import {
  VarmepumpeContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/Varmepumpe";
import {
  VentilasjonContentComponent,
} from "../../components/FigmaBlokk/components/Tiltak/Ventilasjon";
import type { TiltakComponentProps } from "../../components/FigmaBlokk/components/Tiltak/shared";
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
  AdminEnvironment,
  AdminMode,
} from "../types";
import type { TilskuddContent } from "../../../content/tilskudd/schema";
import {
  fetchTiltakMetadata,
  updateTiltakBenefitRefs,
} from "../api/adminApiClient";
import "./PreviewPanel.css";

type TiltakPreviewComponent = React.ComponentType<
  TiltakComponentProps & { audience?: ContentAudience }
>;

type BuildingTypeOption = {
  id: string;
  label: string;
  description?: string;
};

type DrawerModalElement = HTMLElement & {
  showModal?: (event?: Event | null) => void;
  close?: (event?: Event) => void;
};

const tiltakPreviewComponents: Record<string, TiltakPreviewComponent> = {
  "etterisolering-kjeller-loft": IsoleringAvKjellerOgLoftContentComponent,
  "etterisolering-yttervegg": EtterisoleringYtterveggContentComponent,
  solenergi: SolenergiContentComponent,
  temperaturstyring: TemperaturstyringContentComponent,
  tetting: TettingContentComponent,
  varmepumpe: VarmepumpeContentComponent,
  ventilasjon: VentilasjonContentComponent,
  vinduer: UtskiftningAvVinduContentComponent,
};

const DEFAULT_TILTAK_CANVAS_HEIGHT = 1150;
const tiltakPreviewHeights: Record<string, number> = {
  "etterisolering-kjeller-loft": 1150,
  "etterisolering-yttervegg": 1150,
  solenergi: 1050,
  temperaturstyring: 1100,
  tetting: 1050,
  varmepumpe: 1100,
  ventilasjon: 1050,
  vinduer: 1050,
};

interface PreviewPanelProps {
  item: AdminContentItem | null;
  mode: AdminMode | null;
  environment: AdminEnvironment;
  onClose: () => void;
  display?: "drawer" | "inline";
}

export function PreviewPanel({
  item,
  mode,
  environment,
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
  const { mutate: mutateTiltakPreview } = useTiltakContent(
    mode === "tiltak" ? item?.id ?? null : null
  );
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
  }, [item, mode, environment]);

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
          <PktTag skin={environment === "prod" ? "red" : "blue"}>
            {environment === "prod"
              ? "Produksjonsdata"
              : "Stagingdata (draft)"}
          </PktTag>
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
          <div className="admin-preview__stack">
            <BenefitInlineEditor
              tiltakId={item.id}
              benefitsDictionary={dictionary?.benefits ?? []}
              onRefreshTiltak={() => mutateTiltakPreview?.()}
            />
            <TiltakPreviewCanvas
              tiltakId={item.id}
              buildingType={buildingType}
              audience={audience}
            />
          </div>
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

type BenefitInlineEditorProps = {
  tiltakId: string;
  benefitsDictionary: {
    id: string;
    title: string;
    description: string;
    icon?: string;
  }[];
  onRefreshTiltak?: () => Promise<unknown> | unknown;
};

const MAX_BENEFITS = 4;

function BenefitInlineEditor({
  tiltakId,
  benefitsDictionary,
  onRefreshTiltak,
}: BenefitInlineEditorProps) {
  const [benefitRefs, setBenefitRefs] = useState<string[]>([]);
  const [originalRefs, setOriginalRefs] = useState<string[]>([]);
  const [generation, setGeneration] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState(
    "Oppdatert fordeler i admin UI"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      setStatus(null);
      try {
        const meta = await fetchTiltakMetadata(tiltakId);
        if (cancelled) return;
        setBenefitRefs(meta.benefitRefs ?? []);
        setOriginalRefs(meta.benefitRefs ?? []);
        setGeneration(meta.generation);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Kunne ikke hente metadata for tiltaket."
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [tiltakId]);

  const availableOptions = useMemo(
    () =>
      benefitsDictionary.filter(
        (entry) => !benefitRefs.includes(entry.id)
      ),
    [benefitsDictionary, benefitRefs]
  );

  const hasChanges =
    benefitRefs.length !== originalRefs.length ||
    benefitRefs.some((ref, idx) => ref !== originalRefs[idx]);

  const handleRemove = (id: string) => {
    setBenefitRefs((prev) => prev.filter((ref) => ref !== id));
    setAddOpen(true);
  };

  const handleAdd = () => {
    if (!pendingAdd) {
      setError("Velg en fordel i listen for å legge til.");
      return;
    }
    if (benefitRefs.includes(pendingAdd)) {
      setError("Fordelen er allerede valgt.");
      return;
    }
    setBenefitRefs((prev) => [...prev, pendingAdd].slice(0, MAX_BENEFITS));
    setPendingAdd("");
    setAddOpen(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!generation) {
      setError("Generation mangler. Oppdater siden og prøv igjen.");
      return;
    }
    setIsSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await updateTiltakBenefitRefs(tiltakId, {
        benefitRefs,
        generation,
        changeSummary: changeSummary.trim() || undefined,
      });
      setGeneration(response.generation);
      setOriginalRefs(response.benefitRefs);
      setStatus("Fordelene ble oppdatert.");
      if (onRefreshTiltak) {
        await onRefreshTiltak();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kunne ikke lagre fordelene. Prøv igjen."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetChanges = () => {
    setBenefitRefs(originalRefs);
    setPendingAdd("");
    setAddOpen(false);
    setStatus(null);
    setError(null);
  };

  const slots = Math.max(
    1,
    Math.min(MAX_BENEFITS - benefitRefs.length, MAX_BENEFITS)
  );

  return (
    <section className="benefit-inline">
      <header className="benefit-inline__header">
        <div>
          <p className="benefit-inline__eyebrow">Fordeler i tiltakskortet</p>
          <p className="benefit-inline__helper">
            Fjern med kryss, og legg til via den striplede plussboksen.
            Maks {MAX_BENEFITS} fordeler vises.
          </p>
        </div>
        <div className="benefit-inline__actions">
          <PktButton
            size="small"
            skin="primary"
            disabled={!hasChanges || isSaving || isLoading}
            onClick={handleSave}
          >
            {isSaving ? "Lagrer…" : "Lagre endringer"}
          </PktButton>
          <PktButton
            size="small"
            variant="ghost"
            disabled={!hasChanges || isSaving}
            onClick={resetChanges}
          >
            Angre endringer
          </PktButton>
        </div>
      </header>

      {isLoading && (
        <PktAlert skin="info" title="Laster fordeler…" ariaLive="polite">
          Henter valgt tiltak og metadata.
        </PktAlert>
      )}
      {error && (
        <PktAlert skin="error" title="Kunne ikke laste" ariaLive="assertive">
          {error}
        </PktAlert>
      )}
      {status && !hasChanges && (
        <PktAlert skin="success" title="Lagret" ariaLive="polite">
          {status}
        </PktAlert>
      )}

      <div className="benefit-inline__grid">
        {benefitRefs.map((id) => {
          const entry =
            benefitsDictionary.find((benefit) => benefit.id === id) ?? null;
          return (
            <div key={id} className="benefit-inline__card">
              <div className="benefit-inline__card-head">
                <span className="benefit-inline__card-title">
                  {entry?.title ?? id}
                </span>
                <PktButton
                  size="xsmall"
                  variant="ghost"
                  onClick={() => handleRemove(id)}
                  aria-label={`Fjern fordelen ${entry?.title ?? id}`}
                >
                  Fjern fordel
                </PktButton>
              </div>
              <p className="benefit-inline__description">
                {entry?.description ?? "Ingen beskrivelse registrert."}
              </p>
            </div>
          );
        })}

        {benefitRefs.length < MAX_BENEFITS &&
          Array.from({ length: slots }).map((_, idx) => (
            <button
              key={`placeholder-${idx}`}
              type="button"
              className="benefit-inline__placeholder"
              onClick={() => setAddOpen(true)}
              aria-label="Legg til fordel"
            >
              <span className="benefit-inline__placeholder-icon">+</span>
              <span className="benefit-inline__placeholder-text">
                Legg til fordel
              </span>
            </button>
          ))}
      </div>

      {addOpen && benefitRefs.length < MAX_BENEFITS && (
        <div className="benefit-inline__add">
          <PktSelect
            id="benefit-inline-select"
            label="Velg fordel (Punkt Selector)"
            fullwidth
            value={pendingAdd}
            onChange={(event) => setPendingAdd(event.target.value)}
          >
            <option value="">Velg fordel</option>
            {availableOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </PktSelect>
          <div className="benefit-inline__add-actions">
            <PktButton
              size="small"
              skin="secondary"
              disabled={!pendingAdd || isSaving}
              onClick={handleAdd}
            >
              Legg til
            </PktButton>
            <PktButton
              size="small"
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setPendingAdd("");
              }}
            >
              Avbryt
            </PktButton>
          </div>
        </div>
      )}

      <div className="benefit-inline__meta">
        <PktTextinput
          id="benefit-change-summary"
          label="Endringsnotat (lagres i metadata.changeSummary)"
          value={changeSummary}
          onChange={(event) => setChangeSummary(event.target.value)}
          placeholder="Kort begrunnelse for endringen"
        />
      </div>
    </section>
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
  const Component = tiltakPreviewComponents[tiltakId];
  const fallbackHeight =
    tiltakPreviewHeights[tiltakId] ?? DEFAULT_TILTAK_CANVAS_HEIGHT;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [canvasHeight, setCanvasHeight] = useState(fallbackHeight);

  useEffect(() => {
    setCanvasHeight(fallbackHeight);
    const node = frameRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const svg = node.querySelector("svg");
      if (!svg) {
        return;
      }
      const attrHeight = Number(svg.getAttribute("height"));
      const bbox =
        typeof svg.getBBox === "function" ? svg.getBBox().height : 0;
      const calculated = bbox && !Number.isNaN(bbox) ? bbox : attrHeight;
      const next = calculated && calculated > 0 ? calculated : fallbackHeight;
      setCanvasHeight(Math.round(next) + 32);
    };

    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [tiltakId, buildingType, audience, fallbackHeight]);

  if (!Component) {
    return (
      <PktAlert
        skin="warning"
        title="Forhåndsvisning mangler"
        ariaLive="off"
      >
        Vi har ikke koblet denne tiltakstypen til Punkt-komponenten ennå.
      </PktAlert>
    );
  }

  return (
    <div className="admin-preview__canvas">
      <div
        ref={frameRef}
        className="admin-preview__canvas-frame"
        role="region"
        aria-live="polite"
        aria-label="Forhåndsvisning av tiltak"
        style={{ height: `${Math.max(420, Math.min(canvasHeight, 1050))}px` }}
      >
        <Component
          buildingType={buildingType === "default" ? undefined : buildingType}
          audience={audience}
        />
      </div>
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
