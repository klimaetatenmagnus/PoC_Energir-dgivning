import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createLogger } from '../utils/logger.ts';

const logger = createLogger({ prefix: 'csv-service' });

interface RawCSVRecord {
  BYGNINGS_NR: string;
  BYGGID_ANONYM: string;
  BRUKSAREAL_TOTALT: string;
  BRA_BOLIG: string;
  BRA_ANNET_BOLIG: string;
  BRA_hentet_fra_matrikkel: string;
  AREAL_BYGGFLATE: string;
  ANTALL_ETASJER: string;
  BYGNINGSSTATUS_NAVN: string;
  Bygningstype: string;
  Bygningstype_navn: string;
  BYGNINGSTYPE_3siffer: string;
  TATT_I_BRUK_DATO: string;
  FYLKE: string;
  KOM: string;
  BYDELNR: string;
  BYDELSNAVN: string;
  DELBYDELNR: string;
  DELBYDELSNAVN: string;
  GRUNNKRETS_NR: string;
  GRUNNKRETS_NAVN: string;
  Lokalitetskode: string;
  GateAdresse: string;
  Kalenderår: string;
  Hjelpekolonne: string;
  Tiår: string;
  [key: string]: string;
}

export interface MatrikkelCSVRecord {
  bygningsNr: string;
  byggidAnonym: string;
  bruksarealTotalt: number;
  braBolig: number;
  braAnnetBolig: number;
  braHentetFraMatrikkel: number;
  arealByggflate: number;
  antallEtasjer: number;
  bygningsstatusNavn: string;
  bygningstype: string;
  bygningstypeNavn: string;
  bygningstype3siffer: string;
  tattIBrukDato: string;
  fylke: string;
  kommune: string;
  bydelnr: string;
  bydelsnavn: string;
  delbydelnr: string;
  delbydelsnavn: string;
  grunnkretsNr: string;
  grunnkretsNavn: string;
  lokalitetskode: string;
  gateAdresse: string;
  kalenderaar: string;
  hjelpekolonne: string;
  tiaar: string;
}

export class CSVService {
  private data: MatrikkelCSVRecord[] = [];
  private isLoaded = false;

  constructor() {
    this.loadCSV();
  }

