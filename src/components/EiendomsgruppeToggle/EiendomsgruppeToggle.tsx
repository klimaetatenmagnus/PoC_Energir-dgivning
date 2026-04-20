/**
 * EiendomsgruppeToggle — én PktButton som bytter mellom "denne boligen" og
 * "hele borettslaget/sameiet" på tiltaksvalg-siden.
 *
 * Mens aggregat-data fortsatt henter: vis PktLoader med "Henter data for X".
 * Når data er klart:
 *   - viewMode === 'enkelt' → primary-knapp "Vis for [navn]"
 *   - viewMode === 'gruppe' → secondary-knapp "Vis din bolig"
 */
import React from "react";
import { PktButton, PktLoader } from "@oslokommune/punkt-react";
import type { UseEiendomsgruppeState } from "../../hooks/useEiendomsgruppe.ts";
import { gruppenavn } from "../../utils/eiendomsgruppeFormat.ts";
import "./EiendomsgruppeToggle.css";

export type ViewMode = "enkelt" | "gruppe";

interface Props {
  state: UseEiendomsgruppeState;
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
  /**
   * Adresse brukeren søkte opp — brukes som fallback-navn for sameier
   * (typisk uten registrert navn): "Sameiet i [gatenavn]".
   */
  searchedAdresse?: string;
  /** Ikon for "Vis din bolig"-knappen — typisk 'home' for småhus eller 'organization' for blokk. */
  enkeltIcon?: string;
  /** Styrer fade-inn av toggle sammen med øvrige side-2-komponenter. */
  visible?: boolean;
}

export const EiendomsgruppeToggle: React.FC<Props> = ({
  state,
  viewMode,
  onChange,
  searchedAdresse,
  enkeltIcon = 'home',
  visible = true,
}) => {
  const visibilityClass = visible
    ? 'eiendomsgruppe-toggle--visible'
    : 'eiendomsgruppe-toggle--hidden';
  if (!state.shouldShowToggle || !state.detection) return null;
  const { detection, aggregat, aggregatLoading, aggregatError } = state;
  if (detection.type === "enkelt") return null;

  // Loader-tilstand mens aggregatet fortsatt hentes
  if (aggregatLoading || (!aggregat && !aggregatError)) {
    const loaderText =
      detection.type === "borettslag"
        ? `Henter data for ${detection.navn ?? "borettslaget"}`
        : `Henter data for ${gruppenavn("sameie", detection.navn, searchedAdresse)}`;
    return (
      <div className={`eiendomsgruppe-toggle eiendomsgruppe-toggle--loading ${visibilityClass}`}>
        <PktLoader size="medium" variant="rainbow" isLoading>
          <span />
        </PktLoader>
        <span className="eiendomsgruppe-toggle__loader-text">{loaderText}</span>
      </div>
    );
  }

  // Hvis aggregat feilet: skjul toggle silent
  if (aggregatError || !aggregat) return null;

  const navn = gruppenavn(detection.type, detection.navn, searchedAdresse);

  const gruppeIcon = detection.type === 'borettslag' ? 'organization' : 'home';

  if (viewMode === "enkelt") {
    return (
      <div className={`eiendomsgruppe-toggle ${visibilityClass}`}>
        <PktButton
          skin="primary"
          size="large"
          variant="icon-left"
          iconName={gruppeIcon}
          onClick={() => onChange("gruppe")}
        >
          Vis for {navn}
        </PktButton>
      </div>
    );
  }

  return (
    <div className={`eiendomsgruppe-toggle ${visibilityClass}`}>
      <PktButton
        skin="primary"
        size="large"
        variant="icon-left"
        iconName={enkeltIcon}
        onClick={() => onChange("enkelt")}
      >
        Vis din bolig
      </PktButton>
    </div>
  );
};
