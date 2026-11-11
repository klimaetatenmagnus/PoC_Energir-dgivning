// Tester for TEK-periode fra byggeår, inkludert grensen for ugyldig byggeår.

import { describe, it, expect } from 'vitest';
import {
  calculateAnnualEnergyConsumption,
  calculateTEK,
  MIN_VALID_BYGGEAAR,
} from '../../../src/utils/tekEnergyCalculations.ts';
import { calculateTekPeriod } from '../../../src/components/FigmaBlokk/components/Tiltak/shared.ts';

describe('calculateTEK', () => {
  it.each([
    [2019, 'TEK17'],
    [2018, 'TEK10'],
    [2012, 'TEK10'],
    [2011, 'TEK7'],
    [2009, 'TEK7'],
    [2008, 'TEK97'],
    [1999, 'TEK97'],
    [1998, 'TEK87'],
    [1989, 'TEK87'],
    [1988, 'TEK69'],
    [1971, 'TEK69'],
    [1970, 'TEK49'],
    [1951, 'TEK49'],
    [1950, 'eldre'],
    [1900, 'eldre'],
    [1860, 'eldre'],
  ])('byggeår %i → %s', (byggeaar, forventet) => {
    expect(calculateTEK(byggeaar)).toBe(forventet);
  });

  it.each([1859, 1850, 1820, 1801])(
    'reelt byggeår %i (før 1860) gir «eldre», ikke TEK49',
    (byggeaar) => {
      expect(calculateTEK(byggeaar)).toBe('eldre');
    }
  );

  it.each([0, 1010, 1704, 1800, Number.NaN])(
    'ugyldig eller manglende byggeår (%s) gir TEK49 som standard',
    (byggeaar) => {
      expect(calculateTEK(byggeaar)).toBe('TEK49');
    }
  );

  it('grensen følger gyldighetssjekken for byggeår (> 1800)', () => {
    expect(MIN_VALID_BYGGEAAR).toBe(1801);
  });

  it('et hus fra 1850 får ikke lavere forbruk enn et hus fra 1870', () => {
    const fra1850 = calculateAnnualEnergyConsumption(1850, 150, 'småhus');
    const fra1870 = calculateAnnualEnergyConsumption(1870, 150, 'småhus');
    expect(fra1850).toBe(fra1870);
    // «eldre» småhus: 335,86 kWh/m² × 150 m² = 50 379 → 50 000
    expect(fra1850).toBe(50000);
  });
});

describe('calculateTekPeriod (tiltakskort) følger calculateTEK', () => {
  it.each([
    [2019, '17'],
    [1970, '49'],
    [1950, 'eldre'],
    [1859, 'eldre'],
    [1801, 'eldre'],
    [1800, '49'],
    [1010, '49'],
    [0, '49'],
  ] as const)('byggeår %i → %s', (byggeaar, forventet) => {
    expect(calculateTekPeriod(byggeaar)).toBe(forventet);
  });
});
