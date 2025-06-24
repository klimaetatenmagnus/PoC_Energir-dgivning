// Mock API service for adresseoppslag
// I produksjon vil dette kalle backend API som wrapper resolveBuildingData

export interface AddressLookupRequest {
  address: string;
}

export interface AddressLookupResponse {
  adresse?: string;
  gnr: number;
  bnr: number;
  seksjonsnummer?: number;
  bruksarealM2?: number;
  totalBygningsareal?: number;
  byggeaar?: number;
  bygningstype?: string;
  bygningstypeKode?: string;
  bygningstypeKodeId?: number;
  bygningsnummer?: string;
  matrikkelenhetsId?: number;
  byggId?: number;
  rapporteringsNivaa?: string;
  energiattest?: {
    energikarakter?: string;
    oppvarmingskarakter?: string;
    utstedelsesdato?: string;
    attestnummer?: string;
    attestUrl?: string;
  };
  representasjonspunkt?: {
    east: number;
    north: number;
    epsg: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Mock data for testing
const mockData: Record<string, AddressLookupResponse> = {
  "Kapellveien 156B, 0493 Oslo": {
    adresse: "Kapellveien 156B",
    gnr: 73,
    bnr: 704,
    seksjonsnummer: 1,
    bruksarealM2: 186,
    totalBygningsareal: 186,
    byggeaar: 1952,
    bygningstype: "Tomannsbolig, vertikaldelt",
    bygningstypeKode: "121",
    bygningstypeKodeId: 4,
    bygningsnummer: "80184506",
    matrikkelenhetsId: 286103642,
    byggId: 80184506,
    rapporteringsNivaa: "bygning",
    representasjonspunkt: {
      east: 599422,
      north: 6648459,
      epsg: "EPSG:25833"
    }
  },
  "Kapellveien 156C, 0493 Oslo": {
    adresse: "Kapellveien 156C",
    gnr: 73,
    bnr: 704,
    seksjonsnummer: 2,
    bruksarealM2: 159,
    totalBygningsareal: 279,
    byggeaar: 2013,
    bygningstype: "Tomannsbolig, vertikaldelt",
    bygningstypeKode: "121",
    bygningstypeKodeId: 4,
    bygningsnummer: "300902680",
    matrikkelenhetsId: 453769728,
    byggId: 300902680,
    rapporteringsNivaa: "seksjon",
    energiattest: {
      energikarakter: "C",
      oppvarmingskarakter: "D",
      utstedelsesdato: "2023-05-15",
      attestnummer: "EF-123456",
      attestUrl: "https://www.energiattest.no/attest/EF-123456"
    },
    representasjonspunkt: {
      east: 599413,
      north: 6648469,
      epsg: "EPSG:25833"
    }
  },
  "Kjelsåsveien 97B, 0491 Oslo": {
    adresse: "Kjelsåsveien 97B",
    gnr: 75,
    bnr: 284,
    seksjonsnummer: 2,
    bruksarealM2: 95,
    byggeaar: 1985,
    bygningstype: "Rekkehus",
    bygningstypeKode: "131",
    bygningstypeKodeId: 8,
    bygningsnummer: "80230851",
    energiattest: {
      energikarakter: "G",
      oppvarmingskarakter: "F",
      utstedelsesdato: "2022-03-10",
      attestnummer: "EF-789012"
    },
    representasjonspunkt: {
      east: 598700,
      north: 6650400,
      epsg: "EPSG:25833"
    }
  }
};

export class BuildingApiService {
  private baseUrl: string;
  private useMockData: boolean;

  constructor(baseUrl: string = 'http://localhost:3001/api', useMockData: boolean = false) {
    this.baseUrl = baseUrl;
    this.useMockData = useMockData;
  }

  async lookupAddress(address: string): Promise<AddressLookupResponse> {
    console.log('[BuildingApiService] Looking up address:', address);
    const startTime = Date.now();

    try {
      if (this.useMockData) {
        // Simuler nettverkslatens
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Sjekk om vi har mock data for denne adressen
        const mockResult = mockData[address];
        if (mockResult) {
          const duration = Date.now() - startTime;
          console.log(`[BuildingApiService] Mock lookup completed in ${duration}ms`);
          return mockResult;
        }
        
        // Hvis ikke, kast en 404 feil
        throw new Error('404: Ingen bygningsdata funnet for denne adressen');
      }

      // Real API call (når backend er implementert)
      const response = await fetch(`${this.baseUrl}/address-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address } as AddressLookupRequest),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const duration = Date.now() - startTime;
      console.log(`[BuildingApiService] API lookup completed in ${duration}ms`);
      
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[BuildingApiService] Error after ${duration}ms:`, error);
      
      // Re-throw med mer kontekst
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Ukjent feil ved adresseoppslag');
    }
  }

  // Hjelpemetode for å validere respons
  validateResponse(data: any): data is AddressLookupResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.gnr === 'number' &&
      typeof data.bnr === 'number'
    );
  }
}

// Singleton instance for enkel bruk
export const buildingApi = new BuildingApiService();