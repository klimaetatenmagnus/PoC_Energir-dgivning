import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

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
      const csvPath = path.join(process.cwd(), 'Matrikkel 2023.csv');
      const fileContent = fs.readFileSync(csvPath, 'utf-8');
      
      // Parse CSV with semicolon delimiter
      const records = parse(fileContent, {
        columns: true,
        delimiter: ';',
        skip_empty_lines: true,
        bom: true // Handle BOM if present
      });

      // Transform records to camelCase and proper types
      this.data = records.map((record: any) => ({
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
      console.log(`[CSVService] Loaded ${this.data.length} records from Matrikkel CSV`);
    } catch (error) {
      console.error('[CSVService] Error loading CSV:', error);
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
    
    return this.data.filter(record => {
      const normalizedRecord = this.normalizeAddress(record.gateAdresse);
      return normalizedRecord.includes(normalizedSearch) || 
             normalizedSearch.includes(normalizedRecord);
    });
  }

  /**
   * Search for exact address match
   */
  findByExactAddress(address: string): MatrikkelCSVRecord | null {
    if (!this.isLoaded) return null;
    
    const normalizedSearch = this.normalizeAddress(address);
    
    const record = this.data.find(r => 
      this.normalizeAddress(r.gateAdresse) === normalizedSearch
    );
    
    return record || null;
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/,.*$/, '') // Remove everything after comma
      .replace(/oslo.*$/i, '') // Remove "oslo" and anything after
      .trim();
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