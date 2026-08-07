import React, { RefObject, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { PktSearchInput, PktAlert, PktLoader } from '@oslokommune/punkt-react';
import { type AddressSuggestion } from '../../services/buildingApi';
import { useRotatingLoaderTips } from '../../hooks/useRotatingLoaderTips';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { MiniSkyline } from './MiniSkyline';
import { GENERIC_SUBTITLE_MOBILE, type TemaConfig } from '../../tema';

interface MobileLandingProps {
  /**
   * When true, the header content fades out via CSS transition.
   * This is a binary trigger: the actual fade animation is handled by CSS
   * (adding the `--fading` class), not by continuous opacity values.
   */
  headerShouldFadeOut: boolean;
  /**
   * When true, the skyline fades out via CSS transition.
   * This is a binary trigger: the actual fade animation is handled by CSS
   * (adding the `--fading` class), not by continuous opacity values.
   */
  skylineShouldFadeOut: boolean;
  searchValue: string;
  loading: boolean;
  error: Error | null;
  suggestions: AddressSuggestion[];
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
  suggestionsLoading: boolean;
  wrapperRef: RefObject<HTMLDivElement>;
  handleSearch: () => Promise<void>;
  handleInputChange: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  openSuggestions: () => void;
  highlightSuggestion: (index: number) => void;
  clearHighlightedSuggestion: () => void;
  /** Aktiv temavariant (/solceller m.fl.) — endrer undertittel og H1-struktur */
  tema?: TemaConfig | null;
}

export const MobileLanding: React.FC<MobileLandingProps> = ({
  headerShouldFadeOut,
  skylineShouldFadeOut,
  searchValue,
  loading,
  error,
  suggestions,
  showSuggestions,
  handleSearch,
  handleInputChange,
  handleSuggestionSelect,
  openSuggestions,
  tema,
}) => {
  const { tip: loaderTip, visible: loaderVisible, opacity: loaderOpacity } = useRotatingLoaderTips(loading);
  const inputRef = useRef<HTMLInputElement>(null);

  // Map AddressSuggestion[] to PktSearchInput's SearchSuggestion[]
  // Alltid array (aldri undefined): PktSearchInput setter aria-controls="<id>-suggestions"
  // uansett, og listbox-elementet må finnes i DOM for at verdien skal være gyldig (a11y).
  const pktSuggestions = (showSuggestions && suggestions.length > 0)
    ? suggestions.map((s) => ({
        text: s.adressetekst || s.adresse || '',
        onClick: () => {
          const displayValue = s.adresse ?? s.adressetekst ?? '';
          if (inputRef.current) {
            inputRef.current.value = displayValue;
          }
          handleSuggestionSelect(s);
        },
      }))
    : [];

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e.target.value);
  }, [handleInputChange]);

  const handlePktSearch = useCallback(() => {
    handleSearch();
  }, [handleSearch]);

  return (
    <div className="mobile-landing">
      <a
        href="https://www.oslo.kommune.no/personvern-og-informasjonskapsler/"
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-landing__privacy-link"
      >
        Personvern og informasjonskapsler
      </a>
      <div
        className={`mobile-landing__content${headerShouldFadeOut ? ' mobile-landing__content--fading' : ''}`}
      >
        {/* Logo */}
        <div className="mobile-landing__logo-container">
          <OsloLogo
            className="mobile-landing__logo"
            color="var(--pkt-color-brand-dark-blue-1000, #2A2859)"
          />
        </div>

        {/* Tittel — på temavarianter er undertittelen sidens H1 */}
        {tema ? (
          <>
            <p className="mobile-landing__title">Energinøkkelen</p>
            <h1 className="mobile-landing__subtitle">{tema.subtitle}</h1>
          </>
        ) : (
          <>
            <h1 className="mobile-landing__title">Energinøkkelen</h1>
            <p className="mobile-landing__subtitle">{GENERIC_SUBTITLE_MOBILE}</p>
          </>
        )}

        {/* Søkefelt */}
        <div className="mobile-landing__search-wrapper">
          <PktSearchInput
            id="mobile-address-search"
            appearance="global"
            fullwidth
            placeholder="Skriv inn adresse..."
            value={searchValue}
            disabled={loading}
            suggestions={pktSuggestions}
            onChange={handleChange}
            onSearch={handlePktSearch}
            onFocus={openSuggestions}
            ref={inputRef}
          />

          {/* Feilmelding med PktAlert */}
          {error && (
            <PktAlert skin="error" compact className="mobile-landing__error">
              {error.message}
            </PktAlert>
          )}
          {loaderVisible && (
            <div className="mobile-landing__loader" style={{ opacity: loaderOpacity }}>
              <PktLoader
                message={loaderTip}
                size="large"
                variant="rainbow"
                isLoading
              />
            </div>
          )}
        </div>
      </div>

      {/* Mini-skyline i bunnen */}
      <div
        className={`mobile-landing__skyline-container${skylineShouldFadeOut ? ' mobile-landing__skyline-container--fading' : ''}`}
        aria-hidden="true"
      >
        <MiniSkyline />
      </div>
    </div>
  );
};
