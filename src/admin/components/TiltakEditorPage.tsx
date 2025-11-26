import { useCallback, useEffect, useState } from "react";
import { PktAlert, PktButton } from "@oslokommune/punkt-react";
import { TiltakEditor } from "./TiltakEditor";
import {
  fetchTiltak,
  updateTiltak,
  publishTiltak,
  discardTiltakDraft,
} from "../api/adminApiClient";
import type { TiltakContent } from "../../../content/tiltak/schema";
import "./TiltakEditorPage.css";

interface TiltakEditorPageProps {
  tiltakId: string;
  onClose: () => void;
  onSaveSuccess: () => void;
}

type LoadingState = "loading" | "ready" | "error" | "saving" | "publishing" | "discarding";

export function TiltakEditorPage({
  tiltakId,
  onClose,
  onSaveSuccess,
}: TiltakEditorPageProps) {
  const [tiltak, setTiltak] = useState<TiltakContent | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [source, setSource] = useState<"draft" | "published">("published");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hent tiltak-data ved oppstart
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingState("loading");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetchTiltak(tiltakId);
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
  }, [tiltakId]);

  const handleSave = useCallback(
    async (updated: TiltakContent) => {
      if (!generation) {
        setError("Mangler generasjonsinfo - prøv å laste inn på nytt");
        return;
      }

      setLoadingState("saving");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await updateTiltak(tiltakId, {
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
    [tiltakId, generation, onSaveSuccess]
  );

  const handlePublish = useCallback(async () => {
    setLoadingState("publishing");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await publishTiltak(tiltakId);

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
  }, [tiltakId, onSaveSuccess]);

  const handleDiscardDraft = useCallback(async () => {
    if (!confirm("Er du sikker på at du vil forkaste alle upubliserte endringer?")) {
      return;
    }

    setLoadingState("discarding");
    setError(null);
    setSuccessMessage(null);

    try {
      await discardTiltakDraft(tiltakId);

      // Hent publisert versjon på nytt
      const response = await fetchTiltak(tiltakId);
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
  }, [tiltakId, onSaveSuccess]);

  const handleRetry = useCallback(() => {
    setLoadingState("loading");
    setError(null);
    setSuccessMessage(null);

    fetchTiltak(tiltakId)
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
  }, [tiltakId]);

  const isProcessing = loadingState === "saving" || loadingState === "publishing" || loadingState === "discarding";

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

        {/* Draft-status og publiser-knapper */}
        {tiltak && loadingState !== "loading" && loadingState !== "error" && (
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
          isSaving={loadingState === "saving"}
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
