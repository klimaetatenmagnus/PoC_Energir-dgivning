/**
 * useEiendomsgruppe — speculativ prefetch av borettslag/sameie-data.
 *
 * Kjører detektoren så snart (kommune, gnr, bnr) er tilgjengelig. Hvis
 * detektoren rapporterer "borettslag" eller "sameie", starter vi aggregeringen
 * umiddelbart i bakgrunnen. UI kan dermed vise loader-element mens data hentes.
 */
import { useEffect, useRef, useState } from "react";
import {
  buildingApi,
  type EiendomsgruppeDetection,
  type EiendomsgruppeResult,
} from "../services/buildingApi.ts";

/** Minimum antall enheter før vi vurderer det som en reell gruppe i UI. */
export const MIN_GRUPPESTORELSE_FOR_TOGGLE = 5;

export interface UseEiendomsgruppeArgs {
  kommunenummer?: string;
  gaardsnummer?: number;
  bruksnummer?: number;
  /** Slå av hook (f.eks. hvis bruker aldri landet på side 2). */
  enabled?: boolean;
}

export interface UseEiendomsgruppeState {
  detection: EiendomsgruppeDetection | null;
  detectionLoading: boolean;
  detectionError: string | null;
  aggregat: EiendomsgruppeResult | null;
  aggregatLoading: boolean;
  aggregatError: string | null;
  /**
   * Om gruppen er stor nok til at vi faktisk vil vise toggle i UI.
   * (Små 2-seksjons "sameier" blir hoppet over, jfr. MIN_GRUPPESTORELSE_FOR_TOGGLE)
   */
  shouldShowToggle: boolean;
}

const idle: UseEiendomsgruppeState = {
  detection: null,
  detectionLoading: false,
  detectionError: null,
  aggregat: null,
  aggregatLoading: false,
  aggregatError: null,
  shouldShowToggle: false,
};

export function useEiendomsgruppe(
  args: UseEiendomsgruppeArgs
): UseEiendomsgruppeState {
  const { kommunenummer, gaardsnummer, bruksnummer, enabled = true } = args;
  const [state, setState] = useState<UseEiendomsgruppeState>(idle);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !kommunenummer || !gaardsnummer || !bruksnummer) {
      setState(idle);
      return;
    }

    // Kanseler eventuell pågående kjede og start ny
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let cancelled = false;

    setState({
      ...idle,
      detectionLoading: true,
    });

    (async () => {
      try {
        const detection = await buildingApi.detekterEiendomsgruppe({
          kommunenummer,
          gaardsnummer,
          bruksnummer,
        });
        if (cancelled) return;

        const shouldShow =
          detection.type !== "enkelt" &&
          detection.antallEnheter >= MIN_GRUPPESTORELSE_FOR_TOGGLE;

        setState((prev) => ({
          ...prev,
          detection,
          detectionLoading: false,
          shouldShowToggle: shouldShow,
          aggregatLoading: shouldShow,
        }));

        if (!shouldShow) return;

        // Speculativ aggregat-fetch
        try {
          let aggregat: EiendomsgruppeResult;
          if (
            detection.type === "borettslag" &&
            detection.organisasjonsnummer
          ) {
            aggregat = await buildingApi.fetchBorettslagAggregat(
              detection.organisasjonsnummer
            );
          } else if (
            detection.type === "sameie" &&
            detection.matrikkelenhetRot
          ) {
            const m = detection.matrikkelenhetRot;
            aggregat = await buildingApi.fetchSameieAggregat(
              m.kommunenummer,
              m.gaardsnummer,
              m.bruksnummer
            );
          } else {
            throw new Error(
              `Detektoren mangler ID for ${detection.type}-oppslag`
            );
          }
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            aggregat,
            aggregatLoading: false,
          }));
        } catch (err) {
          if (cancelled) return;
          setState((prev) => ({
            ...prev,
            aggregatLoading: false,
            aggregatError: err instanceof Error ? err.message : String(err),
          }));
        }
      } catch (err) {
        if (cancelled) return;
        setState({
          ...idle,
          detectionError: err instanceof Error ? err.message : String(err),
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [kommunenummer, gaardsnummer, bruksnummer, enabled]);

  return state;
}
