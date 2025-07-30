// src/App.tsx
import { useState, useEffect, useRef } from "react";
import type { House } from "./types/House";
import DebugDataTable from "./components/DebugDataTable";
import useBuildingInfo from "./hooks/useBuildingInfo";
import { AddressSearch } from "./components/AddressSearch";
import { ResultsTable } from "./components/ResultsTable";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { ErrorDisplay } from "./components/ErrorDisplay";
import { buildingApi } from "./services/buildingApi";
import { PktButton } from "@oslokommune/punkt-react";
import { EnergyRatingEstimator } from "./components/EnergyRatingEstimator";
import { FigmaEnebolig } from "./components/FigmaEnebolig";
import { FigmaBlokk } from "./components/FigmaBlokk_temp";

/* ------------------------------------------------------------------ */
/*  Konstanter                                                        */
/* ------------------------------------------------------------------ */
const DEFAULT_ADDRESS = "Kapellveien 156C, 0493 Oslo";

/* ------------------------------------------------------------------ */
/*  App – starter i diagnose-modus                                    */
/* ------------------------------------------------------------------ */
export default function App() {
  const [adresse, setAdresse] = useState(DEFAULT_ADDRESS);
  const [mode, setMode] = useState<"debug" | "wizard" | "lookup" | "figma" | "figma-enebolig" | "figma-blokk">("lookup");

  /* 1. Bygg-/Enova-/sol-data  */
  const { data: lookupData, error } = useBuildingInfo(mode === "debug" || mode === "wizard" ? adresse : "");

  /* 2. house.json (lagret eksempelhus) */
  const [houseJson, setHouseJson] = useState<House | null>(null);
  useEffect(() => {
    fetch("/house.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setHouseJson)
      .catch((e) => console.error("Feil ved /house.json:", e));
  }, []);

  // Close suggestions when clicking outside (Figma mode)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (figmaWrapperRef.current && !figmaWrapperRef.current.contains(event.target as Node)) {
        setShowFigmaSuggestions(false);
      }
    };

    if (mode === "figma" || mode === "figma-enebolig" || mode === "figma-blokk") {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mode]);

  /* 3. Lookup mode state */
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<Error | null>(null);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [searchedAddress, setSearchedAddress] = useState<string>("");

  /* 4. Figma mode state */
  const [figmaSearchValue, setFigmaSearchValue] = useState("");
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<Error | null>(null);
  const [figmaResult, setFigmaResult] = useState<any>(null);
  const [figmaSuggestions, setFigmaSuggestions] = useState<any[]>([]);
  const [showFigmaSuggestions, setShowFigmaSuggestions] = useState(false);
  const [figmaSelectedIndex, setFigmaSelectedIndex] = useState(-1);
  const [isLoadingFigmaSuggestions, setIsLoadingFigmaSuggestions] = useState(false);
  const figmaDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const figmaWrapperRef = useRef<HTMLDivElement>(null);

  const handleAddressLookup = async (address: string) => {
    setLookupLoading(true);
    setLookupError(null);
    setSearchedAddress(address);
    
    try {
      const result = await buildingApi.lookupAddress(address);
      setLookupResult(result);
      console.log('[App] Lookup successful:', result);
    } catch (error) {
      console.error('[App] Lookup failed:', error);
      setLookupError(error instanceof Error ? error : new Error('Ukjent feil'));
      setLookupResult(null);
    } finally {
      setLookupLoading(false);
    }
  };

  const handleFigmaSearch = async () => {
    if (!figmaSearchValue.trim()) return;
    
    setFigmaLoading(true);
    setFigmaError(null);
    
    try {
      const result = await buildingApi.lookupAddress(figmaSearchValue);
      setFigmaResult(result);
      console.log('[Figma] Lookup successful:', result);
      
      // Determine building type and navigate accordingly
      const buildingTypeCode = result.bygningstypeKode;
      const buildingTypeId = result.bygningstypeKodeId;
      
      if (buildingTypeCode) {
        const code = parseInt(buildingTypeCode);
        // Enebolig (11x codes)
        if (code >= 110 && code < 120) {
          setMode('figma-enebolig');
        }
        // Blokk (14x codes)
        else if (code >= 140 && code < 150) {
          setMode('figma-blokk');
        }
        // Default to appropriate type based on other codes
        else if (code >= 120 && code < 140) {
          // Tomannsbolig and rekkehus - show as enebolig
          setMode('figma-enebolig');
        } else {
          // Default to blokk for other residential types
          setMode('figma-blokk');
        }
      } else if (buildingTypeId) {
        // Handle internal IDs
        if (buildingTypeId === 1 || buildingTypeId === 4 || buildingTypeId === 5 || buildingTypeId === 8) {
          // Enebolig, tomannsbolig, rekkehus
          setMode('figma-enebolig');
        } else {
          // Blokk types (including ID 127 and other block types)
          setMode('figma-blokk');
        }
      }
    } catch (error) {
      console.error('[Figma] Lookup failed:', error);
      setFigmaError(error instanceof Error ? error : new Error('Ukjent feil'));
      setFigmaResult(null);
    } finally {
      setFigmaLoading(false);
    }
  };

  // Fetch address suggestions for Figma mode
  const fetchFigmaSuggestions = async (query: string) => {
    if (query.length < 3) {
      setFigmaSuggestions([]);
      return;
    }

    setIsLoadingFigmaSuggestions(true);
    try {
      const response = await fetch(`http://localhost:3001/api/address-suggestions?query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setFigmaSuggestions(data.suggestions || []);
        setShowFigmaSuggestions(true);
      } else {
        console.error('Failed to fetch suggestions:', response.status);
        setFigmaSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setFigmaSuggestions([]);
    } finally {
      setIsLoadingFigmaSuggestions(false);
    }
  };

  // Handle input change with debouncing for Figma mode
  const handleFigmaInputChange = (value: string) => {
    setFigmaSearchValue(value);
    if (figmaError) setFigmaError(null);
    setFigmaSelectedIndex(-1);

    // Clear existing timer
    if (figmaDebounceTimerRef.current) {
      clearTimeout(figmaDebounceTimerRef.current);
    }

    // Set new timer for debouncing (300ms delay)
    figmaDebounceTimerRef.current = setTimeout(() => {
      fetchFigmaSuggestions(value);
    }, 300);
  };

  // Handle keyboard navigation for Figma mode
  const handleFigmaKeyDown = (e: React.KeyboardEvent) => {
    if (!showFigmaSuggestions || figmaSuggestions.length === 0) {
      if (e.key === 'Enter') {
        handleFigmaSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFigmaSelectedIndex(prev => 
          prev < figmaSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFigmaSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (figmaSelectedIndex >= 0) {
          e.preventDefault();
          handleFigmaSuggestionSelect(figmaSuggestions[figmaSelectedIndex]);
        } else {
          handleFigmaSearch();
        }
        break;
      case 'Escape':
        setShowFigmaSuggestions(false);
        setFigmaSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection for Figma mode
  const handleFigmaSuggestionSelect = (suggestion: any) => {
    setFigmaSearchValue(suggestion.adresse);
    setFigmaSuggestions([]);
    setShowFigmaSuggestions(false);
    setFigmaSelectedIndex(-1);
    setFigmaError(null);
  };

  /* --- RENDER ---------------------------------------------------- */
  if (error && mode !== "lookup") return <p className="text-red-600 p-4">Feil: {error}</p>;

  // Special rendering for Figma enebolig mode
  if (mode === "figma-enebolig" && figmaResult) {
    return (
      <FigmaEnebolig
        searchAddress={figmaSearchValue}
        buildingData={figmaResult}
        onBack={() => {
          setMode("figma");
          setFigmaResult(null);
          setFigmaSearchValue("");
          setFigmaError(null);
        }}
      />
    );
  }

  // Special rendering for Figma blokk mode
  if (mode === "figma-blokk" && figmaResult) {
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
        <FigmaBlokk
          searchAddress={figmaSearchValue}
          buildingData={figmaResult}
          onBack={() => {
            setMode("figma");
            setFigmaResult(null);
            setFigmaSearchValue("");
            setFigmaError(null);
          }}
        />
      </div>
    );
  }

  // Special rendering for Figma mode - completely separate page
  if (mode === "figma") {
    console.log('[Figma Mode] Rendering Figma design');

    return (
      <div className="figma-design-container" style={{ background: '#034B45', minHeight: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <button
          className="back-button"
          onClick={() => setMode("lookup")}
        >
          ← Tilbake
        </button>
        <div className="figma-content">
          {/* Søkefunksjon container med logo og tekst */}
          <div className="figma-search-container">
            {/* Oslo logo med tekst */}
            <div className="oslo-logo-container">
              <svg className="oslo-logo" width="57" height="68" viewBox="0 0 57 68" fill="none">
              <path d="M45.1955 15.1593L44.2677 14.583C42.854 13.6522 41.3519 12.8544 39.7614 12.1895C39.0987 11.9235 38.436 11.6576 37.7734 11.4359C36.1829 10.904 34.5041 10.4608 32.8694 10.1948C32.1626 10.1062 31.4557 10.0175 30.7047 9.92888C29.0258 9.79591 27.3028 9.79591 25.624 9.92888C24.9172 9.97321 24.1661 10.0619 23.4592 10.1948C21.7804 10.4608 20.1458 10.8597 18.5111 11.4359C17.8485 11.6576 17.1858 11.9235 16.5231 12.1895C14.9768 12.8544 13.4747 13.6522 12.0168 14.583L11.089 15.1593L6.53854 6.42718L7.33377 5.9396C8.88005 4.96444 10.4705 4.12226 12.1051 3.41305L12.9445 3.01413L14.5792 6.16123C15.0652 5.98392 15.507 5.80662 15.9929 5.62932L15.1535 2.17194L16.0371 1.86167C17.7601 1.32976 19.4831 0.886509 21.2503 0.576231L22.178 0.398929L23.0174 3.85631L23.2825 3.81198C23.6801 3.76766 24.1219 3.72333 24.5195 3.67901V0.132977L25.4473 0.0886528C26.3309 0.0443274 27.2587 0 28.1423 0C29.0258 0 29.9536 0.0443274 30.8372 0.0886528L31.765 0.132977V3.67901C32.2509 3.72333 32.7369 3.76766 33.2671 3.85631L34.1065 0.398929L35.0342 0.576231C36.8014 0.886509 38.5686 1.32976 40.2474 1.86167L41.131 2.17194L40.2916 5.62932C40.7776 5.80662 41.2193 5.98392 41.7053 6.16123L43.34 3.01413L44.1794 3.41305C45.814 4.16659 47.4045 5.00877 48.9507 5.9396L49.746 6.42718L45.1955 15.1593ZM9.1893 7.18071L11.8842 12.3225C13.1213 11.5689 14.4025 10.9484 15.7278 10.3721H15.772C16.4789 10.0619 17.1858 9.79591 17.8926 9.57428C19.6156 8.99805 21.3828 8.51047 23.15 8.24452C23.901 8.11154 24.6521 8.02289 25.4473 7.97857C27.2587 7.84559 29.07 7.84559 30.8814 7.97857C31.6324 8.06722 32.4277 8.15587 33.1787 8.24452C34.9459 8.51047 36.7131 8.95372 38.436 9.52995C39.1429 9.79591 39.8498 10.0619 40.5567 10.3278C41.882 10.904 43.1632 11.5689 44.4444 12.2781L47.1394 7.13638C46.2116 6.60448 45.2397 6.07258 44.2677 5.62932L42.6331 8.7321L41.7937 8.37749L41.4402 8.24452C40.6008 7.88991 39.7172 7.53531 38.8337 7.26936L37.9501 6.95908L38.7895 3.54603C37.7292 3.23575 36.7131 2.9698 35.6527 2.74817L34.8133 6.16123L33.8856 6.02825C32.8253 5.85095 31.765 5.71797 30.7488 5.62932L29.8211 5.54067V2.03897C28.7608 1.99464 27.6563 1.99464 26.596 2.03897V5.54067L25.6682 5.62932C24.9613 5.67365 24.2986 5.7623 23.636 5.85095C23.2825 5.89528 22.8849 5.9396 22.5315 6.02825L21.6037 6.16123L20.7643 2.74817C19.704 2.9698 18.6437 3.23575 17.6276 3.54603L18.467 6.95908L17.5834 7.26936C16.6998 7.57964 15.8162 7.88991 14.9768 8.24452L14.6234 8.37749L13.784 8.7321L12.1493 5.62932C11.089 6.07258 10.1171 6.60448 9.1893 7.18071Z" fill="#F1FDFF"/>
              <path d="M28.1423 68.2611C12.5911 68.2611 0 55.6283 0 40.0701C0 24.5119 12.5911 11.8349 28.0981 11.8349C43.605 11.8349 56.2403 24.4676 56.2403 40.0258C56.2403 47.5168 53.2803 54.6975 48.023 60.0165C42.7656 65.2913 35.5644 68.2611 28.1423 68.2611ZM28.1423 13.9182C13.7398 13.9182 2.07643 25.62 2.07643 40.0258C2.07643 54.4315 13.7398 66.1778 28.0981 66.1778C42.5005 66.1778 54.1639 54.4759 54.1639 40.0701C54.1639 33.1554 51.4248 26.5066 46.5209 21.5864C41.6611 16.6663 35.0342 13.8738 28.1423 13.9182Z" fill="#F1FDFF"/>
              <path d="M22.7082 32.0029C20.4992 29.0331 21.1177 24.7779 24.0778 22.5616C27.0378 20.3453 31.279 20.9659 33.488 23.9357C35.2551 26.3293 35.2551 29.6093 33.488 32.0029L34.9901 33.111C36.0945 31.6483 36.713 29.831 36.713 27.9693C36.713 23.2265 32.8694 19.3702 28.1423 19.3702C23.4151 19.3702 19.5715 23.2265 19.5715 27.9693C19.5715 29.831 20.19 31.6483 21.2945 33.111L22.7082 32.0029Z" fill="#F1FDFF"/>
              <path d="M28.0981 34.0419C29.9536 34.0419 31.4557 32.5348 31.4557 30.6732V30.3185H32.5602V28.1909C32.5602 25.7087 30.5721 23.7141 28.0981 23.7141C25.624 23.7141 23.636 25.7087 23.636 28.1909V30.3185H24.7404V30.6732C24.7404 32.5348 26.2425 34.0419 28.0981 34.0419ZM25.4915 28.2353C25.4915 26.7725 26.6402 25.6201 28.0981 25.6201C29.556 25.6201 30.7047 26.7725 30.7047 28.2353V30.3629H29.9094V30.7175C29.9536 31.737 29.2026 32.5791 28.1864 32.6235C27.1703 32.6678 26.3309 31.9143 26.2867 30.8948C26.2867 30.8505 26.2867 30.7618 26.2867 30.7175V30.3629H25.4915V28.2353Z" fill="#F1FDFF"/>
              <path d="M11.4866 41.3112H8.92423V43.9264H11.4866V41.3112Z" fill="#F1FDFF"/>
              <path d="M48.9066 39.3166V40.6907H50.2319L46.6534 44.281V37.9868L47.5812 38.9177L48.5531 37.9425L45.9465 35.3273L43.34 37.9425L44.3119 38.9177L45.2397 37.9868V44.2367L41.6611 40.6464H42.9423V39.2723H39.2755V42.9956H40.645V41.6658L43.4283 44.5027H37.7734L37.199 43.9708L36.713 39.3609C36.6689 39.095 36.4038 36.7457 34.4599 35.7262H34.4157L32.4277 34.9284L32.1184 34.7954L31.8091 34.8841C30.5721 35.1943 29.3351 35.3273 28.0981 35.283C26.861 35.3273 25.5798 35.1943 24.387 34.8841L24.0778 34.7954L21.7804 35.6819H21.7362C19.7924 36.7014 19.4831 39.0506 19.4831 39.3166L18.9529 44.1037L18.5111 44.4583H16.5673C16.744 43.8378 16.8323 43.2172 16.8323 42.5967C16.8323 38.9177 13.8281 35.9479 10.1612 35.9922C6.49436 35.9922 3.53434 39.0063 3.57852 42.6853C3.57852 45.9654 5.96421 48.7136 9.1893 49.2455H9.27766C9.45438 49.2898 9.6311 49.2898 9.80781 49.2898L18.4228 50.1763C18.1135 53.1018 17.5392 55.9829 16.6998 58.8198L17.5834 59.13L18.467 59.396C19.3506 56.4262 19.9691 53.3677 20.2783 50.3093L22.2222 48.6692L21.913 60.7257L22.7082 60.8587C26.3309 61.4793 30.042 61.4793 33.7089 60.8587L34.5041 60.7257L34.1948 48.7136L36.1387 50.3536C36.448 53.4121 37.0665 56.4705 37.9501 59.4403L39.7172 58.8641C38.8778 56.0273 38.3035 53.1461 37.9943 50.2206L46.6534 49.4228V46.4087L51.2481 41.7988V43.1286H52.6176V39.4496L48.9066 39.3166ZM28.0981 37.189C29.4235 37.2333 30.7488 37.056 32.0742 36.7901L33.6647 37.4106C34.725 37.9868 34.9017 39.5382 34.9017 39.5382L35.2993 43.1729H33.0462C32.1626 43.1729 31.2348 42.9513 30.4838 42.4637C29.9094 42.0204 29.3793 41.5329 28.9375 40.9566L25.7566 37.056C26.5518 37.1446 27.347 37.189 28.0981 37.189ZM10.2054 47.4281H9.98453L9.49856 47.3838C6.89197 46.9849 5.08062 44.5027 5.52241 41.8875C5.92003 39.2723 8.39407 37.4549 11.0007 37.8982C13.6072 38.2971 15.4186 40.7793 14.9768 43.3945C14.5792 45.6994 12.5469 47.4281 10.2054 47.4281ZM22.2664 46.1427L19.6156 48.4033L14.3141 47.8714C14.8443 47.4281 15.3302 46.9406 15.7278 46.3643H19.218L22.3106 43.7491L22.2664 46.1427ZM22.3989 41.2669L21.0294 42.4194L21.3386 39.5825V39.5382C21.3386 39.5382 21.4712 37.9868 22.5756 37.4106L23.4592 37.056L25.0497 39.0063L22.3989 41.2669ZM28.1423 59.4403C26.6843 59.4403 25.2264 59.3517 23.8127 59.13L23.901 55.1851L24.2103 42.1534L26.1984 40.4691L27.5237 42.1091C28.0981 42.8626 28.8049 43.5275 29.556 44.0594C30.3512 44.547 31.279 44.8573 32.2068 44.9902L32.5602 59.13C31.1023 59.3073 29.6002 59.396 28.1423 59.4403ZM44.7979 47.6498L36.8014 48.4033L32.8253 45.0346H35.7411L37.2432 46.3643H44.8421L44.7979 47.6498Z" fill="#F1FDFF"/>
              <path d="M81.5275 50.0838C86.7231 50.0838 90.9609 45.8903 90.9609 38.9011C90.9609 32.1448 86.7231 28.0095 81.5275 28.0095C76.3028 28.0095 72.0651 32.1448 72.0651 38.9011C72.0651 45.8903 76.3028 50.0838 81.5275 50.0838ZM81.5275 47.6376C77.8702 47.6376 74.7645 44.7254 74.7645 38.9011C74.7645 33.0767 77.7541 30.4557 81.5275 30.4557C85.2718 30.4557 88.2615 33.0767 88.2615 38.9011C88.2615 44.7254 85.1557 47.6376 81.5275 47.6376Z" fill="#F1FDFF"/>
              <path d="M94.387 38.4933C94.387 40.6192 95.9253 42.0753 98.7699 42.6578L101.411 43.1819C103.182 43.5605 103.936 44.2595 103.936 45.5408C103.936 46.9969 102.456 47.9579 100.25 47.9579C98.0732 47.9579 96.5349 47.1134 95.7512 45.5408L93.8355 46.5601C94.9385 48.8316 97.1734 50.0547 100.308 50.0547C103.907 50.0547 106.346 48.1618 106.346 45.3952C106.346 43.0655 104.749 41.5803 101.411 40.9105L99.1762 40.4736C97.5218 40.1242 96.7961 39.4544 96.7961 38.3186C96.7961 37.0081 98.1023 36.2218 100.076 36.2218C101.963 36.2218 103.356 36.979 103.995 38.3477L105.881 37.3867C105.068 35.3482 102.979 34.096 100.134 34.096C96.7381 34.096 94.387 35.9889 94.387 38.4933Z" fill="#F1FDFF"/>
              <path d="M115.561 49.7635V47.6085C115.242 47.6958 114.923 47.7249 114.633 47.7249C113.414 47.7249 112.688 47.0843 112.688 45.7447V28.2716H110.192V45.8612C110.192 48.3656 111.44 49.9673 114.052 49.9673C114.575 49.9673 115.039 49.88 115.561 49.7635Z" fill="#F1FDFF"/>
              <path d="M125.094 50.0838C128.954 50.0838 132.118 46.9387 132.118 42.0462C132.118 37.2411 128.983 34.096 125.094 34.096C121.175 34.096 118.041 37.2411 118.041 42.0462C118.041 46.9387 121.204 50.0838 125.094 50.0838ZM125.094 47.8997C122.627 47.8997 120.624 45.9776 120.624 42.0462C120.624 38.1148 122.656 36.2801 125.094 36.2801C127.503 36.2801 129.535 38.1148 129.535 42.0462C129.535 45.9776 127.532 47.8997 125.094 47.8997Z" fill="#F1FDFF"/>
              </svg>
              <span className="oslo-text">Oslo</span>
            </div>
            
            {/* Energiportalen tekst */}
            <h1 className="energiportalen-title">Energiportalen</h1>
            
            {/* Søkefelt wrapper */}
            <div className="figma-search-wrapper" ref={figmaWrapperRef}>
              {/* Label */}
              <label className="figma-search-label">
                Søk etter adresse
              </label>
              
              {/* Input gruppe */}
              <div className="figma-search-autocomplete-wrapper">
                <div className="figma-search-input-group">
                  {/* Søkefelt */}
                  <input
                    type="text"
                    placeholder="Skriv inn adresse..."
                    className="figma-search-input"
                    value={figmaSearchValue}
                    onChange={(e) => handleFigmaInputChange(e.target.value)}
                    onKeyDown={handleFigmaKeyDown}
                    onFocus={() => figmaSuggestions.length > 0 && setShowFigmaSuggestions(true)}
                    disabled={figmaLoading}
                    autoComplete="off"
                  />
                  
                  {/* Søkeknapp */}
                  <button 
                    className="figma-search-button"
                    onClick={handleFigmaSearch}
                    disabled={figmaLoading}
                  >
                    {figmaLoading ? (
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
                
                {/* Suggestions dropdown */}
                {showFigmaSuggestions && figmaSuggestions.length > 0 && (
                  <ul className="figma-search-suggestions">
                    {isLoadingFigmaSuggestions ? (
                      <li className="figma-search-suggestion figma-search-suggestion--loading">
                        Søker...
                      </li>
                    ) : (
                      figmaSuggestions.map((suggestion, index) => (
                        <li
                          key={index}
                          className={`figma-search-suggestion ${
                            index === figmaSelectedIndex ? 'figma-search-suggestion--selected' : ''
                          }`}
                          onClick={() => handleFigmaSuggestionSelect(suggestion)}
                          onMouseEnter={() => setFigmaSelectedIndex(index)}
                        >
                          {suggestion.adressetekst || suggestion.adresse}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
              
              {/* Error message */}
              {figmaError && (
                <div className="figma-error-message">
                  {figmaError.message}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Oslo skyline SVG - updated version */}
        <svg 
          className="oslo-skyline"
          viewBox="0 -10 1728 362" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMax slice"
          style={{ overflow: 'visible' }}
        >
          <path d="M1620.3 191.642H1548.51H1512.6V119.506V0.593262H1620.3V191.642Z" fill="#F8F0DD"/>
          <path d="M1300.28 351.876H1244.9H1217.2V219.221V0.593262H1300.28V351.876Z" fill="#D0BFAE"/>
          <path d="M1407.98 351.876H1336.19H1300.28V219.221V0.593262H1407.98V351.876Z" fill="#F8F0DD"/>
          <path d="M1447.98 351.877H1355.67H1309.51V289.047V185.48H1447.98V351.877Z" fill="#D0BFAE"/>
          <path d="M1728 351.877H1541.31H1447.98V289.047V185.48H1728V351.877Z" fill="#F8F0DD"/>
          <path d="M1512.6 185.479H1457.21H1429.52V115.654V0.593262H1512.6V185.479Z" fill="#D0BFAE"/>
          <path d="M1291.05 154.666H1275.67V170.073H1291.05V154.666Z" fill="#2A2859"/>
          <path d="M1266.43 154.666H1251.05V170.073H1266.43V154.666Z" fill="#2A2859"/>
          <path d="M1241.82 154.666H1226.43V170.073H1241.82V154.666Z" fill="#2A2859"/>
          <path d="M1291.05 188.562H1275.67V203.969H1291.05V188.562Z" fill="#2A2859"/>
          <path d="M1266.43 188.562H1251.05V203.969H1266.43V188.562Z" fill="#2A2859"/>
          <path d="M1241.82 188.562H1226.43V203.969H1241.82V188.562Z" fill="#2A2859"/>
          <path d="M1291.05 222.457H1275.67V237.864H1291.05V222.457Z" fill="#2A2859"/>
          <path d="M1266.43 222.457H1251.05V237.864H1266.43V222.457Z" fill="#2A2859"/>
          <path d="M1241.82 222.457H1226.43V237.864H1241.82V222.457Z" fill="#2A2859"/>
          <path d="M1291.05 256.352H1275.67V271.759H1291.05V256.352Z" fill="#2A2859"/>
          <path d="M1266.43 256.352H1251.05V271.759H1266.43V256.352Z" fill="#2A2859"/>
          <path d="M1241.82 256.352H1226.43V271.759H1241.82V256.352Z" fill="#2A2859"/>
          <path d="M1291.05 290.247H1275.67V305.654H1291.05V290.247Z" fill="#2A2859"/>
          <path d="M1266.43 290.247H1251.05V305.654H1266.43V290.247Z" fill="#2A2859"/>
          <path d="M1241.82 290.247H1226.43V305.654H1241.82V290.247Z" fill="#2A2859"/>
          <path d="M1241.82 99.1976H1226.43V123.849H1241.82V99.1976Z" fill="#2A2859"/>
          <path d="M1266.43 99.1976H1251.05V123.849H1266.43V99.1976Z" fill="#2A2859"/>
          <path d="M1291.05 99.1976H1275.67V123.849H1291.05V99.1976Z" fill="#2A2859"/>
          <path d="M1398.75 154.666H1383.36V170.073H1398.75V154.666Z" fill="#2A2859"/>
          <path d="M1374.13 154.666H1358.75V170.073H1374.13V154.666Z" fill="#2A2859"/>
          <path d="M1349.52 154.666H1334.13V170.073H1349.52V154.666Z" fill="#2A2859"/>
          <path d="M1324.9 154.666H1309.51V170.073H1324.9V154.666Z" fill="#2A2859"/>
          <path d="M1324.9 99.1976H1309.51V123.849H1324.9V99.1976Z" fill="#2A2859"/>
          <path d="M1349.52 99.1976H1334.13V123.849H1349.52V99.1976Z" fill="#2A2859"/>
          <path d="M1374.13 99.1976H1358.75V123.849H1374.13V99.1976Z" fill="#2A2859"/>
          <path d="M1398.75 99.1976H1383.36V123.849H1398.75V99.1976Z" fill="#2A2859"/>
          <path d="M1411.06 311.817H1395.67V333.387H1411.06V311.817Z" fill="#2A2859"/>
          <path d="M1435.67 287.166V265.596H1420.29V287.166H1411.06V265.596H1395.67V287.166H1386.44V265.596H1371.06V287.166H1361.82V265.596H1346.44V287.166H1337.21V265.596H1321.82V287.166H1309.51V296.41H1447.98V287.166H1435.67Z" fill="#2A2859"/>
          <path d="M1435.67 311.817H1420.29V333.387H1435.67V311.817Z" fill="#2A2859"/>
          <path d="M1386.44 311.817H1371.05V333.387H1386.44V311.817Z" fill="#2A2859"/>
          <path d="M1361.82 311.817H1346.44V333.387H1361.82V311.817Z" fill="#2A2859"/>
          <path d="M1337.21 311.817H1321.82V333.387H1337.21V311.817Z" fill="#2A2859"/>
          <path d="M1728 185.48H1447.98V194.724H1728V185.48Z" fill="#2A2859"/>
          <path d="M1718.77 287.166V265.596H1703.38V287.166H1694.15V265.596H1678.76V287.166H1669.53V265.596H1654.15V287.166H1644.92V265.596H1629.53V287.166H1620.3V265.596H1604.91V287.166H1595.68V265.596H1580.3V287.166H1571.07V265.596H1555.68V287.166H1546.45V265.596H1531.06V287.166H1521.83V265.596H1506.45V287.166H1497.22V265.596H1481.83V287.166H1472.6V265.596H1457.21V287.166H1447.98V296.41H1728V287.166H1718.77Z" fill="#2A2859"/>
          <path d="M1546.45 311.817H1531.07V333.387H1546.45V311.817Z" fill="#2A2859"/>
          <path d="M1521.83 311.817H1506.45V333.387H1521.83V311.817Z" fill="#2A2859"/>
          <path d="M1497.22 311.817H1481.83V333.387H1497.22V311.817Z" fill="#2A2859"/>
          <path d="M1472.6 311.817H1457.21V333.387H1472.6V311.817Z" fill="#2A2859"/>
          <path d="M1644.92 311.817H1629.53V333.387H1644.92V311.817Z" fill="#2A2859"/>
          <path d="M1620.3 311.817H1604.92V333.387H1620.3V311.817Z" fill="#2A2859"/>
          <path d="M1595.69 311.817H1580.3V333.387H1595.69V311.817Z" fill="#2A2859"/>
          <path d="M1571.07 311.817H1555.68V333.387H1571.07V311.817Z" fill="#2A2859"/>
          <path d="M1718.77 311.817H1703.38V333.387H1718.77V311.817Z" fill="#2A2859"/>
          <path d="M1694.15 311.817H1678.77V333.387H1694.15V311.817Z" fill="#2A2859"/>
          <path d="M1669.54 311.817H1654.15V333.387H1669.54V311.817Z" fill="#2A2859"/>
          <path d="M1503.37 154.666H1487.99V170.073H1503.37V154.666Z" fill="#2A2859"/>
          <path d="M1478.76 154.666H1463.37V170.073H1478.76V154.666Z" fill="#2A2859"/>
          <path d="M1454.14 154.666H1438.75V170.073H1454.14V154.666Z" fill="#2A2859"/>
          <path d="M1454.14 99.1976H1438.75V123.849H1454.14V99.1976Z" fill="#2A2859"/>
          <path d="M1478.76 99.1976H1463.37V123.849H1478.76V99.1976Z" fill="#2A2859"/>
          <path d="M1503.37 99.1976H1487.99V123.849H1503.37V99.1976Z" fill="#2A2859"/>
          <path d="M1611.07 154.666H1595.69V170.073H1611.07V154.666Z" fill="#2A2859"/>
          <path d="M1586.45 154.666H1571.07V170.073H1586.45V154.666Z" fill="#2A2859"/>
          <path d="M1561.84 154.666H1546.45V170.073H1561.84V154.666Z" fill="#2A2859"/>
          <path d="M1537.22 154.666H1521.84V170.073H1537.22V154.666Z" fill="#2A2859"/>
          <path d="M1537.22 99.1976H1521.84V123.849H1537.22V99.1976Z" fill="#2A2859"/>
          <path d="M1561.84 99.1976H1546.45V123.849H1561.84V99.1976Z" fill="#2A2859"/>
          <path d="M1586.45 99.1976H1571.07V123.849H1586.45V99.1976Z" fill="#2A2859"/>
          <path d="M1611.07 99.1976H1595.69V123.849H1611.07V99.1976Z" fill="#2A2859"/>
          <path d="M1563.37 74.5471C1577.82 74.5471 1589.53 62.8204 1589.53 48.3549C1589.53 33.8893 1577.82 22.1627 1563.37 22.1627C1548.93 22.1627 1537.22 33.8893 1537.22 48.3549C1537.22 62.8204 1548.93 74.5471 1563.37 74.5471Z" fill="#2A2859"/>
          <path d="M1564.91 34.4882H1558.76V40.651H1564.91V34.4882Z" fill="#F8F0DD"/>
          <path d="M1564.91 40.6516H1558.76V46.8145H1564.91V40.6516Z" fill="#F8F0DD"/>
          <path d="M1564.91 46.814H1558.76V52.9767H1564.91V46.814Z" fill="#F8F0DD"/>
          <path d="M1571.07 46.814H1564.91V52.9767H1571.07V46.814Z" fill="#F8F0DD"/>
          <path d="M504.642 259.558L535.413 290.372V352.001H473.872V290.372L504.642 259.558Z" fill="#D0BFAE"/>
          <path d="M566.182 290.372V321.186H596.953V352H566.182H554.797H535.411V332.957V321.186V290.372H566.182Z" fill="#F8F0DD"/>
          <path d="M443.099 321.186H473.87V352H443.099V321.186Z" fill="#F8F0DD"/>
          <path d="M412.33 290.372L443.101 321.186V352H412.33H381.559V321.186L412.33 290.372Z" fill="#D0BFAE"/>
          <path d="M350.783 302.697H381.554V352H350.783V302.697Z" fill="#F8F0DD"/>
          <path d="M320.018 271.883L350.789 302.697V352H320.018H289.248V302.697L320.018 271.883Z" fill="#D0BFAE"/>
          <path d="M535.411 290.372H566.182L535.411 259.558H504.64L535.411 290.372Z" fill="#2A2859"/>
          <path d="M596.953 321.186H566.182V290.372L596.953 321.186Z" fill="#2A2859"/>
          <path d="M495.408 339.674H507.716V351.999H495.408V339.674Z" fill="#2A2859"/>
          <path d="M443.099 321.186H473.87L443.099 290.372H412.328L443.099 321.186Z" fill="#2A2859"/>
          <path d="M406.174 339.674H418.482V351.999H406.174V339.674Z" fill="#2A2859"/>
          <path d="M350.783 302.697H381.554L350.783 271.883H320.013L350.783 302.697Z" fill="#2A2859"/>
          <path d="M313.862 339.674H326.17V351.999H313.862V339.674Z" fill="#2A2859"/>
          <path d="M61.5357 247.23H116.923L86.1525 216.416H30.7648L61.5357 247.23Z" fill="#2A2859"/>
          <path d="M61.5358 247.229H116.923V351.998H61.5358V247.229Z" fill="#F8F0DD"/>
          <path d="M30.7689 216.416L61.5399 247.23V351.999H30.7689H-0.00210571V247.23L30.7689 216.416Z" fill="#D0BFAE"/>
          <path d="M24.6126 339.674H36.921V352H24.6126V339.674Z" fill="#2A2859"/>
          <path d="M36.922 318.105H49.2304V330.431H36.922V318.105Z" fill="#2A2859"/>
          <path d="M12.3031 318.105H24.6115V330.431H12.3031V318.105Z" fill="#2A2859"/>
          <path d="M36.922 293.454H49.2304V305.779H36.922V293.454Z" fill="#2A2859"/>
          <path d="M12.3031 293.454H24.6115V305.779H12.3031V293.454Z" fill="#2A2859"/>
          <path d="M36.922 268.799H49.2304V281.125H36.922V268.799Z" fill="#2A2859"/>
          <path d="M12.3031 268.799H24.6115V281.125H12.3031V268.799Z" fill="#2A2859"/>
          <path d="M83.078 305.779H95.3864V330.431H83.078V305.779Z" fill="#2A2859"/>
          <path d="M83.078 268.799H95.3864V293.45H83.078V268.799Z" fill="#2A2859"/>
          <path d="M190.775 173.276H252.317V351.999H190.775V173.276Z" fill="#F8F0DD"/>
          <path d="M116.927 173.276H190.777V351.999H116.927V173.276Z" fill="#D0BFAE"/>
          <path d="M147.696 339.674H160.005V352H147.696V339.674Z" fill="#2A2859"/>
          <path d="M160.002 293.454H172.311V305.779H160.002V293.454Z" fill="#2A2859"/>
          <path d="M135.387 293.454H147.695V305.779H135.387V293.454Z" fill="#2A2859"/>
          <path d="M160.002 268.799H172.311V281.125H160.002V268.799Z" fill="#2A2859"/>
          <path d="M135.387 268.799H147.695V281.125H135.387V268.799Z" fill="#2A2859"/>
          <path d="M160.002 244.148H172.311V256.474H160.002V244.148Z" fill="#2A2859"/>
          <path d="M135.387 244.148H147.695V256.474H135.387V244.148Z" fill="#2A2859"/>
          <path d="M160.002 219.497H172.311V231.822H160.002V219.497Z" fill="#2A2859"/>
          <path d="M135.387 219.497H147.695V231.822H135.387V219.497Z" fill="#2A2859"/>
          <path d="M160.002 194.845H172.311V207.171H160.002V194.845Z" fill="#2A2859"/>
          <path d="M135.387 194.845H147.695V207.171H135.387V194.845Z" fill="#2A2859"/>
          <path d="M215.393 305.779H227.701V330.431H215.393V305.779Z" fill="#2A2859"/>
          <path d="M215.393 268.799H227.701V293.45H215.393V268.799Z" fill="#2A2859"/>
          <path d="M215.393 231.822H227.701V256.474H215.393V231.822Z" fill="#2A2859"/>
          <path d="M215.393 194.845H227.701V219.497H215.393V194.845Z" fill="#2A2859"/>
          <path d="M646.185 197.928V185.602H658.493V173.276H670.802V185.602H683.11V197.928H695.419V351.999H633.877V197.928H646.185Z" fill="#D0BFAE"/>
          <path d="M683.111 173.276H685.45H695.42V185.602H697.174H707.728V197.928H697.174H695.42H683.111V185.602H670.803V173.276H683.111Z" fill="#2A2859"/>
          <path d="M809.271 259.555V321.183V351.998H778.5V321.183V259.555H809.271Z" fill="#F8F0DD"/>
          <path d="M747.728 228.741L778.499 259.555V351.998H716.958V259.555L747.728 228.741Z" fill="#D0BFAE"/>
          <path d="M778.5 259.555H809.271L778.5 228.741H747.729L778.5 259.555Z" fill="#2A2859"/>
          <path d="M738.498 339.674H750.806V352H738.498V339.674Z" fill="#2A2859"/>
          <path d="M753.881 268.799H766.19V281.125H753.881V268.799Z" fill="#2A2859"/>
          <path d="M729.27 268.799H741.578V281.125H729.27V268.799Z" fill="#2A2859"/>
          <path d="M753.881 293.454H766.19V305.779H753.881V293.454Z" fill="#2A2859"/>
          <path d="M729.27 293.454H741.578V305.779H729.27V293.454Z" fill="#2A2859"/>
          <path d="M658.495 339.674H670.803V352H658.495V339.674Z" fill="#2A2859"/>
          <path d="M646.186 315.023H658.494V327.349H646.186V315.023Z" fill="#2A2859"/>
          <path d="M670.804 315.023H683.113V327.349H670.804V315.023Z" fill="#2A2859"/>
          <path d="M646.186 302.698H658.494V315.023H646.186V302.698Z" fill="#2A2859"/>
          <path d="M670.804 302.698H683.113V315.023H670.804V302.698Z" fill="#2A2859"/>
          <path d="M646.186 278.043H658.494V290.369H646.186V278.043Z" fill="#2A2859"/>
          <path d="M670.804 278.043H683.113V290.369H670.804V278.043Z" fill="#2A2859"/>
          <path d="M646.186 265.718H658.494V278.043H646.186V265.718Z" fill="#2A2859"/>
          <path d="M670.804 265.718H683.113V278.043H670.804V265.718Z" fill="#2A2859"/>
          <path d="M646.186 241.067H658.494V253.392H646.186V241.067Z" fill="#2A2859"/>
          <path d="M670.804 241.067H683.113V253.392H670.804V241.067Z" fill="#2A2859"/>
          <path d="M695.419 197.927H716.959V351.999H695.419V197.927Z" fill="#2A2859"/>
          <path d="M664.649 228.741C656.152 228.741 649.264 221.843 649.264 213.334C649.264 204.825 656.152 197.927 664.649 197.927C673.146 197.927 680.034 204.825 680.034 213.334C680.034 221.843 673.146 228.741 664.649 228.741Z" fill="#2A2859"/>
          <path d="M897.769 290.371V197.928L866.998 167.114L836.227 197.928V352H875.737H897.769H1020.85V290.371H897.769Z" fill="#F8F0DD"/>
          <path d="M1020.85 250.311V290.37H959.31H942.078H897.768V250.311H1020.85Z" fill="#2A2859"/>
          <path d="M873.151 327.349H860.843V352.001H873.151V327.349Z" fill="#2A2859"/>
          <path d="M947.005 315.024H934.696V327.35H947.005V315.024Z" fill="#2A2859"/>
          <path d="M922.389 315.024H910.081V327.35H922.389V315.024Z" fill="#2A2859"/>
          <path d="M947.005 302.698H934.696V315.024H947.005V302.698Z" fill="#2A2859"/>
          <path d="M922.389 302.698H910.081V315.024H922.389V302.698Z" fill="#2A2859"/>
          <path d="M996.235 315.024H983.927V327.35H996.235V315.024Z" fill="#2A2859"/>
          <path d="M971.62 315.024H959.312V327.35H971.62V315.024Z" fill="#2A2859"/>
          <path d="M996.235 302.698H983.927V315.024H996.235V302.698Z" fill="#2A2859"/>
          <path d="M971.62 302.698H959.312V315.024H971.62V302.698Z" fill="#2A2859"/>
          <path d="M866.997 231.823C875.494 231.823 882.383 224.925 882.383 216.416C882.383 207.907 875.494 201.009 866.997 201.009C858.5 201.009 851.612 207.907 851.612 216.416C851.612 224.925 858.5 231.823 866.997 231.823Z" fill="#2A2859"/>
          <path d="M1137.48 148.625L1149.78 160.951H1162.09V173.277H1174.4V185.602H1186.71V197.928H1174.4H1137.48V185.602H1100.55V148.625H1137.48Z" fill="#2A2859"/>
          <path d="M1149.78 197.927H1186.71V351.999H1149.78V197.927Z" fill="#F8F0DD"/>
          <path d="M1063.63 185.602V173.276H1075.93V160.951H1088.24L1100.55 148.625L1112.86 160.951H1125.17V173.276H1137.48V185.602H1149.78V197.928V351.999H1051.32V197.928V185.602H1063.63Z" fill="#D0BFAE"/>
          <path d="M1094.4 339.674H1106.71V352H1094.4V339.674Z" fill="#2A2859"/>
          <path d="M1119.01 210.253H1131.32V222.579H1119.01V210.253Z" fill="#2A2859"/>
          <path d="M1094.4 210.253H1106.71V222.579H1094.4V210.253Z" fill="#2A2859"/>
          <path d="M1069.78 210.253H1082.09V222.579H1069.78V210.253Z" fill="#2A2859"/>
          <path d="M1119.01 234.904H1131.32V247.229H1119.01V234.904Z" fill="#2A2859"/>
          <path d="M1094.4 234.904H1106.71V247.229H1094.4V234.904Z" fill="#2A2859"/>
          <path d="M1069.78 234.904H1082.09V247.229H1069.78V234.904Z" fill="#2A2859"/>
          <path d="M1119.01 259.555H1131.32V271.881H1119.01V259.555Z" fill="#2A2859"/>
          <path d="M1094.4 259.555H1106.71V271.881H1094.4V259.555Z" fill="#2A2859"/>
          <path d="M1069.78 259.555H1082.09V271.881H1069.78V259.555Z" fill="#2A2859"/>
        </svg>
      </div>
    );
  }

  return (
    <main className="container">
      <h1 className="page-title">Adresseoppslag - Matrikkel og Energiattest</h1>
      
      {/* Mode selector */}
      <div className="flex gap-2 mb-4">
        <PktButton
          onClick={() => setMode("lookup")}
        >
          Adresseoppslag
        </PktButton>
        <PktButton
          onClick={() => setMode("debug")}
        >
          Debug-modus
        </PktButton>
        <PktButton
          onClick={() => setMode("wizard")}
          disabled={!lookupData || !houseJson}
        >
          Veileder
        </PktButton>
        <PktButton
          onClick={() => setMode("figma")}
        >
          Figma Design
        </PktButton>
      </div>

      {/* ➊ Adresseoppslag mode */}
      {mode === "lookup" && (
        <>
          <AddressSearch 
            onSearch={handleAddressLookup} 
            isLoading={lookupLoading}
          />
          
          {lookupLoading && (
            <LoadingSpinner text="Henter bygningsdata..." />
          )}
          
          {lookupError && !lookupLoading && (
            <ErrorDisplay 
              error={lookupError}
              onRetry={() => searchedAddress && handleAddressLookup(searchedAddress)}
              context={{ address: searchedAddress }}
            />
          )}
          
          {lookupResult && !lookupLoading && (
            <>
              <ResultsTable 
                data={lookupResult}
                searchAddress={searchedAddress}
              />
              {lookupResult && lookupResult.bruksarealM2 && (
                <EnergyRatingEstimator 
                  buildingData={lookupResult}
                />
              )}
            </>
          )}
        </>
      )}

      {/* ➋ Diagnose-tabell */}
      {mode === "debug" && (
        <>
          <div className="flex gap-2 mb-4">
            <input
              className="border p-2 flex-1"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Skriv adresse …"
            />
          </div>
          {!lookupData && <p>Laster data …</p>}
          {lookupData && <DebugDataTable data={lookupData} />}
        </>
      )}

      {/* ➌ Trinn-veileder */}
      {mode === "wizard" && lookupData && houseJson && (
        <WizardFlow
          initialHouse={{ ...houseJson, ...lookupData }}
          onRestart={() => {
            setMode("debug");
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  WizardFlow – 3-stegs veileder                                     */
/* ------------------------------------------------------------------ */
function WizardFlow({
  initialHouse,
  onRestart,
}: {
  initialHouse: House;
  onRestart: () => void;
}) {
  const [house, setHouse] = useState<House>(initialHouse);
  const [step, setStep] = useState(1);
  const [loadingSubsidy, setLoadingSubsidy] = useState(false);
  const [subsidyFetched, setSubsidyFetched] = useState(false);

  /* Enova-støtte når vi er på steg 3 */
  useEffect(() => {
    if (step !== 3 || subsidyFetched) return;
    setLoadingSubsidy(true);
    setSubsidyFetched(true);

    Promise.all(
      house.tiltak.map((t) =>
        fetch(`/subsidy?tiltak=${encodeURIComponent(t.navn)}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((j: { enova_støtte_kr: number }) => j.enova_støtte_kr)
          .catch(() => 0)
      )
    )
      .then((beløp) =>
        setHouse((h) => ({
          ...h,
          tiltak: h.tiltak.map((t, i) => ({
            ...t,
            enova_støtte_kr: beløp[i],
          })),
        }))
      )
      .finally(() => setLoadingSubsidy(false));
  }, [step, house, subsidyFetched]);

  /* ---------- RENDER TRINNENE ---------------- */
  if (step === 1)
    return (
      <section>
        <h1 className="text-2xl font-bold mb-4">Grønn hus-sjekk</h1>
        <p>
          <strong>Adresse:</strong> {house.adresse}
        </p>
        {house.byggår && (
          <p>
            <strong>Byggeår:</strong> {house.byggår}
          </p>
        )}
        {house.energikarakter && (
          <p>
            <strong>E-merke:</strong> {house.energikarakter}
          </p>
        )}
        <button
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => setStep(2)}
        >
          Neste: Energibruk
        </button>
      </section>
    );

  if (step === 2)
    return (
      <section>
        <p>
          <strong>Årlig forbruk:</strong> {house.forbruk_kwh.toLocaleString()}{" "}
          kWh
        </p>
        {house.energiattest_kwh && (
          <p>
            <strong>Levert energi (attest):</strong>{" "}
            {house.energiattest_kwh.toLocaleString()} kWh
          </p>
        )}
        <button
          className="mt-6 px-4 py-2 bg-green-600 text-white rounded"
          onClick={() => setStep(3)}
        >
          Neste: Tiltak
        </button>
      </section>
    );

  /* ---- steg 3 ---- */
  return (
    <section>
      <h2 className="text-xl font-semibold mb-2">Forslag til tiltak</h2>

      {loadingSubsidy ? (
        <p>Laster støtte …</p>
      ) : (
        <table className="border w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="border px-2">Tiltak</th>
              <th className="border px-2">Sparing (kWh)</th>
              <th className="border px-2">Kostnad (kr)</th>
              <th className="border px-2">Enova-støtte</th>
            </tr>
          </thead>
          <tbody>
            {house.tiltak.map((t, i) => (
              <tr key={i} className="border-t">
                <td className="px-2">{t.navn}</td>
                <td className="px-2">{t.kwh_sparing.toLocaleString()}</td>
                <td className="px-2">{t.kost_kr.toLocaleString()}</td>
                <td className="px-2">
                  {t.enova_støtte_kr ? t.enova_støtte_kr.toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button
        className="mt-6 px-4 py-2 bg-gray-300 rounded"
        onClick={onRestart}
      >
        Start på nytt
      </button>
    </section>
  );
}
