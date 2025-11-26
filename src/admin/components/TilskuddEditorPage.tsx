import { useCallback, useEffect, useState } from "react";
import { PktAlert, PktButton } from "@oslokommune/punkt-react";
import { TilskuddEditor } from "./TilskuddEditor";
import {
  fetchTilskudd,
  updateTilskudd,
  publishTilskudd,
  discardTilskuddDraft,
} from "../api/adminApiClient";
import type { TilskuddContent } from "../../../content/tilskudd/schema";
import "./TilskuddEditorPage.css";

interface TilskuddEditorPageProps {
  tilskuddId: string;
  onClose: () => void;
  onSaveSuccess: () => void;
}

type LoadingState = "loading" | "ready" | "error" | "saving" | "publishing" | "discarding";

export function TilskuddEditorPage({
  tilskuddId,
  onClose,
  onSaveSuccess,
}: TilskuddEditorPageProps) {
  const [tilskudd, setTilskudd] = useState<TilskuddContent | null>(null);
  const [generation, setGeneration] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [source, setSource] = useState<"draft" | "published">("published");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hent tilskudd-data ved oppstart
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingState("loading");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await fetchTilskudd(tilskuddId);
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
  }, [tilskuddId]);

  const handleSave = useCallback(
    async (updated: TilskuddContent) => {
      if (!generation) {
        setError("Mangler generasjonsinfo - prøv å laste inn på nytt");
        return;
      }

      setLoadingState("saving");
      setError(null);
      setSuccessMessage(null);

      try {
        const response = await updateTilskudd(tilskuddId, {
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
    [tilskuddId, generation, onSaveSuccess]
  );

  const handlePublish = useCallback(async () => {
    setLoadingState("publishing");
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await publishTilskudd(tilskuddId);

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
  }, [tilskuddId, onSaveSuccess]);

  const handleDiscardDraft = useCallback(async () => {
    if (!confirm("Er du sikker på at du vil forkaste alle upubliserte endringer?")) {
      return;
    }

    setLoadingState("discarding");
    setError(null);
    setSuccessMessage(null);

    try {
      await discardTilskuddDraft(tilskuddId);

      // Hent publisert versjon på nytt
      const response = await fetchTilskudd(tilskuddId);
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
  }, [tilskuddId, onSaveSuccess]);

  const handleRetry = useCallback(() => {
    setLoadingState("loading");
    setError(null);
    setSuccessMessage(null);

    fetchTilskudd(tilskuddId)
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
  }, [tilskuddId]);

  const isProcessing = loadingState === "saving" || loadingState === "publishing" || loadingState === "discarding";

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

        {/* Draft-status og publiser-knapper */}
        {tilskudd && loadingState !== "loading" && loadingState !== "error" && (
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
          isSaving={loadingState === "saving"}
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
