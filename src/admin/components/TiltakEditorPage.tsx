import { useCallback, useEffect, useState } from "react";
import { PktAlert, PktButton } from "@oslokommune/punkt-react";
import { TiltakEditor } from "./TiltakEditor";
import {
  fetchTiltak,
  updateTiltak,
  publishTiltak,
  discardTiltakDraft,
  createTiltak,
} from "../api/adminApiClient";
import type { TiltakContent } from "../../../content/tiltak/schema";
import "./TiltakEditorPage.css";

interface TiltakEditorPageProps {
  tiltakId: string | null; // null = create-modus
  onClose: () => void;
  onSaveSuccess: () => void;
  mode?: "edit" | "create";
}

/**
 * Oppretter et tomt tiltak-objekt for create-modus.
 * Inkluderer støtte for både standard og gul liste (vernede bygg).
 */
function createEmptyTiltak(): TiltakContent {
  return {
    schemaVersion: 1,
    id: "",
    title: "",
    introParagraphs: [""],
    buildingTypeParagraphs: {
      default: [""],
    },
    benefitRefs: [],
    benefits: [],
    glossaryTermRefs: [],
    readMore: [],
    callsToAction: [],
    customSections: [],
    tabs: [],
    accordion: [],
    stats: [],
    grants: [],
    relatedTiltak: [],
    supportTags: [],
    audiences: ["standard", "gulliste"],
    visibleForBuildingTypes: [],
    metadata: {
      status: "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: "pending", // Placeholder - backend overskriver med faktisk bruker
      changeSummary: "Opprettet",
    },
    // Tom gulliste-variant - vil bli fylt ut når bruker redigerer gul liste-innhold
    variants: [
      {
        audience: "gulliste",
        benefitRefs: [],
      },
    ],
  };
}

type LoadingState = "loading" | "ready" | "error" | "saving" | "publishing" | "discarding" | "creating";

