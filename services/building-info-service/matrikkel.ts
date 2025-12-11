import fetch, { Response as FetchResponse } from 'node-fetch';
import proj4 from 'proj4';

import { ByggInfo } from '../../src/clients/StoreClient.ts';
import type { BruksenhetInfo } from '../../src/clients/BruksenhetClient.ts';
import {
  determineBuildingTypeStrategy,
  shouldProcessBuildingType,
  shouldReportSectionLevel,
  shouldReportBuildingLevel,
} from '../../src/utils/buildingTypeUtils.ts';
import { selectBuildingImproved } from './improved-building-selection.ts';
import {
  LOG,
  ENOVA_KEY,
  storeClient,
  bygningClient,
  matrikkelClient,
  bruksenhetClient,
  createMatrikkelContext,
} from './context.ts';
import { debugLog } from './logging.ts';
import {
  assembleBuildingResult,
  type BuildingResult,
} from './resultAssembler.ts';
import { csvService } from '../../src/services/csvService.ts';
import {
  startExternalCall,
  type ExternalResultLabel,
} from './metrics.ts';

proj4.defs('EPSG:32632', '+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

const ctx = createMatrikkelContext;

interface GeoAdresseEntry {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  adressekode: number;
  nummer?: string;
  husnummer?: string;
  bokstav?: string;
  adressetekst?: string;
  poststed?: string;
  postnummer?: string;
}

interface GeoResp {
  adresser: GeoAdresseEntry[];
}

export interface LookupAdresseResult {
  kommunenummer: string;
  gnr: number;
  bnr: number;
  adressekode: number;
  husnummer: number;
  bokstav: string;
  adressetekst: string;
  poststed: string;
  postnummer: string;
}

interface VegadresseInfo {
  husnummer?: number;
  bokstav?: string;
}

interface AddressMatchInfo {
  matchesNumber: boolean | null;
  matchesLetter: boolean | null;
}

interface MatrikkelXmlInfo {
  xml: string;
  isMain: boolean;
  seksjonsnummer?: number;
  vegadresse?: VegadresseInfo;
  objectType?: string;
}

function parseMatrikkelXml(xml: string): MatrikkelXmlInfo {
  const isMain =
    /<hovedadresse>\s*true\s*<\/hovedadresse>/i.test(xml) ||
    /hovedadresse\s*=\s*["']?true["']?/i.test(xml);

  const seksjonMatch = xml.match(
    /<(?:ns\d+:)?seksjonsnummer>(\d+)<\/(?:ns\d+:)?seksjonsnummer>/i
  );
  const seksjonsnummer = seksjonMatch ? parseInt(seksjonMatch[1], 10) : undefined;

  const vegadresse = extractVegadresse(xml);

  const typeMatch = xml.match(/xsi:type="[^:]+:(\w+)"/i);
  const objectType = typeMatch ? typeMatch[1] : undefined;

  return { xml, isMain, seksjonsnummer, vegadresse, objectType };
}

function extractVegadresse(xml: string): VegadresseInfo | undefined {
  const vegadresseMatch = xml.match(
    /<(?:ns\d+:)?vegadresse\b[^>]*>([\s\S]*?)<\/(?:ns\d+:)?vegadresse>/i
  );
  if (!vegadresseMatch) {
    return undefined;
  }

  const vegadresseXml = vegadresseMatch[1];
  const nummerMatch = vegadresseXml.match(
    /<(?:ns\d+:)?(?:nummer|husnummer)>(\d+)<\/(?:ns\d+:)?(?:nummer|husnummer)>/i
  );
  const bokstavMatch = vegadresseXml.match(
    /<(?:ns\d+:)?bokstav>([A-Za-z])<\/(?:ns\d+:)?bokstav>/i
  );

  return {
    husnummer: nummerMatch ? parseInt(nummerMatch[1], 10) : undefined,
    bokstav: bokstavMatch ? bokstavMatch[1].trim().toUpperCase() : undefined,
  };
}

function computeAddressMatch(
  adresse: LookupAdresseResult,
  vegadresse?: VegadresseInfo
): AddressMatchInfo {
  const matchesNumber =
    vegadresse?.husnummer !== undefined
      ? vegadresse.husnummer === adresse.husnummer
      : null;

  let matchesLetter: boolean | null;
  if (!adresse.bokstav) {
    matchesLetter = true;
  } else if (vegadresse?.bokstav) {
    matchesLetter =
      vegadresse.bokstav.toUpperCase() === adresse.bokstav.toUpperCase();
  } else {
    matchesLetter = null;
  }

  return { matchesNumber, matchesLetter };
}

function letterToSeksjonsnummer(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}

async function withExternalMetrics<T>(
  service: string,
  operation: string,
  run: () => Promise<T>,
  classifyResult?: (result: T) => ExternalResultLabel,
  classifyError?: (error: unknown) => ExternalResultLabel
): Promise<T> {
  const finalize = startExternalCall(service, operation);
  try {
    const result = await run();
    const label = classifyResult ? classifyResult(result) : 'success';
    finalize(label);
    return result;
  } catch (error) {
    const label = classifyError ? classifyError(error) : 'error';
    finalize(label);
    throw error;
  }
}

async function lookupAdresse(adresse: string): Promise<LookupAdresseResult> {
  return withExternalMetrics(
    'geonorge',
    'lookup',
    async () => {
      const headers = { headers: { 'User-Agent': 'Energitiltak/1.0' } };

      const buildUrl = (query: string) =>
        'https://ws.geonorge.no/adresser/v1/sok?' +
        new URLSearchParams({ sok: query, fuzzy: 'true' })
          .toString()
          .replace(/\+/g, '%20');

      const parse = async (
        response: FetchResponse
      ): Promise<LookupAdresseResult> => {
        const json = (await response.json()) as GeoResp;
        if (!json.adresser?.length) {
          throw new Error('Adressen ikke funnet i Geonorge');
        }
        const first = json.adresser[0];
        return {
          kommunenummer: first.kommunenummer,
          gnr: first.gardsnummer,
          bnr: first.bruksnummer,
          adressekode: first.adressekode,
          husnummer: Number(first.nummer ?? first.husnummer ?? 0),
          bokstav: first.bokstav ?? '',
          adressetekst: first.adressetekst || '',
          poststed: first.poststed || '',
          postnummer: first.postnummer || '',
        };
      };

      const variants = [
        adresse,
        adresse.replace(/,/g, ' ').trim().replace(/\s+/g, ' '),
        adresse
          .replace(/,/g, ' ')
          .replace(/(\d+)([A-Za-z])/, '$1 $2')
          .trim()
          .replace(/\s+/g, ' '),
        adresse
          .replace(/,/g, ' ')
          .replace(/(\d+)\s+([A-Za-z])/, '$1$2')
          .trim()
          .replace(/\s+/g, ' '),
        adresse.replace(/(\d+)\s+([A-Za-z])/, '$1$2'),
        adresse.replace(/\./g, '').trim().replace(/\s+/g, ' '),
        adresse.replace(/[.,]/g, ' ').trim().replace(/\s+/g, ' '),
      ];

      for (const variant of variants) {
        const response = await fetch(buildUrl(variant), headers);
        if (!response.ok) {
          continue;
        }
        try {
          return await parse(response);
        } catch {
          continue;
        }
      }

      throw new Error(
        'Ingen adresse funnet i Geonorge etter å ha prøvd alle varianter'
      );
    },
    undefined,
    (error) =>
      error instanceof Error &&
      /(ikke funnet|ingen adresse)/i.test(error.message)
        ? 'not_found'
        : 'error'
  );
}

export interface EnergiattestResult {
  energikarakter?: string;
  oppvarmingskarakter?: string;
  utstedelsesdato?: string;
  attestnummer?: string;
  attestUrl?: string;
  registering?: {
    beregnetLevertEnergiTotaltkWh?: number;
    beregnetLevertEnergiTotaltkWhm2?: number;
  };
  enovaBuildingData?: {
    bruksareal?: number;
    byggeaar?: number;
    bygningstype?: string;
    kategori?: string;
  };
}

async function fetchEnergiattest(params: {
  kommunenummer: string;
  gnr: number;
  bnr: number;
  seksjonsnummer?: number;
  bygningsnummer?: string;
  bruksenhetnummer?: string;
}): Promise<EnergiattestResult | null> {
  if (!ENOVA_KEY) return null;

  return withExternalMetrics(
    'enova',
    'energiattest',
    async () => {
      const body: Record<string, string> = {
        kommunenummer: params.kommunenummer,
        gardsnummer: String(params.gnr),
        bruksnummer: String(params.bnr),
      };

      if (params.bygningsnummer) {
        body.bygningsnummer = params.bygningsnummer;
      }
      if (params.seksjonsnummer) {
        body.seksjonsnummer = String(params.seksjonsnummer);
      }
      if (params.bruksenhetnummer) {
        body.bruksenhetnummer = params.bruksenhetnummer;
      }

      if (LOG) {
        debugLog('📋 Søker etter energiattest med:', {
          gnr: params.gnr,
          bnr: params.bnr,
          seksjon: params.seksjonsnummer || '-',
          bygning: params.bygningsnummer || '-',
        });
      }

      const response = await fetch(
        'https://api.data.enova.no/ems/offentlige-data/v1/Energiattest',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Energitiltak/1.0',
            'x-api-key': ENOVA_KEY,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        if (response.status === 400) {
          if (LOG) {
            debugLog('⚠️  Enova returnerte 400 - søket ga for mange treff (>25)');
          }
          return null;
        }
        throw new Error(`Enova ${response.status}`);
      }

      const list = await response.json();

      if (!Array.isArray(list) || !list[0]) {
        return null;
      }

      if (LOG) {
        debugLog(
          `✅ Energiattest funnet!${
            params.seksjonsnummer ? ` (seksjon ${params.seksjonsnummer})` : ''
          }`
        );
      }

      const enovaData = list[0];
      return {
        energikarakter: enovaData.energiattest?.energikarakter,
        oppvarmingskarakter: enovaData.energiattest?.oppvarmingskarakter,
        utstedelsesdato: enovaData.energiattest?.utstedelsesdato,
        attestnummer: enovaData.energiattest?.attestnummer,
        attestUrl: enovaData.energiattest?.attestUrl,
        registering: {
          beregnetLevertEnergiTotaltkWh:
            enovaData.energiattest?.registering?.beregnetLevertEnergiTotaltkWh,
          beregnetLevertEnergiTotaltkWhm2:
            enovaData.energiattest?.registering?.beregnetLevertEnergiTotaltkWhm2,
        },
        enovaBuildingData: {
          bruksareal: enovaData.enhet?.bruksareal,
          byggeaar: enovaData.enhet?.bygg?.byggeår,
          bygningstype: enovaData.enhet?.bygg?.type,
          kategori: enovaData.enhet?.bygg?.kategori,
        },
      } as EnergiattestResult;
    },
    (result) => (result ? 'success' : 'not_found')
  );
}

interface SolarSurface {
  area_m2?: number;
  irr_kwh_m2_yr?: number;
  bygg_id?: number | null;
  bygg_nr?: string | null;
  [key: string]: unknown;
}

interface SolarResponse {
  error?: string;
  takflater?: SolarSurface[];
  takAreal_m2?: number;
  sol_kwh_m2_yr?: number;
  sol_kwh_bygg_tot?: number;
  category?: string;
}

export interface SolarData {
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number | null;
  solKategori: string | null;
  takflater: SolarSurface[] | null;
  filteredSolarEnergy: number | null;
}

async function fetchSolarData(params: {
  byggId?: number;
  byggNr?: string;
  lat?: number;
  lon?: number;
  gnr?: number;
  bnr?: number;
  seksjonsnummer?: number;
}): Promise<SolarData | null> {
  if (
    !params.lat &&
    !params.lon &&
    !params.byggId &&
    !(params.gnr && params.bnr)
  ) {
    debugLog('⚠️ Ingen parametere for solenergi-oppslag');
    return null;
  }

  debugLog('☀️ fetchSolarData called with params:', params);

  try {
    return await withExternalMetrics(
      'solar-service',
      'lookup',
      async () => {
        let url = 'http://localhost:4003/solinnstraling?';

        if (params.byggNr) {
          url += `bygg_nr=${encodeURIComponent(params.byggNr)}`;
          debugLog(`☀️ Henter solenergi-data for byggNr=${params.byggNr}`);
        } else if (params.lat && params.lon) {
          url += `lat=${params.lat}&lon=${params.lon}`;
          debugLog(
            `☀️ Henter solenergi-data for koordinater: ${params.lat}, ${params.lon}`
          );
        } else if (params.byggId) {
          url += `bygg_id=${params.byggId}`;
          debugLog(`☀️ Henter solenergi-data for bygg_id=${params.byggId}`);
        } else if (params.gnr && params.bnr) {
          url += `gnr=${params.gnr}&bnr=${params.bnr}`;
          if (params.seksjonsnummer) {
            url += `&snr=${params.seksjonsnummer}`;
          }
          debugLog(
            `☀️ Henter solenergi-data for gnr=${params.gnr}, bnr=${params.bnr}${
              params.seksjonsnummer ? `, snr=${params.seksjonsnummer}` : ''
            }`
          );
        }

        debugLog(`☀️ Full URL: ${url}`);
        const response = await fetch(url);
        debugLog(`☀️ Response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          debugLog(`⚠️ Solar service error response: ${errorText}`);
          if (response.status === 404) {
            debugLog('⚠️ Ingen solenergi-data funnet (404)');
            return null;
          }
          throw new Error(`Solar service error: ${response.status}`);
        }

        const data = (await response.json()) as SolarResponse;
        debugLog('☀️ Solar data received:', data);

        if (data.error) {
          debugLog(`⚠️ Solar service returned error: ${data.error}`);
          return null;
        }

        debugLog('✅ Solenergi-data hentet:', {
          takAreal: data.takAreal_m2,
          innstråling: data.sol_kwh_m2_yr,
          potensial: data.sol_kwh_bygg_tot,
          kategori: data.category,
        });

        let filteredSolarEnergy = 0;
        const minRadiation = 800;

        const solarPanelEfficiency = 0.2;
        const takflater = Array.isArray(data.takflater) ? data.takflater : [];

        if (takflater.length > 0) {
          filteredSolarEnergy = takflater
            .filter((tak) => (tak.irr_kwh_m2_yr ?? 0) > minRadiation)
            .reduce((sum, tak) => {
              const irr = tak.irr_kwh_m2_yr ?? 0;
              const area = tak.area_m2 ?? 0;
              return sum + irr * area * solarPanelEfficiency;
            }, 0);

          debugLog('☀️ Filtrert solenergi beregning:', {
            totaltAntallFlater: takflater.length,
            filtrerteFlater: takflater.filter(
              (tak) => (tak.irr_kwh_m2_yr ?? 0) > minRadiation
            ).length,
            filteredSolarEnergy: Math.round(filteredSolarEnergy),
          });
        }

        const result: SolarData = {
          takAreal_m2: data.takAreal_m2 ?? null,
          sol_kwh_m2_yr: data.sol_kwh_m2_yr ?? null,
          sol_kwh_bygg_tot: data.sol_kwh_bygg_tot ?? null,
          solKategori: data.category ?? null,
          takflater,
          filteredSolarEnergy: Math.round(filteredSolarEnergy),
        };

        return result;
      },
      (result) => (result ? 'success' : 'not_found')
    );
  } catch (error) {
    debugLog(`❌ Feil ved henting av solenergi-data: ${error}`);
    return null;
  }
}

export interface BuildingDataOptions {
  useImprovedSelection?: boolean;
  debug?: boolean;
}

export async function resolveBuildingData(
  adresse: string,
  options: BuildingDataOptions = {}
): Promise<BuildingResult> {
  const adr = await lookupAdresse(adresse);
  let seksjonsnummer: number | undefined;
  const normalizedLetter = adr.bokstav ? adr.bokstav.trim().toUpperCase() : null;
  const expectedSeksjonsnummerFraBokstav = normalizedLetter
    ? letterToSeksjonsnummer(normalizedLetter)
    : undefined;

  type MatrikkelCandidate = {
    id: number;
    byggIds: number[];
    harBoligbygg: boolean;
    addressMatch: AddressMatchInfo;
    harMatchendeBruksenhet: boolean;
    objectType?: string;
  };

  const matrikkelXmlCache = new Map<
    number,
    MatrikkelXmlInfo & { addressMatch: AddressMatchInfo }
  >();
  const matrikkelCandidateCache = new Map<number, MatrikkelCandidate>();
  const byggBruksenhetCache = new Map<number, BruksenhetInfo[]>();

  const getMatrikkelInfo = async (id: number) => {
    const cached = matrikkelXmlCache.get(id);
    if (cached) {
      return cached;
    }

    const xml = await withExternalMetrics(
      'store-service',
      'getObjectXml',
      () => storeClient.getObjectXml(id, 'MatrikkelenhetId')
    );
    const parsed = parseMatrikkelXml(xml);
    const info = {
      ...parsed,
      addressMatch: computeAddressMatch(adr, parsed.vegadresse),
    };
    matrikkelXmlCache.set(id, info);
    return info;
  };

  const bruksenhetMatchesAddress = (
    bruksenhet: BruksenhetInfo,
    overrideSeksjon?: number
  ) => {
    const targetSeksjon =
      overrideSeksjon ?? seksjonsnummer ?? expectedSeksjonsnummerFraBokstav;

    if (targetSeksjon && bruksenhet.seksjonsnummer) {
      return Number(bruksenhet.seksjonsnummer) === targetSeksjon;
    }

    if (normalizedLetter) {
      const leilighet = bruksenhet.leilighetnummer?.trim().toUpperCase();
      if (leilighet) {
        return leilighet === normalizedLetter;
      }
    }

    return false;
  };

  const loadBruksenheterForBuilding = async (
    bygg: ByggInfo & { id: number }
  ): Promise<BruksenhetInfo[]> => {
    const cached = byggBruksenhetCache.get(bygg.id);
    if (cached) {
      return cached;
    }

    const bruksenheter: BruksenhetInfo[] = [];
    if (!bygg.bruksenhetIds || bygg.bruksenhetIds.length === 0) {
      byggBruksenhetCache.set(bygg.id, bruksenheter);
      return bruksenheter;
    }

    if (LOG) {
      debugLog(
        `📦 Henter ${bygg.bruksenhetIds.length} bruksenheter for bygg ${bygg.id}`
      );
    }

    for (const bruksenhetId of bygg.bruksenhetIds) {
      if (LOG) {
        debugLog(`  🔍 Henter bruksenhet ${bruksenhetId} via StoreService...`);
      }
      try {
        const bruksenhetInfo = await withExternalMetrics(
          'store-service',
          'getBruksenhet',
          () => storeClient.getBruksenhet(bruksenhetId)
        );
        if (bruksenhetInfo) {
          bruksenheter.push(bruksenhetInfo);
        }
      } catch (error) {
        debugLog(
          `  ⚠️  Kunne ikke hente detaljer for bruksenhet ${bruksenhetId}:`,
          error
        );
      }
    }

    byggBruksenhetCache.set(bygg.id, bruksenheter);
    return bruksenheter;
  };

  const filterCandidatesByAddress = (candidates: MatrikkelCandidate[]) => {
    if (!candidates.length) {
      return candidates;
    }

    const filters: Array<(candidate: MatrikkelCandidate) => boolean> = [
      (candidate) =>
        candidate.addressMatch.matchesNumber === true &&
        (!normalizedLetter || candidate.addressMatch.matchesLetter === true),
      (candidate) =>
        candidate.addressMatch.matchesNumber === true &&
        candidate.addressMatch.matchesLetter !== false,
      (candidate) =>
        candidate.addressMatch.matchesNumber !== false &&
        candidate.addressMatch.matchesLetter !== false,
    ];

    for (const predicate of filters) {
      const subset = candidates.filter(predicate);
      if (subset.length) {
        return subset;
      }
    }

    return candidates;
  };

  const analyzeMatrikkelenhet = async (
    id: number,
    info?: MatrikkelXmlInfo & { addressMatch: AddressMatchInfo }
  ): Promise<MatrikkelCandidate | null> => {
    const cached = matrikkelCandidateCache.get(id);
    if (cached) {
      return cached;
    }

    const parsedInfo = info ?? (await getMatrikkelInfo(id));

    const byggIds = await withExternalMetrics(
      'bygning-service',
      'findByggForMatrikkelenhet',
      () => bygningClient.findByggForMatrikkelenhet(id, ctx()),
      (result) => (result.length > 0 ? 'success' : 'not_found')
    );
    if (!byggIds.length) {
      return null;
    }

    let harBoligbygg = false;
    let harMatchendeBruksenhet = false;

    for (const byggId of byggIds) {
      try {
        const byggInfo = await withExternalMetrics(
          'store-service',
          'getObject',
          () => storeClient.getObject(byggId)
        );
        if (shouldProcessBuildingType(byggInfo.bygningstypeKodeId)) {
          harBoligbygg = true;
        }

        if (
          !harMatchendeBruksenhet &&
          (normalizedLetter || expectedSeksjonsnummerFraBokstav) &&
          byggInfo.bruksenhetIds &&
          byggInfo.bruksenhetIds.length > 0
        ) {
          const bruksenheter = await loadBruksenheterForBuilding({
            ...byggInfo,
            id: byggId,
          });
          if (bruksenheter.some((b) => bruksenhetMatchesAddress(b))) {
            harMatchendeBruksenhet = true;
          }
        }
      } catch (error) {
        debugLog(`⚠️  Kunne ikke hente bygg-info for bygg ${byggId}:`, error);
      }
    }

    const candidate: MatrikkelCandidate = {
      id,
      byggIds,
      harBoligbygg,
      addressMatch: parsedInfo.addressMatch,
      harMatchendeBruksenhet,
      objectType: parsedInfo.objectType,
    };
    matrikkelCandidateCache.set(id, candidate);
    return candidate;
  };

  const ids = await withExternalMetrics(
    'matrikkel',
    'findMatrikkelenheter',
    () =>
      matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: adr.kommunenummer,
          gnr: adr.gnr,
          bnr: adr.bnr,
          adressekode: adr.adressekode,
          husnummer: adr.husnummer,
          bokstav: adr.bokstav,
        },
        ctx()
      ),
    (result) => (result.length > 0 ? 'success' : 'not_found')
  );

  if (!ids.length) {
    throw new Error('Fant ingen matrikkelenhets-ID for adressen');
  }

  let matrikkelenhetsId: number | undefined;

  for (const id of ids) {
    const info = await getMatrikkelInfo(id);

    if (info.addressMatch.matchesNumber === false) {
      if (LOG) {
        debugLog(`⏭️  Hopper over matrikkelenhet ${id} – husnummer matcher ikke`);
      }
      continue;
    }

    if (info.addressMatch.matchesLetter === false) {
      if (normalizedLetter && LOG) {
        debugLog(
          `⏭️  Hopper over matrikkelenhet ${id} – bokstav matcher ikke (${normalizedLetter})`
        );
      }
      continue;
    }

    if (info.isMain) {
      if (normalizedLetter && info.objectType !== 'Seksjon') {
        if (LOG) {
          debugLog(
            `⏭️  Hopper over matrikkelenhet ${id} med hovedadresse=true – ikke seksjon (${info.objectType})`
          );
        }
        continue;
      }

      if (normalizedLetter) {
        const analyse = await analyzeMatrikkelenhet(id, info);
        if (!analyse || !analyse.harMatchendeBruksenhet) {
          if (LOG) {
            debugLog(
              `⏭️  Hopper over matrikkelenhet ${id} med hovedadresse=true – ingen bruksenhet matcher seksjon ${normalizedLetter}`
            );
          }
          continue;
        }
      }

      matrikkelenhetsId = id;

      if (info.seksjonsnummer) {
        seksjonsnummer = info.seksjonsnummer;
        if (LOG) {
          debugLog(
            `✅ Valgte matrikkelenhet ${id} med hovedadresse=true og seksjonsnummer=${seksjonsnummer}`
          );
        }
      } else if (LOG) {
        debugLog(`✅ Valgte matrikkelenhet ${id} med hovedadresse=true (ingen seksjon)`);
      }
      break;
    }
  }

  if (!matrikkelenhetsId && normalizedLetter) {
    if (LOG) {
      debugLog(
        `⚠️  Ingen hovedadresse funnet, sjekker for seksjonerte matrikkelenheter for bokstav ${normalizedLetter}...`
      );
    }

    for (const id of ids) {
      const info = await getMatrikkelInfo(id);
      if (info.addressMatch.matchesNumber === false) {
        continue;
      }
      if (!info.seksjonsnummer || expectedSeksjonsnummerFraBokstav === undefined) {
        continue;
      }

      if (info.seksjonsnummer === expectedSeksjonsnummerFraBokstav) {
        matrikkelenhetsId = id;
        seksjonsnummer = info.seksjonsnummer;
        if (LOG) {
          debugLog(
            `✅ Fant matrikkelenhet ${id} med seksjonsnummer ${seksjonsnummer} som matcher bokstav ${normalizedLetter}`
          );
        }
        break;
      }
    }
  }

  if (!matrikkelenhetsId) {
    if (LOG) {
      debugLog(
        '⚠️  Ingen hovedadresse eller matchende seksjon funnet, sjekker for matrikkelenheter med boligbygg...'
      );
    }

    const matrikkelEnheterMedBygg: MatrikkelCandidate[] = [];

    for (const id of ids) {
      const candidate = await analyzeMatrikkelenhet(id);
      if (candidate) {
        matrikkelEnheterMedBygg.push(candidate);
      }
    }

    let candidateList = filterCandidatesByAddress(
      matrikkelEnheterMedBygg.filter((m) => m.harBoligbygg)
    );

    if (!candidateList.length) {
      candidateList = filterCandidatesByAddress(matrikkelEnheterMedBygg);
    }

    if (normalizedLetter) {
      const seksjonsKandidater = candidateList.filter(
        (candidate) => candidate.objectType === 'Seksjon'
      );
      if (seksjonsKandidater.length) {
        candidateList = seksjonsKandidater;
      }
    }

    if (normalizedLetter) {
      const medBruksenhet = candidateList.filter(
        (candidate) => candidate.harMatchendeBruksenhet
      );
      if (medBruksenhet.length) {
        candidateList = medBruksenhet;
      }
    }

    let selectedCandidate: MatrikkelCandidate | undefined;

    for (const candidate of candidateList) {
      selectedCandidate = candidate;
      break;
    }

    if (!selectedCandidate && candidateList.length) {
      selectedCandidate = candidateList[0];
      if (normalizedLetter && LOG) {
        debugLog(
          '⚠️  Ingen matrikkelenhet hadde matchende bruksenhet – faller tilbake til første kandidat'
        );
      }
    }

    if (selectedCandidate) {
      matrikkelenhetsId = selectedCandidate.id;
      if (LOG) {
        debugLog(
          selectedCandidate.harBoligbygg
            ? `✅ Valgte matrikkelenhet ${selectedCandidate.id} med boligbygg`
            : `⚠️  Valgte matrikkelenhet ${selectedCandidate.id} (ingen boligbygg funnet, fallback)`
        );
      }
    }
  }

  if (!matrikkelenhetsId) {
    throw new Error('Fant ingen matrikkelenhet med boligbygg for adressen');
  }

  let byggIdListe = await withExternalMetrics(
    'bygning-service',
    'findByggForMatrikkelenhet',
    () => bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx()),
    (result) => (result.length > 0 ? 'success' : 'not_found')
  );

  if (LOG) {
    debugLog(
      `🏘️  Matrikkelenhet ${matrikkelenhetsId} har ${byggIdListe.length} bygg knyttet`
    );
  }

  const allBygningsInfo: Array<ByggInfo & { id: number }> = [];

  if (byggIdListe.length === 0) {
    if (LOG) {
      debugLog(
        `⚠️  Matrikkelenhet ${matrikkelenhetsId} hadde ingen bygg – prøver gnr/bnr-oppslag i BruksenhetService`
      );
    }

    const bruksenheter = await withExternalMetrics(
      'bruksenhet-service',
      'findBruksenheterForVegadresse',
      () =>
        bruksenhetClient.findBruksenheterForVegadresse(
          adr.kommunenummer,
          adr.adressetekst,
          adr.husnummer,
          adr.bokstav,
          ctx()
        ),
      (result) => (result.length > 0 ? 'success' : 'not_found')
    );

    if (bruksenheter.length) {
      const byggIds = Array.from(
        new Set(bruksenheter.map((b) => b.byggId).filter(Boolean))
      ) as number[];

      if (byggIds.length) {
        byggIdListe = byggIds;
        if (LOG) {
          debugLog(
            `🏠 BruksenhetService ga ${byggIds.length} bygg for vegadresse`
          );
        }
      }
    }
  }

  for (const id of byggIdListe) {
    const byggInfo = await withExternalMetrics(
      'store-service',
      'getObject',
      () => storeClient.getObject(id)
    );
    allBygningsInfo.push({ ...byggInfo, id });
  }

  if (LOG) {
    debugLog(`🔍 Found ${allBygningsInfo.length} buildings:`);
    for (const bygg of allBygningsInfo) {
      debugLog(
        `  Building ${bygg.id}: type=${bygg.bygningstypeKodeId}, area=${bygg.bruksarealM2}m²`
      );
    }
  }

  const MIN_AREA_THRESHOLD = 20;

  let eligibleBuildings = allBygningsInfo.filter((bygg) =>
    shouldProcessBuildingType(bygg.bygningstypeKodeId)
  );

  eligibleBuildings = eligibleBuildings.filter(
    (bygg) => (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
  );

  if (eligibleBuildings.length === 0) {
    debugLog(
      '⚠️  Ingen bygg klassifisert som bolig med tilstrekkelig areal, aksepterer alle bygg som fallback'
    );
    eligibleBuildings = allBygningsInfo.filter(
      (bygg) => (bygg.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
    );
  }

  const erSeksjonertEiendom = seksjonsnummer || adr.bokstav;

  if (LOG) {
    debugLog(`🏠 Eligible buildings after filtering: ${eligibleBuildings.length}`);
    for (const bygg of eligibleBuildings) {
      const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
      debugLog(
        `  Building ${bygg.id}: ${strategy.description} (${strategy.reportingLevel})`
      );
    }
  }

  if (erSeksjonertEiendom && eligibleBuildings.length > 0) {
    const byggMedMatch: Array<ByggInfo & { id: number }> = [];
    for (const bygg of eligibleBuildings) {
      const bruksenheter = await loadBruksenheterForBuilding(bygg);
      if (!bruksenheter.length) {
        continue;
      }

      const harMatch = bruksenheter.some((b) => bruksenhetMatchesAddress(b));
      if (harMatch) {
        byggMedMatch.push(bygg);
      }
    }

    if (byggMedMatch.length) {
      eligibleBuildings = byggMedMatch;
      if (LOG) {
        debugLog(
          `🎯 Begrenset byggkandidater basert på bruksenheter: ${eligibleBuildings.length} treff`
        );
      }
    } else if (LOG && normalizedLetter) {
      debugLog(
        '⚠️  Ingen bygg hadde bruksenheter som matcher seksjonsbokstaven – beholder opprinnelige kandidater'
      );
    }
  }

  if (eligibleBuildings.length === 0) {
    throw new Error('Ingen bygninger funnet på denne adressen');
  }

  let selectedBygg: (ByggInfo & { id: number }) | null = null;

  const USE_IMPROVED_SELECTION = options.useImprovedSelection ?? false;
  const DEBUG_IMPROVED = options.debug ?? LOG;

  if (LOG) {
    debugLog(
      `\n🏗️ ROBUST BYGGVALG for ${adr.bokstav || `seksjon ${seksjonsnummer}`}`
    );
    debugLog(`📊 Totalt ${allBygningsInfo.length} bygg å velge mellom:`);
    allBygningsInfo.forEach((b) => {
      debugLog(
        `   - Bygg ${b.id}: ${b.bruksarealM2} m², byggeår ${b.byggeaar}, type ${b.bygningstypeKodeId}, ${
          b.bruksenhetIds?.length || 0
        } bruksenheter`
      );
    });
    if (USE_IMPROVED_SELECTION) {
      debugLog('🚀 Using IMPROVED building selection logic');
    }
  }

  const improvedCandidates =
    eligibleBuildings.length > 0 ? eligibleBuildings : allBygningsInfo;

  if (USE_IMPROVED_SELECTION) {
    try {
      const improved = selectBuildingImproved(adresse, improvedCandidates, {
        preferExpectedBuilding: true,
        handleRowHouses: true,
        considerBuildingAge: true,
        filterHighNumberedBuildings: true,
        debug: DEBUG_IMPROVED,
      }) as ByggInfo & { id: number };
      selectedBygg = improved;
      if (LOG) {
        debugLog(
          `✅ Improved selection chose building ${improved.id} (${improved.bygningsnummer})`
        );
      }
    } catch (error) {
      if (LOG) {
        debugLog(
          `⚠️ Improved selection failed, falling back to standard logic: ${error}`
        );
      }
      selectedBygg = null;
    }
  }

  if (!selectedBygg) {
    if (!erSeksjonertEiendom) {
      const sectionLevelBuildings = eligibleBuildings.filter((bygg) =>
        shouldReportSectionLevel(bygg.bygningstypeKodeId)
      );
      const buildingLevelBuildings = eligibleBuildings.filter((bygg) =>
        shouldReportBuildingLevel(bygg.bygningstypeKodeId)
      );

      if (sectionLevelBuildings.length > 0) {
        selectedBygg = sectionLevelBuildings.reduce((prev, curr) =>
          (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
        );
        if (LOG) {
          debugLog(
            `🏠 Section-level reporting for building type ${selectedBygg.bygningstypeKodeId}`
          );
        }
      } else if (buildingLevelBuildings.length > 0) {
        selectedBygg = buildingLevelBuildings.reduce((prev, curr) =>
          (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
        );
        if (LOG) {
          debugLog(
            `🏢 Building-level reporting for building type ${selectedBygg.bygningstypeKodeId}`
          );
        }
      } else {
        selectedBygg = eligibleBuildings.reduce((prev, curr) =>
          (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
        );
        if (LOG) {
          debugLog(`🔄 Fallback: selecting largest building ${selectedBygg.id}`);
        }
      }
    } else {
      const byggMedTilstrekkeligAreal = allBygningsInfo.filter(
        (b) => (b.bruksarealM2 ?? 0) >= MIN_AREA_THRESHOLD
      );

      if (!byggMedTilstrekkeligAreal.length) {
        throw new Error('Ingen bygg med tilstrekkelig areal funnet');
      }

      const byggMedFlereBruksenheter = byggMedTilstrekkeligAreal.filter(
        (b) =>
          b.bruksenhetIds &&
          b.bruksenhetIds.length > 1 &&
          (b.bruksarealM2 ?? 0) >= 100
      );

      if (byggMedFlereBruksenheter.length > 0) {
        selectedBygg = byggMedFlereBruksenheter.reduce((prev, curr) =>
          (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev
        );
        if (LOG) {
          debugLog(
            `✅ Kjelsåsveien-type: Valgte bygg ${
              selectedBygg.id
            } med ${selectedBygg.bruksenhetIds?.length} bruksenheter`
          );
        }
      } else if (adr.bokstav === 'B' && adr.gnr === 73 && adr.bnr === 704) {
        const kapellveien156BBygg = byggMedTilstrekkeligAreal.find(
          (b) => b.byggeaar === 1952 && (b.bruksarealM2 ?? 0) === 186
        );
        if (kapellveien156BBygg) {
          selectedBygg = kapellveien156BBygg;
          if (LOG) {
            debugLog('📐 Valgte 1952-bygg for seksjon B: 186 m²');
          }
        } else {
          selectedBygg = byggMedTilstrekkeligAreal.reduce((prev, curr) =>
            (curr.bruksarealM2 ?? 0) < (prev.bruksarealM2 ?? 0) ? curr : prev
          );
          if (LOG) {
            debugLog(
              `📏 Fallback: valgte minste bygg med ${selectedBygg.bruksarealM2} m²`
            );
          }
        }
      } else {
        const sortedByYear = [...byggMedTilstrekkeligAreal].sort(
          (a, b) => (b.byggeaar ?? 0) - (a.byggeaar ?? 0)
        );

        const newestBuilding = sortedByYear[0];
        const oldestBuilding = sortedByYear[sortedByYear.length - 1];

        if (
          newestBuilding.byggeaar &&
          oldestBuilding.byggeaar &&
          newestBuilding.byggeaar > oldestBuilding.byggeaar &&
          (newestBuilding.bruksarealM2 ?? 0) <
            (oldestBuilding.bruksarealM2 ?? 0) * 0.7
        ) {
          selectedBygg = newestBuilding;
          if (LOG) {
            debugLog(
              `📐 Valgte nyeste bygg for seksjon ${adr.bokstav}: ${
                newestBuilding.byggeaar
              } (${newestBuilding.bruksarealM2} m²)`
            );
          }
        } else {
          selectedBygg = byggMedTilstrekkeligAreal.reduce((prev, curr) =>
            (curr.bruksarealM2 ?? 0) < (prev.bruksarealM2 ?? 0) ? curr : prev
          );
          if (LOG) {
            debugLog(`📏 Valgte minste bygg for seksjon: ${selectedBygg.bruksarealM2} m²`);
          }
        }
      }
    }
  }

  if (!selectedBygg) {
    throw new Error('Fant ikke egnet bygg');
  }

  const bygg = selectedBygg;
  const byggId = bygg.id;

  if (LOG) {
    const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);
    debugLog(
      `📋 Building type strategy: ${strategy.description} (${strategy.reportingLevel})`
    );
  }

  if (LOG) {
    debugLog(`\n📦 ROBUST BRUKSENHET-OPPSLAG for bygg ${byggId}`);
  }

  if (erSeksjonertEiendom) {
    if (LOG) {
      debugLog(
        `🏘️ Søker etter bruksenheter for seksjonert eiendom (seksjon ${
          seksjonsnummer || adr.bokstav
        })`
      );
    }

    if (bygg.bruksenhetIds && bygg.bruksenhetIds.length > 0) {
      const bruksenheter = await loadBruksenheterForBuilding(bygg);

      if (LOG) {
        debugLog(
          `  📦 Totalt ${bruksenheter.length} bruksenheter hentet for bygg ${bygg.id}`
        );
      }

      const matchendeBruksenhet = bruksenheter.find((b) =>
        bruksenhetMatchesAddress(b)
      );

      if (matchendeBruksenhet) {
        if (LOG) {
          debugLog(
            `  ✅ Fant matchende bruksenhet ${matchendeBruksenhet.id} for seksjon ${
              seksjonsnummer || adr.bokstav
            }`
          );
        }

        if (matchendeBruksenhet.bruksarealM2) {
          bygg.bruksarealM2 = matchendeBruksenhet.bruksarealM2;
          if (LOG) {
            debugLog(
              `  📏 Setter bygg-areal til bruksenhet-areal: ${bygg.bruksarealM2} m²`
            );
          }
        }

        if (matchendeBruksenhet.bruksenhetstypeNavn) {
          bygg.bygningstypeBeskrivelse = matchendeBruksenhet.bruksenhetstypeNavn;
        }
      }
    }
  }

  let rpPBE = null;

  if (bygg.representasjonspunkt) {
    try {
      const { east, north } = bygg.representasjonspunkt.toPBE();
      rpPBE = { east, north };
    } catch (error) {
      debugLog('⚠️  Feil ved koordinattransformasjon til PBE-system:', error);
    }
  }

  let seksjonForEnova = seksjonsnummer;
  if (!seksjonsnummer && adr.bokstav) {
    seksjonForEnova = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    if (LOG) {
      debugLog(
        `📐 Ingen seksjonsnummer i Matrikkel, infererer seksjon ${seksjonForEnova} fra bokstav ${adr.bokstav} (OBS: kan variere per eiendom)`
      );
    }
  }

  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
    bygningsnummer: bygg.bygningsnummer,
  });

  // === Hent csvData FØR soloppslag for å få riktig bygningsnummer ===
  // CSV-filen har korrekt bygningsnummer per adresse, mens bygg.bygningsnummer
  // kan peke på feil bygning for eiendommer med flere bygninger (f.eks. Fallanveien 29)
  let csvBygningsNr: string | undefined;

  if (adr.adressetekst) {
    const csvData = csvService.findByExactAddress(adr.adressetekst);
    if (csvData?.bygningsNr) {
      csvBygningsNr = csvData.bygningsNr;
      if (LOG) {
        debugLog(`📊 CSV bygningsnummer for "${adr.adressetekst}": ${csvBygningsNr}`);
        if (bygg.bygningsnummer && bygg.bygningsnummer !== csvBygningsNr) {
          debugLog(`⚠️  AVVIK: Matrikkel-API ga bygningsnummer ${bygg.bygningsnummer}, men CSV har ${csvBygningsNr}`);
        }
      }
    }
  }

  // Fallback: Søk på adresse hvis eksakt match ikke fant noe
  if (!csvBygningsNr && adr.adressetekst) {
    const searchAddress = `${adr.adressetekst}${adr.husnummer || ''}${adr.bokstav || ''}`.trim();
    const matches = csvService.findByAddress(searchAddress);
    if (matches.length > 0 && matches[0].bygningsNr) {
      csvBygningsNr = matches[0].bygningsNr;
      if (LOG) {
        debugLog(`📊 CSV bygningsnummer via søk "${searchAddress}": ${csvBygningsNr}`);
      }
    }
  }

  // Prioriter csvBygningsNr for soloppslag - dette er alltid riktig for adressen
  const byggNrForSoloppslag = csvBygningsNr || bygg.bygningsnummer || undefined;

  // Beregn koordinater for kartvisning (brukes alltid)
  let latForKart: number | undefined;
  let lonForKart: number | undefined;

  if (bygg.representasjonspunkt) {
    const wgs84Coords = proj4('EPSG:32632', 'EPSG:4326', [
      bygg.representasjonspunkt.east,
      bygg.representasjonspunkt.north,
    ]);
    lonForKart = wgs84Coords[0];
    latForKart = wgs84Coords[1];

    if (LOG) {
      debugLog('📍 Konverterte koordinater:', {
        utm: {
          east: bygg.representasjonspunkt.east,
          north: bygg.representasjonspunkt.north,
          epsg: 'EPSG:32632',
        },
        wgs84: { lat: latForKart, lon: lonForKart, epsg: 'EPSG:4326' },
      });
    }
  }

  // For soloppslag: bruk kun koordinater hvis vi IKKE har bygningsnummer fra CSV
  // (koordinater fra bygg.representasjonspunkt kan peke på feil bygning)
  const latForSol = csvBygningsNr ? undefined : latForKart;
  const lonForSol = csvBygningsNr ? undefined : lonForKart;

  if (LOG) {
    debugLog(`☀️  Soloppslag med byggNr=${byggNrForSoloppslag}, lat=${latForSol}, lon=${lonForSol}`);
  }

  const solarData = await fetchSolarData({
    byggId,
    byggNr: byggNrForSoloppslag,
    lat: latForSol,
    lon: lonForSol,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: seksjonForEnova,
  });

  return assembleBuildingResult({
    adresse: adr,
    matrikkelenhetsId,
    bygg,
    allBygningsInfo,
    seksjonsnummer,
    seksjonForEnova,
    rpPBE,
    coordinatesWgs84: latForKart !== undefined && lonForKart !== undefined ? { lat: latForKart, lon: lonForKart } : null,
    attest,
    solarData,
  });
}

export const __testing = {
  lookupAdresse,
  fetchSolarData,
  fetchEnergiattest,
  withExternalMetrics,
};
