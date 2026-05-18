/**
 * Felles filter-parametre og kWh-beregning for `filteredSolarEnergy`.
 *
 * Brukes både av backend (`solarCsvService`, sameie-aggregat) og frontend
 * (`solarEnergyService`) slik at enkeltadresse- og sameie-modus gir identisk
 * solar-besparelse for samme bygg.
 *
 * Formel:
 *   Σ (area × irr × areaCoverage × panelEfficiency)
 * over takflater der irr > minRadiation OG area ≥ minArea.
 */

export interface SolarFilterConfig {
  minRadiation: number;
  minArea: number;
  areaCoverage: number;
  panelEfficiency: number;
}

export const SOLAR_FILTER_DEFAULTS: SolarFilterConfig = {
  minRadiation: 800,
  minArea: 20,
  areaCoverage: 0.8,
  panelEfficiency: 0.2,
};

export interface SolarTakflateForFilter {
  area_m2: number;
  irr_kwh_m2_yr: number;
}

export function calculateFilteredSolarEnergy(
  takflater: ReadonlyArray<SolarTakflateForFilter>,
  config: SolarFilterConfig = SOLAR_FILTER_DEFAULTS,
): number {
  let energy = 0;
  for (const t of takflater) {
    if (
      t.irr_kwh_m2_yr > config.minRadiation &&
      t.area_m2 >= config.minArea
    ) {
      energy +=
        t.area_m2 *
        t.irr_kwh_m2_yr *
        config.areaCoverage *
        config.panelEfficiency;
    }
  }
  return energy;
}
