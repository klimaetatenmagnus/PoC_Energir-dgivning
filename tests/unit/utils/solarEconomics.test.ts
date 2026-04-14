import { describe, it, expect } from 'vitest';
import {
  getSolarPriceAdjustmentFactor,
  SOLAR_PRICE_FACTOR_SMAAHUS,
} from '../../../src/utils/solarEconomics.ts';

describe('getSolarPriceAdjustmentFactor', () => {
  it('gir justert faktor for småhus med solenergi', () => {
    expect(getSolarPriceAdjustmentFactor('solenergi', 'småhus')).toBe(SOLAR_PRICE_FACTOR_SMAAHUS);
    expect(SOLAR_PRICE_FACTOR_SMAAHUS).toBeCloseTo(0.65, 5);
  });

  it('gir 1.0 for blokk med solenergi (felles anlegg, egenforbruk)', () => {
    expect(getSolarPriceAdjustmentFactor('solenergi', 'blokk')).toBe(1);
  });

  it('gir 1.0 for andre tiltak uavhengig av boligtype', () => {
    expect(getSolarPriceAdjustmentFactor('varmepumpe', 'småhus')).toBe(1);
    expect(getSolarPriceAdjustmentFactor('etterisolering', 'småhus')).toBe(1);
    expect(getSolarPriceAdjustmentFactor('vindu', 'blokk')).toBe(1);
  });

  it('gir 1.0 når boligtype eller tiltakId er udefinert', () => {
    expect(getSolarPriceAdjustmentFactor('solenergi', null)).toBe(1);
    expect(getSolarPriceAdjustmentFactor('solenergi', undefined)).toBe(1);
    expect(getSolarPriceAdjustmentFactor(undefined, 'småhus')).toBe(1);
  });
});