export function TiltakEditorPage({
  tiltakId,
  onClose,
  onSaveSuccess,
  mode: propMode,
}: TiltakEditorPageProps) {
  // Bestem modus: create hvis tiltakId er null eller propMode er "create"
  const isCreateMode = propMode === "create" || tiltakId === null;

  const [tiltak, setTiltak] = useState<TiltakContent | null>(
    isCreateMode ? createEmptyTiltak() : null
  );
  const [generation, setGeneration] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>(
    isCreateMode ? "ready" : "loading"
  );
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(isCreateMode);
  const [source, setSource] = useState<"draft" | "published">("draft");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Etter opprettelse: bytt til edit-modus for å kunne fortsette redigering
  const [currentMode, setCurrentMode] = useState<"edit" | "create">(
    isCreateMode ? "create" : "edit"
  );

  // Hent tiltak-data ved oppstart (bare i edit-modus)
  useEffect(() => {
    // Ikke hent data i create-modus
    if (isCreateMode || !tiltakId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingState("loading");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetchTiltak(tiltakId!);
        if (cancelled) return;

        setTiltak(response.tiltak);
        setGeneration(response.generation);
        setHasDraft(response.hasDraft);
        setSource(response.source);
        setLoadingState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Kunne ikke hente tiltak");
        setLoadingState("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tiltakId, isCreateMode]);

  const handleSave = useCallback(
    async (updated: TiltakContent) => {
      // I create-modus: opprett nytt tiltak
      if (currentMode === "create") {
        setLoadingState("creating");
        setError(null);
        setSuccessMessage(null);

        try {
          const response = await createTiltak({
            tiltak: updated,
            changeSummary: updated.metadata.changeSummary,
          });

          // Oppdater state med opprettet tiltak
          setGeneration(response.generation);
          setTiltak(response.tiltak);
          setHasDraft(response.hasDraft);
          setSource(response.source);
          setLoadingState("ready");
          setSuccessMessage(`Tiltaket "${response.tiltak.title}" er opprettet som utkast`);

          // Bytt til edit-modus for videre redigering
          setCurrentMode("edit");

          // Gi beskjed til parent
          onSaveSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke opprette tiltaket");
          setLoadingState("ready");
        }
        return;
      }

      // Edit-modus: oppdater eksisterende tiltak
      if (!generation) {
        setError("Mangler generasjonsinfo - prøv å laste inn på nytt");
        return;
      }

      setLoadingState("saving");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await updateTiltak(tiltak!.id, {
          tiltak: updated,
          generation,
          changeSummary: updated.metadata.changeSummary,
        });

        // Oppdater generation for neste lagring
        setGeneration(response.generation);
        setTiltak(response.tiltak);
        setHasDraft(response.hasDraft);
        setSource(response.source);
        setLoadingState("ready");
        setSuccessMessage("Endringene er lagret som utkast");

        // Gi beskjed til parent
        onSaveSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke lagre endringene");
        setLoadingState("ready"); // Gå tilbake til ready så bruker kan prøve igjen
      }
    },
    [currentMode, tiltak, generation, onSaveSuccess]
  );

  const handlePublish = useCallback(async () => {
    if (!tiltak?.id) {
      setError("Kan ikke publisere - tiltak mangler ID");
      return;
    }

    setLoadingState("publishing");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await publishTiltak(tiltak.id);

      // Oppdater state med publisert versjon
      setGeneration(response.generation);
      setTiltak(response.tiltak);
      setHasDraft(false);
      setSource("published");
      setLoadingState("ready");
      setSuccessMessage(response.message);

      // Gi beskjed til parent
      onSaveSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke publisere");
      setLoadingState("ready");
    }
  }, [tiltak?.id, onSaveSuccess]);

  const handleDiscardDraft = useCallback(async () => {
    if (!tiltak?.id) {
      setError("Kan ikke forkaste - tiltak mangler ID");
      return;
    }

    // I create-modus før lagring: bare lukk editoren
    if (currentMode === "create") {
      onClose();
      return;
    }

    if (!confirm("Er du sikker på at du vil forkaste alle upubliserte endringer?")) {
      return;
    }

    setLoadingState("discarding");
    setError(null);
    setSuccessMessage(null);

    try {
      await discardTiltakDraft(tiltak.id);

      // Hent publisert versjon på nytt
      const response = await fetchTiltak(tiltak.id);
      setTiltak(response.tiltak);
      setGeneration(response.generation);
      setHasDraft(response.hasDraft);
      setSource(response.source);
      setLoadingState("ready");
      setSuccessMessage("Utkastet er forkastet");

      onSaveSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke forkaste utkastet");
      setLoadingState("ready");
    }
  }, [tiltak?.id, currentMode, onClose, onSaveSuccess]);

  const handleRetry = useCallback(() => {
    // Ingen retry i create-modus
    if (!tiltak?.id) {
      return;
    }

    setLoadingState("loading");
    setError(null);
    setSuccessMessage(null);

    fetchTiltak(tiltak.id)
      .then((response) => {
        setTiltak(response.tiltak);
        setGeneration(response.generation);
        setHasDraft(response.hasDraft);
        setSource(response.source);
        setLoadingState("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Kunne ikke hente tiltak");
        setLoadingState("error");
      });
  }, [tiltak?.id]);

  const isProcessing = loadingState === "saving" || loadingState === "publishing" || loadingState === "discarding" || loadingState === "creating";

  return (
    <div className="tiltak-editor-page">
      <header className="tiltak-editor-page__header">
        <PktButton
          skin="secondary"
          size="medium"
          variant="icon-left"
          iconName="arrow-return"
          onClick={onClose}
          disabled={isProcessing}
        >
          <span>Tilbake</span>
        </PktButton>

        {/* Draft-status og publiser-knapper (skjules i create-modus før første lagring) */}
        {tiltak && loadingState !== "loading" && loadingState !== "error" && currentMode !== "create" && (
          <div className="tiltak-editor-page__actions">
            {hasDraft && (
              <>
                <span className="tiltak-editor-page__draft-badge">
                  Upubliserte endringer
                </span>
                <PktButton
                  skin="tertiary"
                  size="small"
                  onClick={handleDiscardDraft}
                  disabled={isProcessing}
                >
                  {loadingState === "discarding" ? "Forkaster..." : "Forkast utkast"}
                </PktButton>
                <PktButton
                  skin="primary"
                  size="small"
                  onClick={handlePublish}
                  disabled={isProcessing}
                >
                  {loadingState === "publishing" ? "Publiserer..." : "Publiser endringer"}
                </PktButton>
              </>
            )}
            {!hasDraft && source === "published" && (
              <span className="tiltak-editor-page__published-badge">
                Publisert
              </span>
            )}
          </div>
        )}
        {/* Create-modus badge */}
        {currentMode === "create" && (
          <div className="tiltak-editor-page__actions">
            <span className="tiltak-editor-page__create-badge">
              Nytt tiltak
            </span>
          </div>
        )}
      </header>

      {/* Suksessmelding */}
      {successMessage && (
        <PktAlert
          skin="success"
          title="Vellykket"
          ariaLive="polite"
          className="tiltak-editor-page__success"
        >
          {successMessage}
        </PktAlert>
      )}

      {loadingState === "loading" && (
        <PktAlert skin="info" title="Henter innhold" ariaLive="polite">
          Laster inn tiltak...
        </PktAlert>
      )}

      {loadingState === "error" && (
        <PktAlert skin="error" title="Kunne ikke hente tiltak" ariaLive="assertive">
          <p>{error ?? "Ukjent feil"}</p>
          <div className="tiltak-editor-page__error-actions">
            <PktButton skin="secondary" size="small" onClick={handleRetry}>
              Prøv igjen
            </PktButton>
            <PktButton skin="tertiary" size="small" onClick={onClose}>
              Avbryt
            </PktButton>
          </div>
        </PktAlert>
      )}

      {(loadingState === "ready" || isProcessing) && tiltak && (
        <TiltakEditor
          tiltak={tiltak}
          onSave={handleSave}
          onCancel={onClose}
          isSaving={loadingState === "saving" || loadingState === "creating"}
          mode={currentMode}
        />
      )}

      {error && loadingState !== "error" && (
        <PktAlert
          skin="error"
          title="Operasjon feilet"
          ariaLive="assertive"
          className="tiltak-editor-page__save-error"
        >
          {error}
        </PktAlert>
      )}
    </div>
  );
}
