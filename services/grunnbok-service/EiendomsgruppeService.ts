/**
 * EiendomsgruppeService — aggregerer unike bygg for et borettslag eller sameie.
 *
 * For BORETTSLAG: utnytter at hver borettslagsandel har `bruksenhetIdFraMatrikkelen`
 * som peker direkte til en Matrikkel-bruksenhet (som igjen har `byggId`).
 *   andel → adresse → bruksenhetId → byggId → dedup → ByggInfo
 *
 * For SAMEIE: bruker gnr/bnr på rot-matrikkelenheten til å finne alle Matrikkel-
 * matrikkelenheter (inkl. seksjoner/festegrunner), så alle bruksenheter per
 * matrikkelenhet, så dedup byggIds.
 */
import { MatrikkelClient, type MatrikkelContext } from "../../src/clients/MatrikkelClient.ts";
import { StoreClient } from "../../src/clients/StoreClient.ts";
import type { ByggInfo } from "../../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../../src/utils/endpoints.ts";
import { calculateTEK } from "../../src/utils/tekEnergyCalculations.ts";
import { getRuntimeConfig } from "../../packages/config/src/runtime.ts";
import {
  identService,
  registerenhetService,
  storeService,
  grunnbokEnabled,
} from "./context.ts";
import type { Borettslagsandel } from "./types.ts";
import { MatrikkelBruksenhetHelper } from "./MatrikkelBruksenhetHelper.ts";
import { TtlCache } from "./cache.ts";

export interface AggregatedBuilding {
  byggId: number;
  byggeaar: number | null;
  bruksarealM2: number | null;
  tekStandard: string;
  bygningstypeKodeId: number | null;
  antallEnheterIBygg: number;
}

export interface EiendomsgruppeResult {
  type: "borettslag" | "sameie";
  organisasjonsnummer?: string;
  borettslagId?: string;
  matrikkelenhetRot?: {
    kommunenummer: string;
    gaardsnummer: number;
    bruksnummer: number;
  };
  antallEnheter: number;
  antallUnikeBygg: number;
  totalBruksarealM2: number;
  byggeaarFordeling: Record<string, number>;
  tekFordeling: Record<string, number>;
  bygninger: AggregatedBuilding[];
  warnings: string[];
}

const runtimeConfig = getRuntimeConfig();
const matrikkelConfig = runtimeConfig.flags.liveMode
  ? runtimeConfig.matrikkel.prod
  : runtimeConfig.matrikkel.current;

const matrikkelContext: MatrikkelContext = {
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "eiendomsgruppe-service",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
};

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, "MatrikkelenhetService"),
  matrikkelConfig.username,
  matrikkelConfig.password
);

const byggStoreClient = new StoreClient(
  matrikkelEndpoint(matrikkelConfig.baseUrl, "StoreService"),
  matrikkelConfig.username,
  matrikkelConfig.password
);

const bruksenhetHelper = new MatrikkelBruksenhetHelper(
  matrikkelConfig.baseUrl,
  matrikkelConfig.username,
  matrikkelConfig.password
);

