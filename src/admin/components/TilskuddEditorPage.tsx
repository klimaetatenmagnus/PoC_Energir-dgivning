import { useCallback, useEffect, useState } from "react";
import { PktAlert, PktButton } from "@oslokommune/punkt-react";
import { TilskuddEditor } from "./TilskuddEditor";
import {
  fetchTilskudd,
  updateTilskudd,
  publishTilskudd,
  discardTilskuddDraft,
  createTilskudd,
} from "../api/adminApiClient";
import type { TilskuddContent } from "../../../content/tilskudd/schema";
import "./TilskuddEditorPage.css";

interface TilskuddEditorPageProps {
  tilskuddId: string | null; // null = create-modus
  onClose: () => void;
  onSaveSuccess: () => void;
  mode?: "edit" | "create";
}

/**
 * Oppretter et tomt tilskudd-objekt for create-modus.
 */
function createEmptyTilskudd(): TilskuddContent {
  return {
    schemaVersion: 1,
    id: "",
    title: "",
    summary: "",
    description: [""],
    category: "kommunal",
    provider: {
      name: "",
      url: "",
    },
    funding: [
      {
        kind: "custom",
        description: "Beskriv støttebeløpet",
      },
    ],
    eligibility: [
      {
        title: "Hvem kan søke",
        description: ["Beskriv kravene for å kunne søke"],
      },
    ],
    requirements: [],
    buildingTypes: ["enebolig"],
    appliesToTiltak: [],
    regions: ["oslo"],
    audiences: ["standard"],
    tags: [],
    contacts: [],
    application: {
      url: "",
      rolling: true,
    },
    links: [],
    metadata: {
      status: "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: "pending",
      changeSummary: "Opprettet",
    },
  };
}

type LoadingState = "loading" | "ready" | "error" | "saving" | "publishing" | "discarding" | "creating";

export function TilskuddEditorPage({
  tilskuddId,
  onClose,
  onSaveSuccess,
  mode: propMode,
}: TilskuddEditorPageProps) {
  // Bestem modus: create hvis tilskuddId er null eller propMode er "create"
  const isCreateMode = propMode === "create" || tilskuddId === null;

  const [tilskudd, setTilskudd] = useState<TilskuddContent | null>(
    isCreateMode ? createEmptyTilskudd() : null
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

  // Hent tilskudd-data ved oppstart (bare i edit-modus)
  useEffect(() => {
    // Ikke hent data i create-modus
    if (isCreateMode || !tilskuddId) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoadingState("loading");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetchTilskudd(tilskuddId!);
        if (cancelled) return;

        setTilskudd(response.tilskudd);
        setGeneration(response.generation);
        setHasDraft(response.hasDraft);
        setSource(response.source);
        setLoadingState("ready");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Kunne ikke hente tilskudd");
        setLoadingState("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [tilskuddId, isCreateMode]);

  const handleSave = useCallback(
    async (updated: TilskuddContent) => {
      // I create-modus: opprett nytt tilskudd
      if (currentMode === "create") {
        setLoadingState("creating");
        setError(null);
        setSuccessMessage(null);

        try {
          const response = await createTilskudd({
            tilskudd: updated,
            changeSummary: updated.metadata.changeSummary,
          });

          // Oppdater state med opprettet tilskudd
          setGeneration(response.generation);
          setTilskudd(response.tilskudd);
          setHasDraft(response.hasDraft);
          setSource(response.source);
          setLoadingState("ready");
          setSuccessMessage(`Tilskuddsordningen "${response.tilskudd.title}" er opprettet som utkast`);

          // Bytt til edit-modus for videre redigering
          setCurrentMode("edit");

          // Gi beskjed til parent
          onSaveSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke opprette tilskuddsordningen");
          setLoadingState("ready");
        }
        return;
      }

      // Edit-modus: oppdater eksisterende tilskudd
      if (!generation) {
        setError("Mangler generasjonsinfo - prøv å laste inn på nytt");
        return;
      }

      setLoadingState("saving");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await updateTilskudd(tilskudd!.id, {
          tilskudd: updated,
          generation,
          changeSummary: updated.metadata.changeSummary,
        });

        // Oppdater generation for neste lagring
        setGeneration(response.generation);
        setTilskudd(response.tilskudd);
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
    [currentMode, tilskudd, generation, onSaveSuccess]
  );

  const handlePublish = useCallback(async () => {
    if (!tilskudd?.id) {
      setError("Kan ikke publisere - tilskudd mangler ID");
      return;
    }

    setLoadingState("publishing");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await publishTilskudd(tilskudd.id);

      // Oppdater state med publisert versjon
      setGeneration(response.generation);
      setTilskudd(response.tilskudd);
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
  }, [tilskudd?.id, onSaveSuccess]);

  const handleDiscardDraft = useCallback(async () => {
    if (!tilskudd?.id) {
      setError("Kan ikke forkaste - tilskudd mangler ID");
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
      await discardTilskuddDraft(tilskudd.id);

      // Hent publisert versjon på nytt
      const response = await fetchTilskudd(tilskudd.id);
      setTilskudd(response.tilskudd);
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
  }, [tilskudd?.id, currentMode, onClose, onSaveSuccess]);

  const handleRetry = useCallback(() => {
    // Ingen retry i create-modus
    if (!tilskudd?.id) {
      return;
    }

    setLoadingState("loading");
    setError(null);
    setSuccessMessage(null);

    fetchTilskudd(tilskudd.id)
      .then((response) => {
        setTilskudd(response.tilskudd);
        setGeneration(response.generation);
        setHasDraft(response.hasDraft);
        setSource(response.source);
        setLoadingState("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Kunne ikke hente tilskudd");
        setLoadingState("error");
      });
  }, [tilskudd?.id]);

  const isProcessing = loadingState === "saving" || loadingState === "publishing" || loadingState === "discarding" || loadingState === "creating";

  return (
    <div className="tilskudd-editor-page">
      <header className="tilskudd-editor-page__header">
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
        {tilskudd && loadingState !== "loading" && loadingState !== "error" && currentMode !== "create" && (
          <div className="tilskudd-editor-page__actions">
            {hasDraft && (
              <>
                <span className="tilskudd-editor-page__draft-badge">
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
              <span className="tilskudd-editor-page__published-badge">
                Publisert
              </span>
            )}
          </div>
        )}
      </header>

      {/* Suksessmelding */}
      {successMessage && (
        <PktAlert
          skin="success"
          title="Vellykket"
          ariaLive="polite"
          className="tilskudd-editor-page__success"
        >
          {successMessage}
        </PktAlert>
      )}

      {loadingState === "loading" && (
        <PktAlert skin="info" title="Henter innhold" ariaLive="polite">
          Laster inn tilskudd...
        </PktAlert>
      )}

      {loadingState === "error" && (
        <PktAlert skin="error" title="Kunne ikke hente tilskudd" ariaLive="assertive">
          <p>{error ?? "Ukjent feil"}</p>
          <div className="tilskudd-editor-page__error-actions">
            <PktButton skin="secondary" size="small" onClick={handleRetry}>
              Prøv igjen
            </PktButton>
            <PktButton skin="tertiary" size="small" onClick={onClose}>
              Avbryt
            </PktButton>
          </div>
        </PktAlert>
      )}

      {(loadingState === "ready" || isProcessing) && tilskudd && (
        <TilskuddEditor
          tilskudd={tilskudd}
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
          className="tilskudd-editor-page__save-error"
        >
          {error}
        </PktAlert>
      )}
    </div>
  );
}
