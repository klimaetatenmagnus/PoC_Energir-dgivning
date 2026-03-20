import React, { RefObject, useRef, useCallback } from 'react';
import { PktSearchInput, PktLoader } from '@oslokommune/punkt-react';
import { type AddressSuggestion } from '../../services/buildingApi';
import { useRotatingLoaderTips } from '../../hooks/useRotatingLoaderTips';
import { OsloLogo } from './components/OsloLogo';
import { OsloSkyline } from './components/OsloSkyline';
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
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
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
  handleSearch,
  handleInputChange,
  handleSuggestionSelect,
  openSuggestions,
  isEnebolig,
  hasResult,
}) => {
  const { tip: loaderTip, visible: loaderVisible, opacity: loaderOpacity } = useRotatingLoaderTips(loading);
  const landingForeground = 'var(--pkt-color-brand-dark-blue-1000, #2A2859)';
  const pinnedEnebolig = hasResult ? isEnebolig : undefined;
  const pinnedBlock = hasResult ? !isEnebolig : undefined;
  const inputRef = useRef<HTMLInputElement>(null);

  // Map AddressSuggestion[] to PktSearchInput's SearchSuggestion[]
  // PktSearchInput is uncontrolled (uses defaultValue), so we must sync the
  // DOM input via ref when a suggestion is selected.
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
    <div className="landing">
      <a
        href="https://www.oslo.kommune.no/personvern-og-informasjonskapsler/"
        target="_blank"
        rel="noopener noreferrer"
        className="landing__privacy-link"
      >
        Personvern og informasjonskapsler
      </a>
      {/* Main content – centered above skyline */}
      <div className="landing__content-shell">
        <div
          className="landing__content"
          style={{
            opacity: headerFadeOpacity,
          }}
        >
          <div className="oslo-logo-container">
            <OsloLogo className="oslo-logo" color={landingForeground} />
          </div>

          <div className="energiportalen-header">
            <h1 className="energiportalen-title">Energinøkkelen</h1>
            <p className="energiportalen-subtitle">Søk opp adressen din, og se hvor mye du kan spare på energioppgraderinger</p>
          </div>

          <div className="landing__search">
            <PktSearchInput
              id="landing-search"
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
            {error && <div className="landing__error">{error.message}</div>}
            {loaderVisible && (
              <div className="landing__loader" style={{ opacity: loaderOpacity }}>
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
      </div>

      {/* Ground strip – grey area below skyline */}
      <div
        className="landing__ground"
        style={{
          opacity: skylineFadeOpacity,
          transition: 'opacity 1.5s ease-in-out',
        }}
      />

      {/* Skyline – positioned above the ground strip */}
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
          bottom: 'var(--landing-ground-height, clamp(24px, 4vh, 60px))',
          left: 0,
          width: '100%',
          height: 'auto',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
