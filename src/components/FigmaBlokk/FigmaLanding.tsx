import React, { RefObject } from 'react';
import type { KeyboardEvent } from 'react';
import { PktButton } from '@oslokommune/punkt-react';
import { type AddressSuggestion } from '../../services/buildingApi';
import { OsloLogo } from './components/OsloLogo';
import { OsloSkyline } from './components/OsloSkyline';
import { useFigmaViewportMetrics } from './hooks/useFigmaViewportMetrics';
import { SKYLINE_LIGHTS_ENABLED } from './constants';

interface FigmaLandingProps {
  headerFadeOpacity: number;
  skylineFadeOpacity: number;
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
  isEnebolig: boolean;
  hasResult: boolean;
}

export const FigmaLanding: React.FC<FigmaLandingProps> = ({
  headerFadeOpacity,
  skylineFadeOpacity,
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
  isEnebolig,
  hasResult,
}) => {
  const { scaleFactor, verticalOffset } = useFigmaViewportMetrics();
  const groundFillHeight = Math.max(verticalOffset, 0);
  const groundFillColor = 'var(--pkt-color-grays-gray-100, #F7F5F0)';
  const landingBackground = 'var(--pkt-color-brand-blue-300, #D1F9FF)';
  const landingForeground = 'var(--pkt-color-brand-dark-blue-1000, #2A2859)';
  const pinnedEnebolig = hasResult ? isEnebolig : undefined;
  const pinnedBlock = hasResult ? !isEnebolig : undefined;
  const artboardStyle: React.CSSProperties = {
    width: '1728px',
    height: '900px',
    background: landingBackground,
    boxSizing: 'border-box',
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: `translate(-50%, -50%) scale(${scaleFactor})`,
    transformOrigin: 'center',
    zIndex: 2,
    overflow: 'visible',
  };

  return (
    <>
      <div
        className="figma-design-container"
        style={{
          background: landingBackground,
          minHeight: '100vh',
          width: '100vw',
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Scaled content container */}
        <div style={artboardStyle}>
          <div className="figma-content">
            <div
              className="figma-search-container"
              style={{
                opacity: headerFadeOpacity,
                transition: 'opacity 1.5s ease-in-out',
              }}
            >
              <div className="oslo-logo-container">
                <OsloLogo className="oslo-logo" color={landingForeground} />
              </div>

              <div className="energiportalen-header">
                <h1 className="energiportalen-title">Energinøkkelen</h1>
                <p className="energiportalen-subtitle">Søk på en adresse, og se hvor mye du kan spare</p>
              </div>

              <div
                className="figma-search-wrapper pkt-searchinput pkt-searchinput--global"
                ref={wrapperRef}
                role="search"
              >
                <div className="figma-search-autocomplete-wrapper">
                  <div className="figma-search-input-group pkt-searchinput__field">
                    <input
                      type="search"
                      placeholder="Skriv inn adresse..."
                      className="pkt-input figma-search-input"
                      value={searchValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={openSuggestions}
                      disabled={loading}
                      autoComplete="off"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={showSuggestions && suggestions.length > 0}
                      aria-controls="figma-address-suggestions"
                      aria-activedescendant={
                        selectedSuggestionIndex >= 0
                          ? `figma-suggestion-${selectedSuggestionIndex}`
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
                      className="figma-search-button pkt-searchinput__button"
                    />
                  </div>

                  {showSuggestions && suggestions.length > 0 && (
                    <ul
                      id="figma-address-suggestions"
                      className="figma-search-suggestions pkt-searchinput__suggestions"
                      onMouseLeave={clearHighlightedSuggestion}
                      role="listbox"
                      aria-label="Adresseforslag"
                    >
                      {suggestionsLoading ? (
                        <li className="figma-search-suggestion pkt-searchinput__suggestion figma-search-suggestion--loading">
                          Søker...
                        </li>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <li
                            key={suggestion.adresse ?? suggestion.adressetekst ?? `suggestion-${index}`}
                            id={`figma-suggestion-${index}`}
                            className={`figma-search-suggestion pkt-searchinput__suggestion ${
                              index === selectedSuggestionIndex ? 'figma-search-suggestion--selected' : ''
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

                {error && <div className="figma-error-message">{error.message}</div>}
              </div>
            </div>
          </div>
          <OsloSkyline
            fadeOpacity={skylineFadeOpacity}
            blockTransform="translate(0, 0)"
            hideBlockAnimation={false}
            viewBox="0 -10 1728 362"
            preserveAspectRatio="xMidYMax slice"
            enableLights={SKYLINE_LIGHTS_ENABLED}
            pinEnebolig={pinnedEnebolig}
            pinBlock={pinnedBlock}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '1728px',
              height: 'auto',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {groundFillHeight > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${groundFillHeight}px`,
            backgroundColor: groundFillColor,
            zIndex: 1,
            pointerEvents: 'none',
            opacity: skylineFadeOpacity,
            transition: 'opacity 1.5s ease-in-out',
          }}
        />
      )}
    </>
  );
};
