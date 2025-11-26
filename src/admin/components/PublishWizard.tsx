import { useState, useRef, useEffect } from "react";
import {
  PktModal,
  PktStepper,
  PktStep,
  PktButton,
  PktAlert,
  PktTextinput,
} from "@oslokommune/punkt-react";
import { useDrafts } from "../context/DraftsContext";
import type { DraftSummary } from "../api/adminApiClient";
import "./PublishWizard.css";

interface PublishWizardProps {
  open: boolean;
  onClose: () => void;
}

type WizardStep = 1 | 2 | 3 | 4;

type StepStatus = "completed" | "current" | "incomplete";

const STAGING_URL = "https://staging.xn--energinkkelen-hnb.no";

export function PublishWizard({ open, onClose }: PublishWizardProps) {
  const { drafts, count, syncToStaging, refresh } = useDrafts();
  const modalRef = useRef<HTMLDialogElement | null>(null);

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [stagingSynced, setStagingSynced] = useState(false);
  const [stagingSyncing, setStagingSyncing] = useState(false);
  const [stagingError, setStagingError] = useState<string | null>(null);
  const [_qaConfirmed, setQaConfirmed] = useState(false);
  const [changeSummary, setChangeSummary] = useState("");
  const [publishStatus, setPublishStatus] = useState<
    "idle" | "publishing" | "success" | "error"
  >("idle");
  const [publishError, setPublishError] = useState<string | null>(null);
  const [buildId, setBuildId] = useState<string | null>(null);

  // Åpne/lukke modal basert på open prop
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    if (open) {
      modal.showModal();
    } else {
      modal.close();
    }
  }, [open]);

  // Reset state når wizard åpnes
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setStagingSynced(false);
      setStagingSyncing(false);
      setStagingError(null);
      setQaConfirmed(false);
      setChangeSummary("");
      setPublishStatus("idle");
      setPublishError(null);
      setBuildId(null);
    }
  }, [open]);

  const handleClose = () => {
    onClose();
  };

  const getStepStatus = (step: WizardStep): StepStatus => {
    if (step < currentStep) return "completed";
    if (step === currentStep) return "current";
    return "incomplete";
  };

  // Steg 2: Send til staging
  const handleSyncToStaging = async () => {
    setStagingSyncing(true);
    setStagingError(null);
    try {
      await syncToStaging();
      setStagingSynced(true);
      setCurrentStep(3);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setStagingError(message);
    } finally {
      setStagingSyncing(false);
    }
  };

  // Steg 3: Bekreft QA
  const handleQaConfirm = () => {
    setQaConfirmed(true);
    setCurrentStep(4);
  };

  // Steg 4: Publiser til prod
  const handlePublish = async () => {
    if (!changeSummary.trim()) {
      setPublishError("Du må legge til en beskrivelse av endringene");
      return;
    }

    setPublishStatus("publishing");
    setPublishError(null);

    try {
      const response = await fetch("/admin/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeSummary: changeSummary.trim(),
          items: drafts.map((d) => ({ id: d.id, collection: d.collection })),
          dryRun: false,
          targetEnvironment: "prod",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Feil: ${response.status}`);
      }

      const data = await response.json();
      setBuildId(data.buildId || null);
      setPublishStatus("success");

      // Refresh drafts-listen (bør nå være tom)
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      setPublishError(message);
      setPublishStatus("error");
    }
  };

  // Vis ikke hvis ingen drafts
  if (count === 0 && !open) {
    return null;
  }

  return (
    <PktModal
      ref={(el: HTMLDialogElement | null) => {
        modalRef.current = el;
      }}
      headingText="Oppdater Energinøkkelen"
      size="large"
      closeOnBackdropClick={false}
      onClose={handleClose}
    >
      <div className="publish-wizard">
        <PktStepper orientation="vertical" activeStep={String(currentStep)}>
          {/* Steg 1: Gjennomgå endringer */}
          <PktStep title="Gjennomgå endringer" status={getStepStatus(1)}>
            <div className="publish-wizard__step-content">
              <p className="publish-wizard__description">
                Følgende endringer vil bli publisert:
              </p>
              <DraftsList drafts={drafts} />
              {currentStep === 1 && (
                <div className="publish-wizard__actions">
                  <PktButton
                    skin="primary"
                    size="small"
                    onClick={() => setCurrentStep(2)}
                    disabled={count === 0}
                  >
                    Neste: Staging
                  </PktButton>
                </div>
              )}
            </div>
          </PktStep>

          {/* Steg 2: Send til staging */}
          <PktStep title="Send til staging" status={getStepStatus(2)}>
            <div className="publish-wizard__step-content">
              <p className="publish-wizard__description">
                Endringene sendes til staging-miljøet slik at du kan verifisere
                dem på{" "}
                <a href={STAGING_URL} target="_blank" rel="noopener noreferrer">
                  staging.energinokkelen.no
                </a>{" "}
                før de publiseres til brukerne.
              </p>

              {stagingError && (
                <PktAlert skin="error" size="small">
                  {stagingError}
                </PktAlert>
              )}

              {stagingSynced && (
                <PktAlert skin="success" size="small">
                  Staging oppdatert! {count} filer synkronisert.
                </PktAlert>
              )}

              {currentStep === 2 && (
                <div className="publish-wizard__actions">
                  <PktButton
                    skin="secondary"
                    size="small"
                    onClick={() => setCurrentStep(1)}
                    disabled={stagingSyncing}
                  >
                    Tilbake
                  </PktButton>
                  <PktButton
                    skin="primary"
                    size="small"
                    onClick={handleSyncToStaging}
                    disabled={stagingSyncing}
                  >
                    {stagingSyncing ? "Sender..." : "Send til staging"}
                  </PktButton>
                </div>
              )}
            </div>
          </PktStep>

          {/* Steg 3: Visuell QA */}
          <PktStep title="Visuell QA i staging" status={getStepStatus(3)}>
            <div className="publish-wizard__step-content">
              <p className="publish-wizard__description">
                Åpne staging-nettsiden og verifiser at endringene ser riktige ut
                i faktisk frontend-kontekst.
              </p>

              <a
                href={STAGING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="publish-wizard__staging-link"
              >
                Åpne staging.energinokkelen.no
              </a>

              <QAChecklist />

              {currentStep === 3 && (
                <div className="publish-wizard__actions">
                  <PktButton
                    skin="secondary"
                    size="small"
                    onClick={() => setCurrentStep(2)}
                  >
                    Tilbake
                  </PktButton>
                  <PktButton
                    skin="primary"
                    size="small"
                    onClick={handleQaConfirm}
                  >
                    Jeg har verifisert endringene
                  </PktButton>
                </div>
              )}
            </div>
          </PktStep>

          {/* Steg 4: Publiser til prod */}
          <PktStep
            title="Publiser til energinøkkelen.no"
            status={getStepStatus(4)}
          >
            <div className="publish-wizard__step-content">
              {publishStatus !== "success" && (
                <>
                  <PktAlert skin="warning" size="small">
                    Dette publiserer endringene til energinøkkelen.no og gjør
                    dem synlige for alle brukere.
                  </PktAlert>

                  <div className="publish-wizard__summary">
                    <strong>Oppsummering:</strong>
                    <ul>
                      <li>
                        {drafts.filter((d) => d.collection === "tiltak").length}{" "}
                        tiltak oppdatert
                      </li>
                      <li>
                        {
                          drafts.filter((d) => d.collection === "tilskudd")
                            .length
                        }{" "}
                        tilskudd oppdatert
                      </li>
                    </ul>
                  </div>

                  <div className="publish-wizard__change-summary">
                    <PktTextinput
                      label="Kort beskrivelse av endringene"
                      helptext="Denne teksten lagres i publiseringsloggen (5-1000 tegn)"
                      value={changeSummary}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setChangeSummary(e.target.value)
                      }
                      hasError={
                        publishError?.includes("beskrivelse") ?? false
                      }
                    />
                  </div>

                  {publishError && (
                    <PktAlert skin="error" size="small">
                      {publishError}
                    </PktAlert>
                  )}
                </>
              )}

              {publishStatus === "success" && (
                <PktAlert skin="success" size="small">
                  <strong>Publisering fullført!</strong>
                  {buildId && (
                    <span>
                      {" "}
                      Cloud Build-jobb: <code>{buildId}</code>
                    </span>
                  )}
                </PktAlert>
              )}

              {currentStep === 4 && (
                <div className="publish-wizard__actions">
                  {publishStatus !== "success" && (
                    <>
                      <PktButton
                        skin="secondary"
                        size="small"
                        onClick={() => setCurrentStep(3)}
                        disabled={publishStatus === "publishing"}
                      >
                        Tilbake
                      </PktButton>
                      <PktButton
                        skin="primary"
                        size="small"
                        onClick={handlePublish}
                        disabled={publishStatus === "publishing"}
                      >
                        {publishStatus === "publishing"
                          ? "Publiserer..."
                          : "Publiser til energinøkkelen.no"}
                      </PktButton>
                    </>
                  )}
                  {publishStatus === "success" && (
                    <PktButton skin="primary" size="small" onClick={handleClose}>
                      Lukk
                    </PktButton>
                  )}
                </div>
              )}
            </div>
          </PktStep>
        </PktStepper>
      </div>
    </PktModal>
  );
}

// Hjelpkomponent: Liste over drafts
function DraftsList({ drafts }: { drafts: DraftSummary[] }) {
  if (drafts.length === 0) {
    return (
      <p className="publish-wizard__empty">Ingen upubliserte endringer.</p>
    );
  }

  return (
    <ul className="publish-wizard__drafts-list">
      {drafts.map((draft) => (
        <li
          key={`${draft.collection}-${draft.id}`}
          className="publish-wizard__draft-item"
        >
          <div className="publish-wizard__draft-header">
            <span className="publish-wizard__draft-icon">📄</span>
            <strong>{draft.title}</strong>
            <span className="publish-wizard__draft-collection">
              ({draft.collection})
            </span>
          </div>
          {draft.changeSummary && (
            <p className="publish-wizard__draft-summary">
              "{draft.changeSummary}"
            </p>
          )}
          <p className="publish-wizard__draft-meta">
            Sist endret:{" "}
            {new Date(draft.updatedAt).toLocaleString("nb-NO", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

// Hjelpkomponent: QA-sjekkliste
function QAChecklist() {
  const [checks, setChecks] = useState({
    text: false,
    benefits: false,
    links: false,
    yellowList: false,
  });

  const handleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="publish-wizard__qa-checklist">
      <p className="publish-wizard__checklist-title">
        Sjekkliste før publisering:
      </p>
      <label className="publish-wizard__checkbox">
        <input
          type="checkbox"
          checked={checks.text}
          onChange={() => handleCheck("text")}
        />
        <span>Teksten vises korrekt i tiltakskortet</span>
      </label>
      <label className="publish-wizard__checkbox">
        <input
          type="checkbox"
          checked={checks.benefits}
          onChange={() => handleCheck("benefits")}
        />
        <span>Fordeler og støtteordninger er riktige</span>
      </label>
      <label className="publish-wizard__checkbox">
        <input
          type="checkbox"
          checked={checks.links}
          onChange={() => handleCheck("links")}
        />
        <span>Lenker fungerer</span>
      </label>
      <label className="publish-wizard__checkbox">
        <input
          type="checkbox"
          checked={checks.yellowList}
          onChange={() => handleCheck("yellowList")}
        />
        <span>Gul liste-varianten (hvis relevant) er sjekket</span>
      </label>
    </div>
  );
}
