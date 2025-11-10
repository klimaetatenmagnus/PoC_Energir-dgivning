// src/App.tsx
import React from "react";
import { FigmaMainScript } from "./components/FigmaMainScript";
import { FigmaLanding } from "./components/FigmaBlokk/FigmaLanding";
import { useFigmaAddressSearch } from "./hooks/useFigmaAddressSearch";

export default function App() {
  const {
    mode,
    searchValue,
    loading,
    error,
    result,
    suggestions,
    showSuggestions,
    selectedSuggestionIndex,
    suggestionsLoading,
    skylineFadeOpacity,
    headerFadeOpacity,
    wrapperRef,
    isEnebolig,
    handleSearch,
    handleInputChange,
    handleKeyDown,
    handleSuggestionSelect,
    openSuggestions,
    handleBack,
    highlightSuggestion,
    clearHighlightedSuggestion,
  } = useFigmaAddressSearch();

  // Special rendering for Figma blokk mode (handles both enebolig and blokk)
  if (mode === "figma-blokk" && result) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100vw', 
        height: '100vh', 
        backgroundColor: '#f5f5f5',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <FigmaMainScript
          searchAddress={searchValue}
          buildingData={result}
          onBack={handleBack}
        />
      </div>
    );
  }


// Special rendering for Figma mode - completely separate page
if (mode === "figma") {
  return (
      <FigmaLanding
        headerFadeOpacity={headerFadeOpacity}
        skylineFadeOpacity={skylineFadeOpacity}
        searchValue={searchValue}
      loading={loading}
      error={error}
      suggestions={suggestions}
      showSuggestions={showSuggestions}
      selectedSuggestionIndex={selectedSuggestionIndex}
      suggestionsLoading={suggestionsLoading}
      wrapperRef={wrapperRef}
      handleSearch={handleSearch}
      handleInputChange={handleInputChange}
      handleKeyDown={handleKeyDown}
      handleSuggestionSelect={handleSuggestionSelect}
      openSuggestions={openSuggestions}
      highlightSuggestion={highlightSuggestion}
      clearHighlightedSuggestion={clearHighlightedSuggestion}
    />
  );
}

  return null;
}
