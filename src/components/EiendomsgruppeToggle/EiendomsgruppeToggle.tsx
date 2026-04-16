/**
 * EiendomsgruppeToggle — lar brukeren bytte mellom "denne boligen" og
 * "hele borettslaget/sameiet" på tiltaksvalg-siden.
 *
 * Mens aggregat-data fortsatt henter: vis PktLoader med "Henter data for X".
 * Når data er klart: vis Punkt-inspirert to-valgs-toggle.
 */
import React from "react";
import { PktLoader } from "@oslokommune/punkt-react";
import type { UseEiendomsgruppeState } from "../../hooks/useEiendomsgruppe.ts";
import "./EiendomsgruppeToggle.css";

export type ViewMode = "enkelt" | "gruppe";

interface Props {
  state: UseEiendomsgruppeState;
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** Teksten på "enkelt"-knappen. Default "Denne boligen". */
  enkeltLabel?: string;
}

function grupperingEtikett(
  type: "borettslag" | "sameie",
  antall: number,
  navn?: string
): string {
  const typeOrd = type === "borettslag" ? "borettslaget" : "sameiet";
  if (navn) {
    return `Hele ${navn.replace(/\s+Borettslag$/i, "")} ${typeOrd} (${antall})`;
  }
  return `Hele ${typeOrd} (${antall})`;
}

function loaderEtikett(
  type: "borettslag" | "sameie",
  navn?: string
): string {
  if (navn) return `Henter data for ${navn}`;
  return type === "borettslag"
    ? "Henter data for borettslaget"
    : "Henter data for sameiet";
}

export const EiendomsgruppeToggle: React.FC<Props> = ({
  state,
  viewMode,
  onChange,
  enkeltLabel = "Denne boligen",
}) => {
  // Vis ingen toggle hvis detektoren ikke fant en reell gruppe
  if (!state.shouldShowToggle || !state.detection) {
    return null;
  }

  const { detection, aggregat, aggregatLoading, aggregatError } = state;
  if (detection.type === "enkelt") return null;

  const gruppeLabel = grupperingEtikett(
    detection.type,
    detection.antallEnheter,
    detection.navn
  );

  // Loader-tilstand mens aggregatet fortsatt hentes
  if (aggregatLoading || (!aggregat && !aggregatError)) {
    return (
      <div className="eiendomsgruppe-toggle eiendomsgruppe-toggle--loading">
        <PktLoader
          message={loaderEtikett(detection.type, detection.navn)}
          size="small"
          variant="rainbow"
          isLoading
        >
          <span />
        </PktLoader>
      </div>
    );
  }

  // Hvis aggregat feilet: skjul toggle silent (UX: brukeren ser bare enkeltbolig)
  if (aggregatError || !aggregat) {
    return null;
  }

  return (
    <div
      className="eiendomsgruppe-toggle"
      role="tablist"
      aria-label="Bytt mellom enkeltbolig og hele gruppen"
    >
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "enkelt"}
        className={`eiendomsgruppe-toggle__option ${
          viewMode === "enkelt" ? "eiendomsgruppe-toggle__option--active" : ""
        }`}
        onClick={() => onChange("enkelt")}
      >
        {enkeltLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === "gruppe"}
        className={`eiendomsgruppe-toggle__option ${
          viewMode === "gruppe" ? "eiendomsgruppe-toggle__option--active" : ""
        }`}
        onClick={() => onChange("gruppe")}
      >
        {gruppeLabel}
      </button>
    </div>
  );
};
