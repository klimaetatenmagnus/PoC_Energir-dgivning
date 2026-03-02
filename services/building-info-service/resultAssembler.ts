import { csvService } from '../../src/services/csvService.ts';
import {
  determineBuildingTypeStrategy,
  shouldProcessBuildingType,
} from '../../src/utils/buildingTypeUtils.ts';
import type { ByggInfo } from '../../src/clients/StoreClient.ts';
import { LOG } from './context.ts';
import {
  recordBruksarealSource,
  recordByggeaarSource,
  recordSolarPresence,
} from './metrics.ts';
import { debugLog } from './logging.ts';
import type {
  LookupAdresseResult,
  EnergiattestResult,
  SolarData,
} from './matrikkel.ts';

export interface BuildingResult {
  gnr: number;
  bnr: number;
  seksjonsnummer: number | null;
  seksjonsnummerInferert: number | null;
  matrikkelenhetsId: number;
  byggId: number;
  bygningsnummer: string | null;
  byggeaar: number | null;
  bruksarealM2: number | null;
  totalBygningsareal: number | null;
  antallSeksjoner: number | null;
  representasjonspunkt: ByggInfo['representasjonspunkt'] | null;
  representasjonspunktPBE: { east: number; north: number } | null;
  coordinatesWgs84: { lat: number; lon: number } | null;
  energiattest: EnergiattestResult | null;
  bygningstypeKodeId: number | null;
  bygningstypeKode: string | null;
  bygningstype: string | null;
  rapporteringsNivaa: string | null;
  takAreal_m2: number | null;
  sol_kwh_m2_yr: number | null;
  sol_kwh_bygg_tot: number | null;
  solKategori: string | null;
  takflater: SolarData['takflater'];
  filteredSolarEnergy: number | null;
  csvData: {
    bygningsNr: string;
    bruksarealTotalt: number;
    bygningstype3siffer: string;
    bygningstypeNavn: string;
    tattIBrukDato: string;
    gateAdresse: string;
    bydelsnavn: string;
    delbydelsnavn: string;
    antallEtasjer: number | null;
    bygningsstatusNavn: string;
  } | null;
}

interface AssembleArgs {
  adresse: LookupAdresseResult;
  matrikkelenhetsId: number;
  bygg: ByggInfo & { id: number };
  allBygningsInfo: Array<ByggInfo & { id: number }>;
  seksjonsnummer?: number;
  seksjonForEnova?: number;
  rpPBE: { east: number; north: number } | null;
  coordinatesWgs84: { lat: number; lon: number } | null;
  attest: EnergiattestResult | null;
  solarData: SolarData | null;
}

