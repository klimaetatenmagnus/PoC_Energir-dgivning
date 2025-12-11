import { useEffect, useState } from 'react';
import { createLogger } from '../../../utils/logger';

const logger = createLogger({ prefix: 'useAddressCoordinates' });

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

const isValidCoordinates = (coords: Coordinates | null | undefined): coords is Coordinates =>
  Boolean(
    coords &&
      Number.isFinite(coords.lat) &&
      Number.isFinite(coords.lng)
  );

export const useAddressCoordinates = (
  searchAddress: string,
  initialCoordinates?: Coordinates | null
) => {
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(
    isValidCoordinates(initialCoordinates) ? initialCoordinates : null
  );

  useEffect(() => {
    const trimmedAddress = searchAddress.trim();

    if (isValidCoordinates(initialCoordinates)) {
      setMapCoordinates(initialCoordinates);
      return undefined;
    }

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
          logger.warn(`Lookup failed with status ${response.status}`);
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
          logger.warn('Received invalid coordinates from Geonorge');
          setMapCoordinates(null);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        logger.warn('Failed to fetch coordinates', error);
        setMapCoordinates(null);
      }
    };

    void fetchCoordinates();

    return () => {
      controller.abort();
    };
  }, [initialCoordinates, searchAddress]);

  return mapCoordinates;
};
