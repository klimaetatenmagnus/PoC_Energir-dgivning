import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import { parse } from 'csv-parse/sync';
import { createLogger } from '../utils/logger.ts';
import {
  SOLAR_FILTER_DEFAULTS,
  calculateFilteredSolarEnergy,
  type SolarFilterConfig,
} from '../utils/solarFilter.ts';

export { SOLAR_FILTER_DEFAULTS, type SolarFilterConfig };

const logger = createLogger({ prefix: 'solar-csv-service' });

interface RawSolarRow {
  bygningsnummer: string;
  tak_id: string;
  area_m2: string;
  irr_kwh_m2_yr: string;
  homogen_m2: string;
  flatt_tak: string;
}

export interface SolarTakflate {
  tak_id: number;
  area_m2: number;
  irr_kwh_m2_yr: number;
  homogen_m2: number | null;
  flatt_tak: boolean;
}

export interface SolarBuildingAggregate {
  bygningsnummer: number;
  takflater: SolarTakflate[];
  takAreal_m2: number;
  sol_kwh_bygg_tot: number;
  sol_kwh_m2_yr: number;
  filteredSolarEnergy: number;
  antallTakflaterTotalt: number;
  antallTakflaterEtterFilter: number;
}

const toNum = (v: string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export class SolarCsvService {
  private byBygningsnummer = new Map<number, SolarTakflate[]>();
  private isLoaded = false;
  private readonly _readyPromise: Promise<void>;

  constructor() {
    this._readyPromise = this.load();
  }

  async waitForReady(): Promise<void> {
    return this._readyPromise;
  }

  private async load(): Promise<void> {
    try {
      const bucketName = process.env.DATA_BUCKET;
      const solarFile = process.env.DATA_SOLAR_FILE ?? 'solar/solar_tak_wfs.csv';
      let content: string;
      if (bucketName) {
        const storage = new Storage();
        const [buf] = await storage.bucket(bucketName).file(solarFile).download();
        content = buf.toString('utf-8');
        logger.info(`Loading solar CSV from gs://${bucketName}/${solarFile}`);
      } else {
        const csvPath = path.join(process.cwd(), 'data', 'raw', 'solar_tak_wfs.csv');
        content = fs.readFileSync(csvPath, 'utf-8');
        logger.info(`Loading solar CSV from local file: ${csvPath}`);
      }

      const records = parse<RawSolarRow>(content, {
        columns: true,
        delimiter: ',',
        skip_empty_lines: true,
        bom: true,
      });

      let kept = 0;
      for (const r of records) {
        const bnr = toNum(r.bygningsnummer);
        const area = toNum(r.area_m2);
        const irr = toNum(r.irr_kwh_m2_yr);
        const takId = toNum(r.tak_id);
        if (bnr == null || area == null || irr == null || takId == null) continue;
        const tak: SolarTakflate = {
          tak_id: takId,
          area_m2: area,
          irr_kwh_m2_yr: irr,
          homogen_m2: toNum(r.homogen_m2),
          flatt_tak: r.flatt_tak === 'Ja',
        };
        const arr = this.byBygningsnummer.get(bnr);
        if (arr) arr.push(tak);
        else this.byBygningsnummer.set(bnr, [tak]);
        kept++;
      }
      this.isLoaded = true;
      logger.info(
        `Indexed ${kept} takflater across ${this.byBygningsnummer.size} unike bygg`,
      );
    } catch (err) {
      logger.error('Error loading solar CSV:', err);
    }
  }

  /**
   * Aggregert solar-data for ett bygg. Returnerer null hvis bygget ikke
   * finnes i CSV-en (bygg utenfor Oslo, nyoppført etter 2025-03-03, osv.).
   *
   * `filteredSolarEnergy` bruker formelen:
   *   Σ (area × irr × areaCoverage × panelEfficiency)
   * over takflater der irr > minRadiation OG area ≥ minArea.
   */
  getForBygningsnummer(
    bygningsnummer: number,
    config: SolarFilterConfig = SOLAR_FILTER_DEFAULTS,
  ): SolarBuildingAggregate | null {
    const takflater = this.byBygningsnummer.get(bygningsnummer);
    if (!takflater || takflater.length === 0) return null;

    let takAreal = 0;
    let sumKwhTot = 0;
    let antallEtterFilter = 0;
    for (const t of takflater) {
      takAreal += t.area_m2;
      sumKwhTot += t.area_m2 * t.irr_kwh_m2_yr;
      if (
        t.irr_kwh_m2_yr > config.minRadiation &&
        t.area_m2 >= config.minArea
      ) {
        antallEtterFilter++;
      }
    }
    const filteredEnergy = calculateFilteredSolarEnergy(takflater, config);
    const avgIrr = takAreal > 0 ? sumKwhTot / takAreal : 0;

    return {
      bygningsnummer,
      takflater,
      takAreal_m2: takAreal,
      sol_kwh_bygg_tot: sumKwhTot,
      sol_kwh_m2_yr: avgIrr,
      filteredSolarEnergy: filteredEnergy,
      antallTakflaterTotalt: takflater.length,
      antallTakflaterEtterFilter: antallEtterFilter,
    };
  }

  has(bygningsnummer: number): boolean {
    return this.byBygningsnummer.has(bygningsnummer);
  }

  get loaded(): boolean {
    return this.isLoaded;
  }

  get size(): number {
    return this.byBygningsnummer.size;
  }
}

let singleton: SolarCsvService | null = null;
export function getSolarCsvService(): SolarCsvService {
  if (!singleton) singleton = new SolarCsvService();
  return singleton;
}
