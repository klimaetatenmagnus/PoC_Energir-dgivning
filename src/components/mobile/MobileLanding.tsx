import React, { RefObject } from 'react';
import type { KeyboardEvent } from 'react';
import { PktButton, PktAlert } from '@oslokommune/punkt-react';
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
  selectedSuggestionIndex,
  suggestionsLoading,
  wrapperRef,
  handleSearch,
  handleInputChange,
  handleKeyDown,
  handleSuggestionSelect,
  openSuggestions,
  highlightSuggestion,
  clearHighlightedSuggestion,
}) => {
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
          Søk på en adresse og se hvor mye du kan spare
        </p>

        {/* Søkefelt */}
        <div className="mobile-landing__search-wrapper" ref={wrapperRef}>
          <div className="mobile-landing__search-autocomplete">
            <div className="mobile-landing__search-input-group">
              <input
                id="mobile-address-search"
                type="text"
                placeholder="Skriv inn adresse..."
                className="pkt-input mobile-landing__search-input"
                value={searchValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={openSuggestions}
                disabled={loading}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && suggestions.length > 0}
                aria-controls="mobile-address-suggestions"
                aria-activedescendant={
                  selectedSuggestionIndex >= 0
                    ? `mobile-suggestion-${selectedSuggestionIndex}`
                    : undefined
                }
              />

              <PktButton
                skin="primary"
                size="medium"
                variant="icon-only"
                iconName="magnifying-glass-big"
                onClick={handleSearch}
                disabled={loading}
                aria-label="Søk"
                className="mobile-landing__search-button"
              />
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <ul
                id="mobile-address-suggestions"
                className="mobile-landing__suggestions"
                onMouseLeave={clearHighlightedSuggestion}
                role="listbox"
                aria-label="Adresseforslag"
              >
                {suggestionsLoading ? (
                  <li className="mobile-landing__suggestion mobile-landing__suggestion--loading">
                    Søker...
                  </li>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.adresse ?? suggestion.adressetekst ?? `suggestion-${index}`}
                      id={`mobile-suggestion-${index}`}
                      className={`mobile-landing__suggestion ${
                        index === selectedSuggestionIndex ? 'mobile-landing__suggestion--selected' : ''
                      }`}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      onMouseEnter={() => highlightSuggestion(index)}
                      role="option"
                      aria-selected={index === selectedSuggestionIndex}
                    >
                      {suggestion.adressetekst || suggestion.adresse}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          {/* Feilmelding med PktAlert */}
          {error && (
            <PktAlert skin="error" compact className="mobile-landing__error">
              {error.message}
            </PktAlert>
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
