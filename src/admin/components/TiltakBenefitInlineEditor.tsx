import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PktAlert,
  PktButton,
  PktSelect,
  PktTag,
  PktTextinput,
} from "@oslokommune/punkt-react";
import { useAdminDictionary } from "../context/AdminDictionaryContext";
import {
  fetchTiltakMetadata,
  updateTiltakBenefitRefs,
} from "../api/adminApiClient";
import type {
  AdminBenefitDictionaryEntry,
  AdminTiltakMetadata,
} from "../types";

const MAX_BENEFITS = 4;

type Props = {
  tiltakId: string;
  onSaved?: () => void;
};

export function TiltakBenefitInlineEditor({ tiltakId, onSaved }: Props) {
  const { dictionary } = useAdminDictionary();
  const [metadata, setMetadata] = useState<AdminTiltakMetadata | null>(null);
  const [draftRefs, setDraftRefs] = useState<string[]>([]);
  const [changeSummary, setChangeSummary] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedRef, setSelectedRef] = useState("");

  const loadMetadata = useCallback(async () => {
    if (!tiltakId) {
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const response = await fetchTiltakMetadata(tiltakId);
      setMetadata(response);
      setDraftRefs(response.benefitRefs ?? []);
      setChangeSummary("");
      setStatus("idle");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunne ikke hente metadata."
      );
      setStatus("error");
    }
  }, [tiltakId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const selectedBenefits = useMemo(() => {
    if (!dictionary) {
      return [];
    }
    const lookup = new Map(
      dictionary.benefits.map((entry) => [entry.id, entry] as const)
    );
    return draftRefs.map(
      (id) =>
        lookup.get(id) ?? {
          id,
          title: id,
          description: "",
          icon: undefined,
          tags: [],
        }
    );
  }, [dictionary, draftRefs]);

  const availableBenefits = useMemo(() => {
    if (!dictionary) {
      return [];
    }
    const taken = new Set(draftRefs);
    return dictionary.benefits
      .filter((entry) => !taken.has(entry.id))
      .sort((a, b) => a.title.localeCompare(b.title, "nb"));
  }, [dictionary, draftRefs]);

  const refsChanged = useMemo(() => {
    const original = metadata?.benefitRefs ?? [];
    if (original.length !== draftRefs.length) {
      return true;
    }
    return original.some((ref, index) => ref !== draftRefs[index]);
  }, [metadata?.benefitRefs, draftRefs]);

  const canSave =
    Boolean(metadata?.generation) &&
    refsChanged &&
    draftRefs.length <= MAX_BENEFITS &&
    status !== "saving";

  const handleRemove = (id: string) => {
    setDraftRefs((current) => current.filter((entry) => entry !== id));
  };

  const moveBenefit = (from: number, to: number) => {
    setDraftRefs((current) => {
      const next = [...current];
      const [entry] = next.splice(from, 1);
      next.splice(to, 0, entry);
      return next;
    });
  };

  const handleAddBenefit = () => {
    if (!selectedRef || draftRefs.includes(selectedRef)) {
      return;
    }
    setDraftRefs((current) => [...current, selectedRef].slice(0, MAX_BENEFITS));
    setSelectedRef("");
    setShowAddForm(false);
  };

  const handleSave = async () => {
    if (!metadata?.generation || !canSave) {
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const response = await updateTiltakBenefitRefs(tiltakId, {
        benefitRefs: draftRefs,
        generation: metadata.generation,
        changeSummary: changeSummary.trim() || undefined,
      });
      setMetadata((previous) =>
        previous
          ? {
              ...previous,
              benefitRefs: response.benefitRefs,
              metadata: response.metadata,
              generation: response.generation,
            }
          : {
              id: response.id,
              path: response.path,
              benefitRefs: response.benefitRefs,
              metadata: response.metadata,
              generation: response.generation,
              etag: null,
            }
      );
      setDraftRefs(response.benefitRefs);
      setChangeSummary("");
      setStatus("idle");
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kunne ikke lagre fordelene."
      );
      setStatus("error");
    }
  };

  const updatedLabel = useMemo(() => {
    const updatedAt = metadata?.metadata?.updatedAt;
    if (!updatedAt) {
      return null;
    }
    try {
      return new Intl.DateTimeFormat("nb-NO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(updatedAt));
    } catch {
      return updatedAt;
    }
  }, [metadata?.metadata?.updatedAt]);

  return (
    <section className="benefit-inline">
      <div className="benefit-inline__header">
        <div>
          <p className="benefit-inline__eyebrow">Fordeler i tiltakskortet</p>
          <p className="benefit-inline__helper">
            Velg inntil fire kort fra ordboken. Rekkefølgen nedenfor er lik
            rekkefølgen i tiltakskortet.
          </p>
        </div>
        <div className="benefit-inline__actions">
          <PktButton
            size="small"
            variant="label-only"
            onClick={loadMetadata}
            disabled={status === "loading" || status === "saving"}
          >
            Oppdater fra lagring
          </PktButton>
          <PktTag skin="gray" variant="outline">
            Maks {MAX_BENEFITS} fordeler
          </PktTag>
        </div>
      </div>

      {status === "loading" && (
        <PktAlert skin="info" title="Laster fordeler" ariaLive="polite">
          Henter metadata for {tiltakId} …
        </PktAlert>
      )}

      {error && (
        <PktAlert skin="error" title="Kunne ikke hente fordeler" ariaLive="assertive">
          {error}
        </PktAlert>
      )}

      {!dictionary && (
        <PktAlert skin="warning" ariaLive="polite">
          Ordboken er ikke klar ennå. Fordeler kan ikke redigeres før den er
          lastet inn.
        </PktAlert>
      )}

      <div className="benefit-inline__grid">
        {selectedBenefits.map((entry, index) => (
          <article key={`${entry.id}-${index}`} className="benefit-inline__card">
            <div className="benefit-inline__card-head">
              <p className="benefit-inline__card-title">{entry.title}</p>
              <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                {index > 0 && (
                  <PktButton
                    size="xsmall"
                    variant="ghost"
                    onClick={() => moveBenefit(index, index - 1)}
                  >
                    Opp
                  </PktButton>
                )}
                {index < draftRefs.length - 1 && (
                  <PktButton
                    size="xsmall"
                    variant="ghost"
                    onClick={() => moveBenefit(index, index + 1)}
                  >
                    Ned
                  </PktButton>
                )}
                <PktButton
                  size="xsmall"
                  variant="ghost"
                  className="benefit-inline__remove"
                  onClick={() => handleRemove(entry.id)}
                >
                  Fjern
                </PktButton>
              </div>
            </div>
            <p className="benefit-inline__description">
              {entry.description || "Ingen beskrivelse i dictionaryen."}
            </p>
          </article>
        ))}

        {draftRefs.length < MAX_BENEFITS && (
          <button
            type="button"
            className="benefit-inline__placeholder"
            onClick={() => setShowAddForm(true)}
            disabled={!dictionary || status === "saving"}
          >
            <span className="benefit-inline__placeholder-icon">+</span>
            <span className="benefit-inline__placeholder-text">
              Legg til fordel
            </span>
          </button>
        )}
      </div>

      {showAddForm && dictionary && (
        <div className="benefit-inline__add">
          <PktSelect
            id={`benefit-add-${tiltakId}`}
            label="Velg fordel"
            fullwidth
            value={selectedRef}
            onChange={(event) => setSelectedRef(event.target.value)}
          >
            <option value="">Velg fordel</option>
            {availableBenefits.map((benefit) => (
              <option key={benefit.id} value={benefit.id}>
                {benefit.title}
              </option>
            ))}
          </PktSelect>
          <div className="benefit-inline__add-actions">
            <PktButton
              size="small"
              onClick={handleAddBenefit}
              disabled={!selectedRef}
            >
              Legg til
            </PktButton>
            <PktButton
              size="small"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setSelectedRef("");
              }}
            >
              Avbryt
            </PktButton>
          </div>
        </div>
      )}

      <div className="benefit-inline__meta">
        <PktTextinput
          id={`benefit-summary-${tiltakId}`}
          label="Beskriv endringen (valgfritt)"
          value={changeSummary}
          maxLength={280}
          onChange={(event) => setChangeSummary(event.target.value)}
          placeholder="Eksempel: Oppdatert fordeler etter QA"
          fullwidth
        />
        <div className="benefit-inline__add-actions">
          <PktButton size="small" onClick={handleSave} disabled={!canSave}>
            {status === "saving" ? "Lagrer …" : "Lagre fordeler"}
          </PktButton>
          <PktButton
            size="small"
            variant="ghost"
            onClick={() => {
              setDraftRefs(metadata?.benefitRefs ?? []);
              setChangeSummary("");
            }}
            disabled={!refsChanged || status === "saving"}
          >
            Tilbakestill
          </PktButton>
        </div>
        {metadata?.metadata && (
          <p className="benefit-inline__helper">
            Sist oppdatert{" "}
            {updatedLabel ?? "ukjent tidspunkt"}
            {metadata.metadata.updatedBy
              ? ` av ${metadata.metadata.updatedBy}`
              : ""}
          </p>
        )}
      </div>
    </section>
  );
}
