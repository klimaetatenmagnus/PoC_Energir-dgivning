import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import {
  buildingApi,
  type AddressLookupResponse,
  type AddressSuggestion,
} from '../services/buildingApi';
import { LYSEVEIEN_3_DATA } from '../testData/lyseveien3';
import { THERESES_11A_DATA } from '../testData/theresegate11a';
import { THERESES_44A_DATA } from '../testData/theresegate44a';
import { useLandingAnimation } from '../components/FigmaBlokk/hooks/useLandingAnimation';
import { computeFigmaViewportMetrics, DESIGN_HEIGHT, DESIGN_WIDTH } from '../components/FigmaBlokk/hooks/useFigmaViewportMetrics';
import { BuildingKind } from '../context/TransitionOverlayTypes';
import { useTransitionOverlay } from '../context/useTransitionOverlay';
import { useResponsive } from './useResponsive';
import { getBuildingKind as getBuildingKindFromUtils, isEneboligBuilding } from '../utils/buildingTypeUtils';

const FADE_DURATION_MS = 2000;
const DEBOUNCE_DELAY_MS = 300;

type FigmaMode = 'figma' | 'figma-blokk';

interface TestTrigger {
  address: string;
  result: AddressLookupResponse;
}

export interface BuildingSnapshot {
  left: number;
  bottom: number;
  width: number;
  height: number;
  viewport: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export interface LandingSnapshot {
  enebolig?: BuildingSnapshot;
  blokk?: BuildingSnapshot;
}

interface UseFigmaAddressSearchResult {
  mode: FigmaMode;
  searchValue: string;
  loading: boolean;
  error: Error | null;
  result: AddressLookupResponse | null;
  suggestions: AddressSuggestion[];
  showSuggestions: boolean;
  selectedSuggestionIndex: number;
  suggestionsLoading: boolean;
  skylineFadeOpacity: number;
  headerFadeOpacity: number;
  wrapperRef: RefObject<HTMLDivElement | null>;
  isEnebolig: boolean;
  handleSearch: () => Promise<void>;
  handleInputChange: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  openSuggestions: () => void;
  handleBack: () => void;
  highlightSuggestion: (index: number) => void;
  clearHighlightedSuggestion: () => void;
  landingSnapshot: LandingSnapshot | null;
}

const TEST_TRIGGERS: Record<string, TestTrigger> = {
  '1': {
    address: 'Lyseveien 3, 0362 OSLO',
    result: LYSEVEIEN_3_DATA.buildingData as AddressLookupResponse,
  },
  '2': {
    address: 'Thereses gate 11A, 0358 OSLO',
    result: THERESES_11A_DATA.buildingData as AddressLookupResponse,
  },
  '3': {
    address: 'Thereses gate 44A, 0168 OSLO',
    result: THERESES_44A_DATA.buildingData as AddressLookupResponse,
  },
};

/**
 * Check if a building result should be classified as 'enebolig'
 * Delegates to shared utility for consistent classification
 */
const isEneboligResult = (building: AddressLookupResponse): boolean =>
  isEneboligBuilding(building);

/**
 * Determine BuildingKind from building data
 * Delegates to shared utility for consistent classification
 */
const getBuildingKind = (building: AddressLookupResponse): BuildingKind =>
  getBuildingKindFromUtils(building);

export function useFigmaAddressSearch(): UseFigmaAddressSearchResult {
  const [mode, setMode] = useState<FigmaMode>('figma');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<AddressLookupResponse | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const [landingSnapshot, setLandingSnapshot] = useState<LandingSnapshot | null>(null);
  const [fadeCompleted, setFadeCompleted] = useState(false);
  const { beginTransition, forceReset: resetOverlay } = useTransitionOverlay();
  const { isMobileView } = useResponsive();

  const { skylineFadeOpacity, headerFadeOpacity, startFade, resetFade } = useLandingAnimation({
    durationMs: FADE_DURATION_MS,
    onFadeComplete: () => setFadeCompleted(true),
  });

  const captureLandingSnapshot = useCallback((buildingKind: BuildingKind) => {
    if (typeof window === 'undefined') {
      return;
    }

    requestAnimationFrame(() => {
      // Mobile: direct viewport capture without Figma scaling
      if (isMobileView) {
        const eneboligEl = document.getElementById('mobile-anim-enebolig');
        const blokkEl = document.getElementById('mobile-anim-blokk');

        const selectedEl = buildingKind === 'enebolig' ? eneboligEl : blokkEl;
        if (!selectedEl) {
          // Element not found - log warning in development and reset state to avoid ambiguous intermediate phase
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              `[useFigmaAddressSearch] Expected mobile building element not found: mobile-anim-${buildingKind}. ` +
              `Skipping transition animation and resetting landing snapshot.`
            );
          }
          // Reset landing snapshot to keep UI consistent, skip beginTransition
          setLandingSnapshot(null);
          return;
        }

        const rect = selectedEl.getBoundingClientRect();
        beginTransition({
          buildingType: buildingKind,
          startRect: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
          isMobile: true,
        });

        // Store snapshot for consistency
        const snapshot: BuildingSnapshot = {
          left: rect.left,
          bottom: window.innerHeight - rect.bottom,
          width: rect.width,
          height: rect.height,
          viewport: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        };
        setLandingSnapshot({
          [buildingKind]: snapshot,
        });
        return;
      }

      // Desktop: existing Figma artboard logic
      const metrics = computeFigmaViewportMetrics();
      const { scaleFactor } = metrics;
      if (scaleFactor <= 0) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const artboardWidth = DESIGN_WIDTH * scaleFactor;
      const artboardHeight = DESIGN_HEIGHT * scaleFactor;
      const artboardLeft = viewportWidth / 2 - artboardWidth / 2;
      const artboardTop = viewportHeight / 2 - artboardHeight / 2;

      const toDesignCoords = (rect: DOMRect): BuildingSnapshot => {
        const left = (rect.left - artboardLeft) / scaleFactor;
        const top = (rect.top - artboardTop) / scaleFactor;
        const width = rect.width / scaleFactor;
        const height = rect.height / scaleFactor;
        const bottom = DESIGN_HEIGHT - (top + height);
        return {
          left,
          bottom,
          width,
          height,
          viewport: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          },
        };
      };

      const eneboligEl = document.getElementById('landing-enebolig');
      const blokkEl = document.getElementById('landing-blokk');

      const nextSnapshot: LandingSnapshot = {
        enebolig: eneboligEl ? toDesignCoords(eneboligEl.getBoundingClientRect()) : undefined,
        blokk: blokkEl ? toDesignCoords(blokkEl.getBoundingClientRect()) : undefined,
      };

      setLandingSnapshot(nextSnapshot);

      const selectedSnapshot =
        buildingKind === 'enebolig' ? nextSnapshot.enebolig : nextSnapshot.blokk;
      if (selectedSnapshot?.viewport) {
        beginTransition({
          buildingType: buildingKind,
          startRect: selectedSnapshot.viewport,
        });
      }
    });
  }, [beginTransition, isMobileView]);

  const beginLandingTransition = useCallback((buildingKind: BuildingKind) => {
    setFadeCompleted(false);
    captureLandingSnapshot(buildingKind);
    startFade();
  }, [captureLandingSnapshot, startFade]);

  useEffect(() => {
    if (!fadeCompleted) {
      return;
    }

    if (landingSnapshot) {
      setMode('figma-blokk');
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setMode('figma-blokk');
    }, 200);

    return () => window.clearTimeout(fallbackTimer);
  }, [fadeCompleted, landingSnapshot]);

  const clearTimers = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (mode !== 'figma') {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) {
        return;
      }

      if (!wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mode]);

  const handleSuggestionSelect = useCallback((suggestion: AddressSuggestion) => {
    setSearchValue(suggestion.adresse ?? suggestion.adressetekst ?? '');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setError(null);
  }, []);

  const highlightSuggestion = useCallback((index: number) => {
    setSelectedSuggestionIndex(index);
  }, []);

  const clearHighlightedSuggestion = useCallback(() => {
    setSelectedSuggestionIndex(-1);
  }, []);

  const applyTestTrigger = useCallback(
    (value: string): boolean => {
      const trigger = TEST_TRIGGERS[value];
      if (!trigger) {
        return false;
      }

      setSearchValue(trigger.address);
      setResult(trigger.result);
      setError(null);
      beginLandingTransition(getBuildingKind(trigger.result));
      return true;
    },
    [beginLandingTransition]
  );

  const fetchSuggestions = useCallback(
    async (query: string) => {
      setSuggestionsLoading(true);
      try {
        const nextSuggestions = await buildingApi.fetchSuggestions(query);
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
      } catch {
        // Vi skjuler forslag ved feil, men lar hovedsøket fortsette
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSuggestionsLoading(false);
      }
    },
    []
  );

  const handleInputChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (error) {
        setError(null);
      }
      setSelectedSuggestionIndex(-1);

      if (applyTestTrigger(value)) {
        return;
      }

      if (value.length < 3) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        fetchSuggestions(value);
      }, DEBOUNCE_DELAY_MS);
    },
    [applyTestTrigger, error, fetchSuggestions]
  );

  const handleSearch = useCallback(async () => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const lookupResult = await buildingApi.lookupAddress(trimmed);
      setResult(lookupResult);
      beginLandingTransition(getBuildingKind(lookupResult));
    } catch (lookupError) {
      setResult(null);
      setMode('figma');
      resetFade();
      setError(lookupError instanceof Error ? lookupError : new Error('Ukjent feil'));
    } finally {
      setLoading(false);
    }
  }, [beginLandingTransition, resetFade, searchValue]);

  const handleSuggestionsNavigation = useCallback(
    (direction: 1 | -1) => {
      setSelectedSuggestionIndex((previous) => {
        if (direction === 1) {
          const nextIndex = previous + 1;
          return nextIndex < suggestions.length ? nextIndex : previous;
        }

        const nextIndex = previous - 1;
        return nextIndex >= 0 ? nextIndex : -1;
      });
    },
    [suggestions.length]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (event.key === 'Enter') {
          handleSearch();
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          handleSuggestionsNavigation(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          handleSuggestionsNavigation(-1);
          break;
        case 'Enter':
          if (selectedSuggestionIndex >= 0) {
            event.preventDefault();
            const selectedSuggestion = suggestions[selectedSuggestionIndex];
            handleSuggestionSelect(selectedSuggestion);
          } else {
            handleSearch();
          }
          break;
        case 'Escape':
          setShowSuggestions(false);
          clearHighlightedSuggestion();
          break;
        default:
          break;
      }
    },
    [
      handleSearch,
      handleSuggestionSelect,
      handleSuggestionsNavigation,
      clearHighlightedSuggestion,
      selectedSuggestionIndex,
      showSuggestions,
      suggestions,
    ]
  );

  const handleBack = useCallback(() => {
    resetOverlay();
    setMode('figma');
    setResult(null);
    setSearchValue('');
    setError(null);
    setLandingSnapshot(null);
    setFadeCompleted(false);
    resetFade();
  }, [resetOverlay, resetFade]);

  const isEnebolig = useMemo(() => {
    if (!result) {
      return false;
    }
    return isEneboligResult(result);
  }, [result]);

  const openSuggestions = useCallback(() => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]);

  return {
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
    landingSnapshot,
  };
}
