import { useEffect, useState } from 'react';

interface Coordinates {
  lat: number;
  lng: number;
}

interface GeonorgeAddress {
  representasjonspunkt?: {
    lat: number | string;
    lon: number | string;
  };
}

interface GeonorgeResponse {
  adresser?: GeonorgeAddress[];
}

const GEONORGE_LOOKUP_URL = 'https://ws.geonorge.no/adresser/v1/sok';

export const useAddressCoordinates = (searchAddress: string) => {
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(null);

  useEffect(() => {
    const trimmedAddress = searchAddress.trim();

    if (!trimmedAddress) {
      setMapCoordinates(null);
      return undefined;
    }

    const controller = new AbortController();

    const fetchCoordinates = async () => {
      try {
        const endpoint = new URL(GEONORGE_LOOKUP_URL);
        endpoint.searchParams.set('sok', trimmedAddress);
        endpoint.searchParams.set('utkoordsys', '4326');
        endpoint.searchParams.set('treffPerSide', '1');

        const response = await fetch(endpoint.toString(), { signal: controller.signal });

        if (!response.ok) {
          console.warn(`[useAddressCoordinates] Lookup failed with status ${response.status}`);
          setMapCoordinates(null);
          return;
        }

        const data = (await response.json()) as GeonorgeResponse;
        const representasjonspunkt = data.adresser?.[0]?.representasjonspunkt;

        if (!representasjonspunkt) {
          setMapCoordinates(null);
          return;
        }

        const lat = Number(representasjonspunkt.lat);
        const lon = Number(representasjonspunkt.lon);

        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setMapCoordinates({ lat, lng: lon });
        } else {
          console.warn('[useAddressCoordinates] Received invalid coordinates from Geonorge');
          setMapCoordinates(null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.warn('[useAddressCoordinates] Failed to fetch coordinates', error);
        setMapCoordinates(null);
      }
    };

    void fetchCoordinates();

    return () => {
      controller.abort();
    };
  }, [searchAddress]);

  return mapCoordinates;
};