export function assembleBuildingResult(args: AssembleArgs): BuildingResult {
  const {
    adresse,
    matrikkelenhetsId,
    bygg,
    allBygningsInfo,
    seksjonsnummer,
    seksjonForEnova,
    rpPBE,
    coordinatesWgs84,
    attest,
    solarData,
  } = args;

  const strategy = determineBuildingTypeStrategy(bygg.bygningstypeKodeId);

  let totalBygningsareal: number | null = null;
  let antallSeksjoner: number | null = null;
  let hovedbyggId: number | null = null;

  const erSeksjonertEiendom = seksjonsnummer || adresse.bokstav;

  if (erSeksjonertEiendom && allBygningsInfo.length > 0) {
    const hovedBygg = allBygningsInfo
      .filter((b) => shouldProcessBuildingType(b.bygningstypeKodeId))
      .reduce(
        (prev, curr) =>
          (curr.bruksarealM2 ?? 0) > (prev.bruksarealM2 ?? 0) ? curr : prev,
        allBygningsInfo[0]
      );

    if (hovedBygg) {
      totalBygningsareal = hovedBygg.bruksarealM2 ?? null;
      hovedbyggId = hovedBygg.id;

      if (bygg.bygningstypeKodeId === 4 || bygg.bygningstypeKodeId === 121) {
        antallSeksjoner = 2;
      }

      if (LOG) {
        debugLog(
          `📊 Seksjonert eiendom - Seksjon ${
            seksjonsnummer || adresse.bokstav
          }: ${bygg.bruksarealM2 ?? 'ukjent'} m²`
        );
        debugLog(
          `📊 Total bruksareal for hele bygget (bygg-ID ${hovedbyggId}): ${totalBygningsareal ?? 'ukjent'} m²`
        );
      }
    }
  }

  let csvData = null as
    | ReturnType<typeof csvService.findByExactAddress>
    | ReturnType<typeof csvService.findByBygningsNr>
    | null;

  if (adresse.adressetekst) {
    csvData = csvService.findByExactAddress(adresse.adressetekst);
    if (csvData && LOG) {
      debugLog(`📊 CSV-data funnet via adresse "${adresse.adressetekst}"`);
    }

    // Hvis CSV-treffet er garasje/uthus, bruk søsken-bolig i stedet
    if (csvData) {
      const code = parseInt(csvData.bygningstype3siffer, 10);
      if (code >= 180) {
        const sibling = csvService.findResidentialSibling(adresse.adressetekst);
        if (sibling) {
          if (LOG) {
            debugLog(`🏠 CSV-treff var garasje (type ${code}) – bruker søsken-bolig: ${sibling.gateAdresse} (${sibling.bygningsNr})`);
          }
          csvData = sibling;
        } else if (LOG) {
          debugLog(`⚠️  CSV-treff var garasje (type ${code}) – ingen søsken-bolig funnet`);
        }
      }
    }
  }

  if (!csvData) {
    // NB: adressetekst fra Geonorge inneholder allerede husnummer+bokstav,
    // så vi bruker den direkte (tidligere bug: dobbelt husnummer "Veien 1616")
    const searchAddress = (adresse.adressetekst || '').trim();
    if (searchAddress) {
      const matches = csvService.findByAddress(searchAddress);
      if (matches.length > 0) {
        csvData = matches[0];
        if (LOG) {
          debugLog(
            `📊 CSV-data funnet via søk "${searchAddress}" (${matches.length} treff)`
          );
        }
      }
    }
  }

  if (!csvData && bygg.bygningsnummer) {
    csvData = csvService.findByBygningsNr(bygg.bygningsnummer);
    if (csvData && LOG) {
      debugLog(`📊 CSV-data funnet for bygningsnummer ${bygg.bygningsnummer}:`);
      debugLog(`   - Bruksareal (CSV): ${csvData.bruksarealTotalt} m²`);
      debugLog(
        `   - Bygningstype (CSV): ${csvData.bygningstype3siffer} - ${csvData.bygningstypeNavn}`
      );
      debugLog(`   - Tatt i bruk: ${csvData.tattIBrukDato}`);
    }
  }

  // Bydel fallback: if csvData is missing, try to find bydel from nearby addresses
  let bydelFallback: { bydelsnavn: string; delbydelsnavn: string } | null =
    null;
  if (!csvData && adresse.adressetekst) {
    bydelFallback = csvService.findBydelByNearbyAddress(adresse.adressetekst);
    if (bydelFallback && LOG) {
      debugLog(
        `📊 Bydel funnet via nærliggende adresse for "${adresse.adressetekst}": ${bydelFallback.bydelsnavn}`
      );
    }
  }

  if (LOG && adresse.adressetekst.includes('Herslebs gate 11')) {
    debugLog('\n🔍 DEBUG Herslebs gate 11:');
    debugLog('  Matrikkel bygningsnummer:', bygg.bygningsnummer);
    debugLog('  CSV funnet:', csvData ? 'JA' : 'NEI');
    if (csvData) {
      debugLog('  CSV bygningsnummer:', csvData.bygningsNr);
      debugLog('  CSV bruksareal:', csvData.bruksarealTotalt);
      debugLog('  CSV adresse:', csvData.gateAdresse);
    }
  }

  const csvByggeaar = csvData?.tattIBrukDato
    ? parseInt(csvData.tattIBrukDato.substring(0, 4))
    : null;

  let finalBruksareal =
    csvData?.bruksarealTotalt || attest?.enovaBuildingData?.bruksareal || null;

  if (
    finalBruksareal === null &&
    erSeksjonertEiendom &&
    totalBygningsareal &&
    totalBygningsareal > 0
  ) {
    finalBruksareal = totalBygningsareal;
    if (LOG) {
      debugLog(
        `📐 Bruksareal mangler for seksjon – bruker totalBygningsareal (${totalBygningsareal} m²) som fallback`
      );
    }
  }

  if (finalBruksareal === null) {
    finalBruksareal = bygg.bruksarealM2 ?? null;
  }

  const finalByggeaar =
    csvByggeaar ||
    attest?.enovaBuildingData?.byggeaar ||
    bygg.byggeaar ||
    null;
  const finalBygningstype =
    csvData?.bygningstypeNavn ||
    attest?.enovaBuildingData?.bygningstype ||
    bygg.bygningstypeBeskrivelse ||
    strategy.description;

  if (LOG && adresse.adressetekst.includes('Herslebs gate 11')) {
    debugLog('  Final verdier:');
    debugLog('    - finalBruksareal:', finalBruksareal);
    debugLog('    - finalByggeaar:', finalByggeaar);
    debugLog('    - Matrikkel areal:', bygg.bruksarealM2);
    debugLog('    - Matrikkel byggeår:', bygg.byggeaar);
  }

  const bruksarealSource = csvData?.bruksarealTotalt
    ? 'csv'
    : attest?.enovaBuildingData?.bruksareal
    ? 'enova'
    : finalBruksareal
    ? 'matrikkel'
    : 'unknown';
  recordBruksarealSource(bruksarealSource);

  const byggeaarSource = csvByggeaar
    ? 'csv'
    : attest?.enovaBuildingData?.byggeaar
    ? 'enova'
    : bygg.byggeaar
    ? 'matrikkel'
    : 'unknown';
  recordByggeaarSource(byggeaarSource);

  recordSolarPresence(solarData ? 'present' : 'missing');

  return {
    gnr: adresse.gnr,
    bnr: adresse.bnr,
    seksjonsnummer: seksjonsnummer ?? null,
    seksjonsnummerInferert:
      !seksjonsnummer && seksjonForEnova ? seksjonForEnova : null,
    matrikkelenhetsId,
    byggId: bygg.id,
    bygningsnummer: bygg.bygningsnummer ?? null,
    byggeaar: finalByggeaar,
    bruksarealM2: finalBruksareal,
    totalBygningsareal,
    antallSeksjoner,
    representasjonspunkt: bygg.representasjonspunkt ?? null,
    representasjonspunktPBE: rpPBE,
    coordinatesWgs84,
    energiattest: attest,
    bygningstypeKodeId: bygg.bygningstypeKodeId ?? null,
    bygningstypeKode: bygg.bygningstypeKode ?? null,
    bygningstype: finalBygningstype,
    rapporteringsNivaa: strategy.reportingLevel,
    takAreal_m2: solarData?.takAreal_m2 ?? null,
    sol_kwh_m2_yr: solarData?.sol_kwh_m2_yr ?? null,
    sol_kwh_bygg_tot: solarData?.sol_kwh_bygg_tot ?? null,
    solKategori: solarData?.solKategori ?? null,
    takflater: solarData?.takflater ?? null,
    filteredSolarEnergy: solarData?.filteredSolarEnergy ?? null,
    csvData: csvData
      ? {
          bygningsNr: csvData.bygningsNr,
          bruksarealTotalt: csvData.bruksarealTotalt,
          bygningstype3siffer: csvData.bygningstype3siffer,
          bygningstypeNavn: csvData.bygningstypeNavn,
          tattIBrukDato: csvData.tattIBrukDato,
          gateAdresse: csvData.gateAdresse,
          bydelsnavn: csvData.bydelsnavn,
          delbydelsnavn: csvData.delbydelsnavn,
          antallEtasjer: csvData.antallEtasjer,
          bygningsstatusNavn: csvData.bygningsstatusNavn,
        }
      : bydelFallback
      ? {
          bygningsNr: '',
          bruksarealTotalt: 0,
          bygningstype3siffer: '',
          bygningstypeNavn: '',
          tattIBrukDato: '',
          gateAdresse: '',
          bydelsnavn: bydelFallback.bydelsnavn,
          delbydelsnavn: bydelFallback.delbydelsnavn,
          antallEtasjer: null,
          bygningsstatusNavn: '',
        }
      : null,
  };
}
