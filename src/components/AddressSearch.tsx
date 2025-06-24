import React, { useState } from 'react';
import '../styles/components.css';
import { PktButton } from '@oslokommune/punkt-react';

interface AddressSearchProps {
  onSearch: (address: string) => void;
  isLoading?: boolean;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({ onSearch, isLoading = false }) => {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

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
      console.log('[AddressSearch] Søker etter adresse:', address);
      onSearch(address.trim());
    }
  };

  return (
    <div className="address-search">
      <form onSubmit={handleSubmit} className="address-search__form">
        <div className="address-search__input-wrapper">
          <label htmlFor="address-input" className="address-search__label">
            Søk etter adresse
          </label>
          <input
            id="address-input"
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) setError(''); // Clear error when typing
            }}
            placeholder="F.eks. Kapellveien 156B, 0493 Oslo"
            className={`pkt-input pkt-input--fullwidth ${error ? 'address-search__input--error' : ''}`}
            disabled={isLoading}
            autoComplete="street-address"
          />
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