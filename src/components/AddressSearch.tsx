import React, { useState, useEffect, useRef } from 'react';
import '../styles/components.css';
import { PktButton } from '@oslokommune/punkt-react';
import { resolveApiUrl } from '../runtimeConfig.ts';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'address-search' });

interface AddressSearchProps {
  onSearch: (address: string) => void;
  isLoading?: boolean;
}

interface AddressSuggestion {
  adressetekst: string;
  adresse: string;
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  adressekode: number;
  nummer: string;
  bokstav: string | null;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({ onSearch, isLoading = false }) => {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch address suggestions from API
  const fetchSuggestions = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(
        `${resolveApiUrl('address-suggestions')}?query=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        logger.error('Failed to fetch suggestions:', response.status, errorData);
        setSuggestions([]);
      }
    } catch (error) {
      logger.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (value: string) => {
    setAddress(value);
    if (error) setError('');
    setSelectedIndex(-1);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debouncing (300ms delay)
    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleSuggestionSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.adresse);
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setError('');
  };

  const validateAddress = (addr: string): boolean => {
    // Enkel validering - sjekk at vi har minst gate og kommune
    const trimmed = addr.trim();
    if (!trimmed) {
      setError('Vennligst skriv inn en adresse');
      return false;
    }
    
    // Sjekk at vi har komma (for å skille gate fra postnr/kommune)
    if (!trimmed.includes(',')) {
      setError('Adresse må inneholde gate og kommune, f.eks. "Kapellveien 156B, 0493 Oslo"');
      return false;
    }

    // Sjekk at vi har noe etter komma
    const parts = trimmed.split(',');
    if (parts.length < 2 || !parts[1].trim()) {
      setError('Adresse må inneholde kommune etter komma');
      return false;
    }

    setError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateAddress(address)) {
      onSearch(address.trim());
      setShowSuggestions(false);
    }
  };

  return (
    <div className="address-search" ref={wrapperRef}>
      <form onSubmit={handleSubmit} className="address-search__form">
        <div className="address-search__input-wrapper">
          <label htmlFor="address-input" className="address-search__label">
            Søk etter adresse
          </label>
          <div className="address-search__autocomplete-wrapper">
            <input
              id="address-input"
              type="text"
              value={address}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="F.eks. Kapellveien 156B, 0493 Oslo"
              className={`pkt-input pkt-input--fullwidth ${error ? 'address-search__input--error' : ''}`}
              disabled={isLoading}
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls="address-suggestions"
              aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul 
                id="address-suggestions"
                className="address-search__suggestions"
                role="listbox"
              >
                {isLoadingSuggestions ? (
                  <li className="address-search__suggestion address-search__suggestion--loading">
                    Søker...
                  </li>
                ) : (
                  suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      id={`suggestion-${index}`}
                      className={`address-search__suggestion ${
                        index === selectedIndex ? 'address-search__suggestion--selected' : ''
                      }`}
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      {suggestion.adressetekst || suggestion.adresse}
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
          {error && (
            <div className="address-search__error" role="alert">
              {error}
            </div>
          )}
        </div>
        <PktButton
          iconName="magnifying-glass-big"
          size="medium"
          skin="primary"
          variant="icon-left"
          type="submit"
          disabled={isLoading}
          className="address-search__button"
        >
          {isLoading ? 'Søker...' : 'Søk'}
        </PktButton>
      </form>
    </div>
  );
};
