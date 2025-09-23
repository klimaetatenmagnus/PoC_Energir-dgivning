// Mock API service for adresseoppslag
// I produksjon vil dette kalle backend API som wrapper resolveBuildingData

export interface AddressLookupRequest {
  address: string;
  useImprovedSelection?: boolean;
  debug?: boolean;
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
  bygningstypeNavn?: string;
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
    registering?: {
      beregnetLevertEnergiTotaltkWh?: number;
    };
  };
  representasjonspunkt?: {
    east: number;
    north: number;
    epsg: string;
  };
  takAreal_m2?: number;
  sol_kwh_m2_yr?: number;
  sol_kwh_bygg_tot?: number;
  solKategori?: string;
  takflater?: Array<{
    tak_id: number;
    bygg_id: number | null;
    area_m2: number;
    irr_kwh_m2_yr: number;
    kWh_tot: number;
  }>;
  filteredSolarEnergy?: number;
  arealLeilighet?: number;
  csvData?: {
    adresse?: string;
    bygningstype?: string;
    bygningstypeNavn?: string;
    bygningstypekode?: string;
    bygningstypeKode?: string;
    byggeaar?: string;
    bruksareal_totalt?: string;
    takflate_main?: string;
    vurdert_egnet_for_solceller?: string;
    kwh_sol_tak_aar?: string;
    kategori_sol?: string;
    gnr?: string;
    bnr?: string;
    bydelsnavn?: string;
    areal_leilighet?: string;
  };
}

export interface AddressSuggestion {
  adresse?: string;
  adressetekst?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
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

  private buildUrl(path: string): string {
    const normalizedBase = this.baseUrl.endsWith('/')
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  private isAddressSuggestion(value: unknown): value is AddressSuggestion {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const entry = value as Record<string, unknown>;
    const hasValidAdresse =
      entry.adresse === undefined || typeof entry.adresse === 'string';
    const hasValidTekst =
      entry.adressetekst === undefined ||
      typeof entry.adressetekst === 'string';

    return hasValidAdresse && hasValidTekst;
  }

  async lookupAddress(
    address: string,
    useImprovedSelection: boolean = false,
    debug: boolean = false
  ): Promise<AddressLookupResponse> {
    if (this.useMockData) {
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockResult = mockData[address];
      if (mockResult) {
        return mockResult;
      }

      throw new Error('404: Ingen bygningsdata funnet for denne adressen');
    }

    const response = await fetch(this.buildUrl('/address-lookup'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, useImprovedSelection, debug } satisfies AddressLookupRequest),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        (errorData as ApiError).message || `${response.status}: ${response.statusText}`
      );
    }

    const data: unknown = await response.json();

    if (!this.validateResponse(data)) {
      throw new Error('Ugyldig respons fra adresseoppslag');
    }

    return data;
  }

  async fetchSuggestions(query: string): Promise<AddressSuggestion[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const url = `${this.buildUrl('/address-suggestions')}?query=${encodeURIComponent(
      trimmedQuery
    )}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorMessage = `${response.status}: ${response.statusText}`;
      throw new Error(`Feil ved henting av adresseforslag (${errorMessage})`);
    }

    const payload = (await response.json()) as {
      suggestions?: unknown;
    };

    if (!Array.isArray(payload.suggestions)) {
      return [];
    }

    return payload.suggestions.filter((suggestion): suggestion is AddressSuggestion =>
      this.isAddressSuggestion(suggestion)
    );
  }

  // Hjelpemetode for å validere respons
  validateResponse(data: unknown): data is AddressLookupResponse {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const record = data as Record<string, unknown>;

    return (
      typeof record.gnr === 'number' &&
      typeof record.bnr === 'number'
    );
  }
}

// Singleton instance for enkel bruk
export const buildingApi = new BuildingApiService();
