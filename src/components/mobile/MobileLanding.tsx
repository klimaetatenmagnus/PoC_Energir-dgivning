import React, { RefObject, useRef, useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import { PktSearchInput, PktAlert, PktLoader } from '@oslokommune/punkt-react';
import { type AddressSuggestion } from '../../services/buildingApi';
import { OsloLogo } from '../FigmaBlokk/components/OsloLogo';
import { MiniSkyline } from './MiniSkyline';

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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Map AddressSuggestion[] to PktSearchInput's SearchSuggestion[]
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
    : undefined;

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleInputChange(e.target.value);
  }, [handleInputChange]);

  const handlePktSearch = useCallback(() => {
    handleSearch();
  }, [handleSearch]);

  return (
    <div className="mobile-landing">
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

        {/* Tittel */}
        <h1 className="mobile-landing__title">Energinøkkelen</h1>
        <p className="mobile-landing__subtitle">
          Søk på en adresse og se hvor mye du kan spare på energioppgraderinger
        </p>

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
          {loading && (
            <div className="mobile-landing__loader">
              <PktLoader
                message="Henter boliginformasjon..."
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