async function hentByggInfo(
  byggIds: number[],
  warnings: string[],
  concurrency = 10
): Promise<ByggInfo[]> {
  const all: ByggInfo[] = [];
  for (let i = 0; i < byggIds.length; i += concurrency) {
    const batch = byggIds.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return await byggStoreClient.getObject(id);
        } catch (err) {
          warnings.push(
            `Bygginfo feilet for byggId ${id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return null;
        }
      })
    );
    for (const r of results) if (r) all.push(r);
  }
  return all;
}

function aggregerBygg(
  byggInfo: ByggInfo[],
  byggIdCount: Map<number, number>
): {
  antallUnikeBygg: number;
  totalBruksarealM2: number;
  byggeaarFordeling: Record<string, number>;
  tekFordeling: Record<string, number>;
  bygninger: AggregatedBuilding[];
} {
  const bygninger: AggregatedBuilding[] = byggInfo.map((b) => ({
    byggId: b.id,
    byggeaar: b.byggeaar ?? null,
    bruksarealM2: b.bruksarealM2 ?? null,
    tekStandard: calculateTEK(b.byggeaar ?? 0),
    bygningstypeKodeId: b.bygningstypeKodeId ?? null,
    antallEnheterIBygg: byggIdCount.get(b.id) ?? 0,
  }));

  const byggeaarFordeling: Record<string, number> = {};
  const tekFordeling: Record<string, number> = {};
  let totalBruksareal = 0;

  for (const b of bygninger) {
    const yearKey =
      b.byggeaar == null
        ? "ukjent"
        : `${Math.floor(b.byggeaar / 10) * 10}-tallet`;
    byggeaarFordeling[yearKey] = (byggeaarFordeling[yearKey] ?? 0) + 1;
    tekFordeling[b.tekStandard] = (tekFordeling[b.tekStandard] ?? 0) + 1;
    if (b.bruksarealM2) totalBruksareal += b.bruksarealM2;
  }

  return {
    antallUnikeBygg: bygninger.length,
    totalBruksarealM2: totalBruksareal,
    byggeaarFordeling,
    tekFordeling,
    bygninger,
  };
}

const aggregatCache = new TtlCache<EiendomsgruppeResult>(60 * 60 * 1000);

export function clearEiendomsgruppeCache(): void {
  aggregatCache.clear();
}

/**
 * Aggregerer bygninger for et borettslag.
 * Flyt: orgnr → andeler (Grunnbok) → adresser med bruksenhetIdFraMatrikkelen
 *       → Matrikkel-bruksenheter → byggIds (dedupet) → ByggInfo.
 */
export async function aggregateForBorettslag(
  organisasjonsnummer: string
): Promise<EiendomsgruppeResult> {
  return aggregatCache.getOrCompute(
    `borettslag:${organisasjonsnummer}`,
    () => aggregateForBorettslagInternal(organisasjonsnummer)
  );
}

async function aggregateForBorettslagInternal(
  organisasjonsnummer: string
): Promise<EiendomsgruppeResult> {
  if (!grunnbokEnabled() || !identService || !registerenhetService || !storeService) {
    throw new Error("Grunnbok-tjenester ikke tilgjengelig");
  }

  const warnings: string[] = [];

  const borettslagId = await identService.findBorettslagId(organisasjonsnummer);
  if (!borettslagId) throw new Error(`Fant ikke borettslag ${organisasjonsnummer}`);

  const andelIds =
    await registerenhetService.findBorettslagsandelerForBorettslag(borettslagId);
  if (andelIds.length === 0) throw new Error("Ingen andeler i borettslaget");

  // Hent andeler (batched)
  const andeler: Borettslagsandel[] = [];
  for (let i = 0; i < andelIds.length; i += 20) {
    const batch = andelIds.slice(i, i + 20);
    const results = await Promise.all(
      batch.map((id) => storeService!.getBorettslagsandel(id))
    );
    andeler.push(...results);
  }
  const aktive = andeler.filter((a) => !a.utgaatt);

  // Hent adresser for å få bruksenhetIdFraMatrikkelen
  const bruksenhetIds = new Set<number>();
  for (let i = 0; i < aktive.length; i += 20) {
    const batch = aktive.slice(i, i + 20).filter((a) => a.adresseId);
    const adresser = await Promise.all(
      batch.map((a) => storeService!.getAdresse(a.adresseId!))
    );
    for (const adr of adresser) {
      if (adr.bruksenhetIdFraMatrikkelen) {
        bruksenhetIds.add(Number(adr.bruksenhetIdFraMatrikkelen));
      }
    }
  }

  // Matrikkel: bruksenhetId → byggId
  const { byggIdCount, misses } = await bruksenhetHelper.mapBruksenhetIdsToByggIds(
    Array.from(bruksenhetIds),
    10
  );
  if (misses > 0) {
    warnings.push(`${misses} bruksenheter manglet byggId i Matrikkel-responsen`);
  }

  const byggIds = Array.from(byggIdCount.keys());
  const byggInfo = await hentByggInfo(byggIds, warnings);

  return {
    type: "borettslag",
    organisasjonsnummer,
    borettslagId,
    antallEnheter: aktive.length,
    warnings,
    ...aggregerBygg(byggInfo, byggIdCount),
  };
}

/**
 * Aggregerer bygninger for et sameie basert på gnr/bnr.
 * Flyt: gnr/bnr → alle Matrikkel-matrikkelenheter (hoved + seksjoner + festegrunner)
 *       → for hver: bruksenhet-IDer → byggId (via StoreService) → dedupet → ByggInfo.
 */
export async function aggregateForSameie(
  kommunenummer: string,
  gaardsnummer: number,
  bruksnummer: number
): Promise<EiendomsgruppeResult> {
  return aggregatCache.getOrCompute(
    `sameie:${kommunenummer}-${gaardsnummer}-${bruksnummer}`,
    () => aggregateForSameieInternal(kommunenummer, gaardsnummer, bruksnummer)
  );
}

async function aggregateForSameieInternal(
  kommunenummer: string,
  gaardsnummer: number,
  bruksnummer: number
): Promise<EiendomsgruppeResult> {
  if (!grunnbokEnabled() || !identService || !registerenhetService || !storeService) {
    throw new Error("Grunnbok-tjenester ikke tilgjengelig");
  }

  const warnings: string[] = [];

  // Finn antall seksjoner via Grunnbok (for antallEnheter-rapporten)
  const gbMatId = await identService.findMatrikkelenhetId({
    kommunenummer,
    gaardsnummer,
    bruksnummer,
  });
  let antallEnheter = 0;
  if (gbMatId) {
    const seksjonIds = await registerenhetService.findSeksjonerFor(gbMatId);
    const seksjoner = await Promise.all(
      seksjonIds.map((id) => storeService!.getSeksjon(id))
    );
    antallEnheter = seksjoner.filter((s) => !s.utgaatt).length;
  }

  // Matrikkel: finn alle matrikkelenheter for gnr/bnr
  const matIds = await matrikkelClient.findMatrikkelenheter(
    { kommunenummer, gnr: gaardsnummer, bnr: bruksnummer },
    matrikkelContext
  );

  // For hver matrikkelenhet: hent bruksenhet-IDer (parallellisert)
  const allBruksenhetIds = new Set<number>();
  const batchSize = 20;
  for (let i = 0; i < matIds.length; i += batchSize) {
    const batch = matIds.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((meId) =>
        bruksenhetHelper.findBruksenhetIdsForMatrikkelenhet(meId)
      )
    );
    for (const ids of results) {
      for (const id of ids) allBruksenhetIds.add(id);
    }
  }

  if (antallEnheter === 0) antallEnheter = allBruksenhetIds.size;

  // Bruksenheter → byggIds (dedup)
  const { byggIdCount, misses } = await bruksenhetHelper.mapBruksenhetIdsToByggIds(
    Array.from(allBruksenhetIds),
    10
  );
  if (misses > 0) {
    warnings.push(`${misses} bruksenheter manglet byggId`);
  }

  const byggIds = Array.from(byggIdCount.keys());
  const byggInfo = await hentByggInfo(byggIds, warnings);

  return {
    type: "sameie",
    matrikkelenhetRot: { kommunenummer, gaardsnummer, bruksnummer },
    antallEnheter,
    warnings,
    ...aggregerBygg(byggInfo, byggIdCount),
  };
}
