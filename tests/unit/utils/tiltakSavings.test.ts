import { describe, it, expect } from 'vitest';
import {
  computeTiltakSavings,
  computeAggregatedSavingsNok,
} from '../../../src/utils/tiltakSavings.ts';

describe('computeTiltakSavings', () => {
  it('returnerer kWh uendret og kr med full pris for ikke-sol-tiltak (småhus)', () => {
    const result = computeTiltakSavings({
      tiltakId: 'varmepumpe',
      kwhSaved: 10000,
      boligtype: 'småhus',
    });
    expect(result.kwh).toBe(10000);
    expect(result.nok).toBeCloseTo(11000, 5);
  });

  it('returnerer kWh uendret og kr med full pris for ikke-sol-tiltak (blokk)', () => {
    const result = computeTiltakSavings({
      tiltakId: 'vinduer',
      kwhSaved: 5000,
      boligtype: 'blokk',
    });
    expect(result.kwh).toBe(5000);
    expect(result.nok).toBeCloseTo(5500, 5);
  });

  it('anvender 0,65-faktor for småhus + solenergi', () => {
    const result = computeTiltakSavings({
      tiltakId: 'solenergi',
      kwhSaved: 10000,
      boligtype: 'småhus',
    });
    expect(result.kwh).toBe(10000);
    expect(result.nok).toBeCloseTo(10000 * 1.1 * 0.65, 5);
  });

  it('anvender full pris for blokk + solenergi', () => {
    const result = computeTiltakSavings({
      tiltakId: 'solenergi',
      kwhSaved: 10000,
      boligtype: 'blokk',
    });
    expect(result.kwh).toBe(10000);
    expect(result.nok).toBeCloseTo(11000, 5);
  });

  it('returnerer 0/0 for kwh <= 0 eller ugyldig', () => {
    expect(computeTiltakSavings({ tiltakId: 'vinduer', kwhSaved: 0, boligtype: 'småhus' }))
      .toEqual({ kwh: 0, nok: 0 });
    expect(computeTiltakSavings({ tiltakId: 'vinduer', kwhSaved: -100, boligtype: 'småhus' }))
      .toEqual({ kwh: 0, nok: 0 });
    expect(computeTiltakSavings({ tiltakId: 'vinduer', kwhSaved: NaN, boligtype: 'småhus' }))
      .toEqual({ kwh: 0, nok: 0 });
  });

  it('respekterer custom pris', () => {
    const result = computeTiltakSavings({
      tiltakId: 'solenergi',
      kwhSaved: 1000,
      boligtype: 'småhus',
      energyPricePerKwh: 2,
    });
    expect(result.nok).toBeCloseTo(1000 * 2 * 0.65, 5);
  });
});

describe('computeAggregatedSavingsNok', () => {
  it('uten sol-bidrag: alt til full pris', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 0,
      boligtype: 'småhus',
    });
    expect(nok).toBeCloseTo(11000, 5);
  });

  it('kun sol (småhus): hele beløpet × 0,65', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 10000,
      boligtype: 'småhus',
    });
    expect(nok).toBeCloseTo(10000 * 1.1 * 0.65, 5);
  });

  it('kun sol (blokk): full pris', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 10000,
      boligtype: 'blokk',
    });
    expect(nok).toBeCloseTo(11000, 5);
  });

  it('miks sol + annet (småhus): splittet beregning', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 4000,
      boligtype: 'småhus',
    });
    const expected = 6000 * 1.1 + 4000 * 1.1 * 0.65;
    expect(nok).toBeCloseTo(expected, 5);
  });

  it('miks sol + annet (blokk): alt til full pris', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 4000,
      boligtype: 'blokk',
    });
    expect(nok).toBeCloseTo(11000, 5);
  });

  it('klamper solarKwhContribution til [0, totalKwh]', () => {
    const nokOver = computeAggregatedSavingsNok({
      totalKwh: 5000,
      solarKwhContribution: 9999,
      boligtype: 'småhus',
    });
    expect(nokOver).toBeCloseTo(5000 * 1.1 * 0.65, 5);

    const nokUnder = computeAggregatedSavingsNok({
      totalKwh: 5000,
      solarKwhContribution: -100,
      boligtype: 'småhus',
    });
    expect(nokUnder).toBeCloseTo(5500, 5);
  });

  it('returnerer 0 for totalKwh <= 0', () => {
    expect(
      computeAggregatedSavingsNok({
        totalKwh: 0,
        solarKwhContribution: 0,
        boligtype: 'småhus',
      })
    ).toBe(0);
    expect(
      computeAggregatedSavingsNok({
        totalKwh: -50,
        solarKwhContribution: 0,
        boligtype: 'småhus',
      })
    ).toBe(0);
  });

  it('respekterer custom pris', () => {
    const nok = computeAggregatedSavingsNok({
      totalKwh: 10000,
      solarKwhContribution: 10000,
      boligtype: 'småhus',
      energyPricePerKwh: 2,
    });
    expect(nok).toBeCloseTo(10000 * 2 * 0.65, 5);
  });
});
