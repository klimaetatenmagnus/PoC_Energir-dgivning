import { useState } from "react";
import { PktButton, PktCard, PktTag, PktAlert } from "@oslokommune/punkt-react";
import { useDrafts } from "../context/DraftsContext";
import "./PublishActionBar.css";

interface PublishActionBarProps {
  onOpenWizard: () => void;
  onDiscardSuccess?: () => void;
}

export function PublishActionBar({ onOpenWizard, onDiscardSuccess }: PublishActionBarProps) {
  const { drafts, count, loading, error, discardAll, refresh } = useDrafts();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);

  // Ikke vis action bar hvis ingen drafts eller fortsatt laster
  if (loading || count === 0) {
    return null;
  }

  const handleDiscardClick = () => {
    setShowDiscardConfirm(true);
    setDiscardError(null);
  };

  const handleDiscardConfirm = async () => {
    setDiscarding(true);
    setDiscardError(null);
    try {
      await discardAll();
      setShowDiscardConfirm(false);
      // Oppdater katalogen så status-badges reflekterer at drafts er borte
      onDiscardSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setDiscardError(message);
    } finally {
      setDiscarding(false);
    }
  };

  const handleDiscardCancel = () => {
    setShowDiscardConfirm(false);
    setDiscardError(null);
  };

  // Bekreftelsesdialog for forkasting
  if (showDiscardConfirm) {
    return (
      <div className="publish-action-bar">
        <PktCard>
          <div className="publish-action-bar__content">
            <div className="publish-action-bar__confirm-header">
              <PktTag skin="yellow">Bekreft</PktTag>
              <strong>Forkast alle endringer?</strong>
            </div>

            <p className="publish-action-bar__confirm-text">
              Dette vil slette alle kladder og tilbakestille innholdet til sist
              publiserte versjon.
            </p>

            <ul className="publish-action-bar__confirm-list">
              {drafts.map((draft) => (
                <li key={`${draft.collection}-${draft.id}`}>
                  {draft.title} ({draft.collection})
                </li>
              ))}
            </ul>

            {discardError && (
              <PktAlert skin="error" size="small">
                {discardError}
              </PktAlert>
            )}

            <div className="publish-action-bar__confirm-actions">
              <PktButton
                skin="secondary"
                size="small"
                onClick={handleDiscardCancel}
                disabled={discarding}
              >
                Avbryt
              </PktButton>
              <PktButton
                skin="primary"
                size="small"
                onClick={handleDiscardConfirm}
                disabled={discarding}
              >
                {discarding ? "Forkaster..." : "Forkast endringer"}
              </PktButton>
            </div>
          </div>
        </PktCard>
      </div>
    );
  }

  // Normal visning
  return (
    <div className="publish-action-bar">
      <PktCard>
        <div className="publish-action-bar__content">
          <div className="publish-action-bar__header">
            <PktTag skin="blue">{count}</PktTag>
            <span className="publish-action-bar__label">
              {count === 1 ? "upublisert endring" : "upubliserte endringer"}
            </span>
          </div>

          {error && (
            <PktAlert skin="error" size="small">
              {error}
              <PktButton skin="tertiary" size="small" onClick={refresh}>
                Prøv igjen
              </PktButton>
            </PktAlert>
          )}

          <div className="publish-action-bar__actions">
            <PktButton skin="primary" size="small" onClick={onOpenWizard}>
              Oppdater Energinøkkelen
            </PktButton>
            <PktButton
              skin="secondary"
              size="small"
              onClick={handleDiscardClick}
            >
              Nullstill endringer
            </PktButton>
          </div>
        </div>
      </PktCard>
    </div>
  );
}