  private loadCSV() {
    try {
      const csvPath = path.join(process.cwd(), 'data', 'raw', 'Matrikkel 2023.csv');
      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      
      // Parse CSV with semicolon delimiter
      const records = parse<RawCSVRecord>(fileContent, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        bom: true // Handle BOM if present
      });

      // Transform records to camelCase and proper types
      this.data = records.map((record) => ({
        bygningsNr: record.BYGNINGS_NR,
        byggidAnonym: record.BYGGID_ANONYM,
        bruksarealTotalt: parseInt(String(record.BRUKSAREAL_TOTALT).replace(/\s/g, '')) || 0,
        braBolig: parseInt(String(record.BRA_BOLIG).replace(/\s/g, '')) || 0,
        braAnnetBolig: parseInt(String(record.BRA_ANNET_BOLIG).replace(/\s/g, '')) || 0,
        braHentetFraMatrikkel: parseInt(String(record.BRA_hentet_fra_matrikkel).replace(/\s/g, '')) || 0,
        arealByggflate: parseInt(String(record.AREAL_BYGGFLATE).replace(/\s/g, '')) || 0,
        antallEtasjer: parseInt(String(record.ANTALL_ETASJER).replace(/\s/g, '')) || 0,
        bygningsstatusNavn: record.BYGNINGSSTATUS_NAVN,
        bygningstype: record.Bygningstype,
        bygningstypeNavn: record.Bygningstype_navn,
        bygningstype3siffer: record.BYGNINGSTYPE_3siffer,
        tattIBrukDato: record.TATT_I_BRUK_DATO,
        fylke: record.FYLKE,
        kommune: record.KOM,
        bydelnr: record.BYDELNR,
        bydelsnavn: record.BYDELSNAVN,
        delbydelnr: record.DELBYDELNR,
        delbydelsnavn: record.DELBYDELSNAVN,
        grunnkretsNr: record.GRUNNKRETS_NR,
        grunnkretsNavn: record.GRUNNKRETS_NAVN,
        lokalitetskode: record.Lokalitetskode,
        gateAdresse: record.GateAdresse,
        kalenderaar: record.Kalenderår,
        hjelpekolonne: record.Hjelpekolonne,
        tiaar: record.Tiår
      }));

      this.isLoaded = true;
      logger.info(`Loaded ${this.data.length} records from Matrikkel CSV`);
    } catch (error) {
      logger.error('Error loading CSV:', error);
      this.data = [];
    }
  }

  /**
   * Search for building by building number
   */
  findByBygningsNr(bygningsNr: string): MatrikkelCSVRecord | null {
    if (!this.isLoaded) return null;
    
    const record = this.data.find(r => r.bygningsNr === bygningsNr);
    return record || null;
  }

  /**
   * Search for buildings by address (fuzzy match)
   */
  findByAddress(address: string): MatrikkelCSVRecord[] {
    if (!this.isLoaded) return [];
    
    // Normalize address for comparison
    const normalizedSearch = this.normalizeAddress(address);
    if (!normalizedSearch) {
      return [];
    }
    const searchStreet = this.extractStreetName(normalizedSearch);
    const searchHouse = this.extractHouseIdentifier(normalizedSearch);
    const candidates: Array<{ record: MatrikkelCSVRecord; score: number }> = [];
    
    this.data.forEach((record) => {
      const normalizedRecord = this.normalizeAddress(record.gateAdresse);
      if (!normalizedRecord) {
        return;
      }

      const recordStreet = this.extractStreetName(normalizedRecord);
      if (searchStreet && recordStreet && searchStreet !== recordStreet) {
        return;
      }

      const recordHouse = this.extractHouseIdentifier(normalizedRecord);
      if (searchHouse && recordHouse && searchHouse !== recordHouse) {
        return;
      }

      if (
        normalizedRecord.includes(normalizedSearch) ||
        normalizedSearch.includes(normalizedRecord)
      ) {
        const score = this.computeMatchScore(normalizedSearch, normalizedRecord);
        candidates.push({ record, score });
      }
    });

    return candidates
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.record);
  }

  /**
   * Search for exact address match.
   * If multiple buildings exist at the same address, prioritizes residential
   * buildings over garages/outbuildings.
   */
  findByExactAddress(address: string): MatrikkelCSVRecord | null {
    if (!this.isLoaded) return null;

    const normalizedSearch = this.normalizeAddress(address);
    if (!normalizedSearch) {
      return null;
    }

    // Find ALL records matching the address
    const allMatches = this.data.filter(r =>
      this.normalizeAddress(r.gateAdresse) === normalizedSearch
    );

    if (allMatches.length === 0) {
      return null;
    }

    // If only one match, return it
    if (allMatches.length === 1) {
      return allMatches[0];
    }

    // Multiple buildings at same address - prioritize residential over garages
    // Building type codes: 181 = Garage/outbuilding, 111-149 = Residential
    const residentialBuildings = allMatches.filter(r => {
      const code = parseInt(r.bygningstype3siffer, 10);
      // Include residential buildings (11x-14x) but exclude garages (18x)
      return code >= 110 && code < 180;
    });

    // Return the residential building with the largest area (most likely the main building)
    if (residentialBuildings.length > 0) {
      return residentialBuildings.reduce((largest, current) =>
        current.bruksarealTotalt > largest.bruksarealTotalt ? current : largest
      );
    }

    // Fallback: return the first match if no residential buildings found
    return allMatches[0];
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    if (!address) {
      return '';
    }

    let normalized = address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    normalized = normalized
      .replace(/[,;].*$/, '') // Remove everything after comma/semicolon
      .trim();

    // Remove trailing postal code + city (e.g. "0173 oslo")
    normalized = normalized
      .replace(/\b\d{4}\s+oslo$/, '')
      .replace(/\b\d{4}\b$/, '')
      .trim();

    // Remove trailing standalone "oslo" (city), but not street names like "Oslo gate"
    normalized = normalized.replace(/\s+oslo$/, '').trim();

    // Normalize house numbers with letters: "97 b" -> "97b"
    normalized = normalized.replace(/(\d+)\s*([a-z])/g, '$1$2');

    return normalized.trim();
  }

  private extractStreetName(value: string): string {
    if (!value) {
      return '';
    }
    return value.replace(/\d.*$/, '').trim();
  }

  private extractHouseIdentifier(value: string): string {
    if (!value) {
      return '';
    }
    const match = value.match(/(\d+[a-zæøå]?)/i);
    return match ? match[1] : '';
  }

  private computeMatchScore(search: string, candidate: string): number {
    if (candidate === search) {
      return Number.POSITIVE_INFINITY; // exact matches should always win
    }

    const startsWith =
      candidate.startsWith(search) || search.startsWith(candidate) ? 1 : 0;
    const lengthDelta = Math.abs(candidate.length - search.length);
    // Higher score is better; penalize large length differences
    return startsWith * 10 - lengthDelta;
  }

  /**
   * Get all records (for debugging)
   */
  getAllRecords(): MatrikkelCSVRecord[] {
    return this.data;
  }

  /**
   * Check if CSV is loaded
   */
  isReady(): boolean {
    return this.isLoaded;
  }
}

// Singleton instance
export const csvService = new CSVService();
