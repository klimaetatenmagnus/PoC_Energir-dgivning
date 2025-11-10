import React, { RefObject } from 'react';
import type { KeyboardEvent } from 'react';
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
  const pinnedEnebolig = hasResult ? isEnebolig : undefined;
  const pinnedBlock = hasResult ? !isEnebolig : undefined;
  const artboardStyle: React.CSSProperties = {
    width: '1728px',
    height: '900px',
    background: '#034B45',
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
          background: '#034B45',
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
                <OsloLogo className="oslo-logo" />
              </div>

              <h1 className="energiportalen-title">Energinøkkelen</h1>

              <div className="figma-search-wrapper" ref={wrapperRef}>
                <label className="figma-search-label">Søk etter adresse</label>

                <div className="figma-search-autocomplete-wrapper">
                  <div className="figma-search-input-group">
                    <input
                      type="text"
                      placeholder="Skriv inn adresse..."
                      className="figma-search-input"
                      value={searchValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={openSuggestions}
                      disabled={loading}
                      autoComplete="off"
                    />

                    <button className="figma-search-button" onClick={handleSearch} disabled={loading}>
                      {loading ? (
                        <span className="loading-spinner-small">⟳</span>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
                            stroke="#FFFFFF"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>

                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="figma-search-suggestions" onMouseLeave={clearHighlightedSuggestion}>
                      {suggestionsLoading ? (
                        <li className="figma-search-suggestion figma-search-suggestion--loading">Søker...</li>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <li
                            key={suggestion.adresse ?? suggestion.adressetekst ?? `suggestion-${index}`}
                            className={`figma-search-suggestion ${
                              index === selectedSuggestionIndex ? 'figma-search-suggestion--selected' : ''
                            }`}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            onMouseEnter={() => highlightSuggestion(index)}
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
