import { useEffect, useState } from 'react';

interface Coordinates {
  lat: number;
  lng: number;
}

export const useAddressCoordinates = (searchAddress: string) => {
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    const fetchCoordinates = async () => {
      try {
        console.log('Fetching coordinates for address:', searchAddress);
        const response = await fetch(
          `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(searchAddress)}&utkoordsys=4326&treffPerSide=1`
        );
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);
        if (data.adresser && data.adresser.length > 0) {
          // Koordinatene kommer som lat/lon objekter, ikke som coordinates array
          const { lat, lon } = data.adresser[0].representasjonspunkt;
          console.log('Setting coordinates:', { lat, lng: lon });
          setMapCoordinates({ lat, lng: lon });
        } else {
          console.log('No addresses found in response');
        }
      } catch (error) {
        console.error('Error fetching coordinates:', error);
      }
    };
    
    fetchCoordinates();
  }, [searchAddress]);

  return mapCoordinates;
};