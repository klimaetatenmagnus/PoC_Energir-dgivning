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

const FADE_DURATION_MS = 2000;
const DEBOUNCE_DELAY_MS = 300;

type FigmaMode = 'figma' | 'figma-blokk';

interface TestTrigger {
  address: string;
  result: AddressLookupResponse;
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
  wrapperRef: RefObject<HTMLDivElement>;
  isEnebolig: boolean;
  handleSearch: () => Promise<void>;
  handleInputChange: (value: string) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  handleSuggestionSelect: (suggestion: AddressSuggestion) => void;
  openSuggestions: () => void;
  handleBack: () => void;
  highlightSuggestion: (index: number) => void;
  clearHighlightedSuggestion: () => void;
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

  const { skylineFadeOpacity, headerFadeOpacity, startFade, resetFade } = useLandingAnimation({
    durationMs: FADE_DURATION_MS,
    onFadeComplete: () => setMode('figma-blokk'),
  });

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
      startFade();
      return true;
    },
    [startFade]
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
      startFade();
    } catch (lookupError) {
      setResult(null);
      setMode('figma');
      resetFade();
      setError(lookupError instanceof Error ? lookupError : new Error('Ukjent feil'));
    } finally {
      setLoading(false);
    }
  }, [resetFade, searchValue, startFade]);

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
    setMode('figma');
    setResult(null);
    setSearchValue('');
    setError(null);
    resetFade();
  }, [resetFade]);

  const isEnebolig = useMemo(() => {
    if (!result) {
      return false;
    }

    const csvType = result.csvData?.bygningstypeNavn?.toLowerCase();
    if (csvType) {
      return (
        csvType.includes('enebolig') ||
        csvType.includes('tomannsbolig') ||
        csvType.includes('rekkehus')
      );
    }

    const buildingTypeCode = result.bygningstypeKode;
    if (buildingTypeCode) {
      const code = Number.parseInt(buildingTypeCode, 10);
      return Number.isInteger(code) && code >= 110 && code < 140;
    }

    const buildingTypeId = result.bygningstypeKodeId;
    if (buildingTypeId) {
      return [1, 4, 5, 8].includes(buildingTypeId);
    }

    return false;
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
  };
}
