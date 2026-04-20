import { describe, it, expect } from 'vitest';
import { computeBygningSavings } from '../../../src/utils/bygningSavings.ts';
import { calculateCombinedSavings } from '../../../src/utils/energySavingsData.ts';

const catalog = [
  { id: 'vinduer', title: 'Vinduer' },
  { id: 'varmepumpe', title: 'Varmepumpe' },
  { id: 'etterisolering-kjeller-loft', title: 'Etterisolering kjeller/loft' },
  { id: 'solenergi', title: 'Solenergi' },
];

const baseInput = {
  tekPeriod: 'TEK69' as const,
  boligtype: 'småhus' as const,
  bruksareal: 150,
  filteredSolarEnergy: 6000,
  yearlyConsumption: 36000,
  displayTiltak: catalog,
  erPaaGulListe: false,
  selectedVarmepumpeType: 'luft-luft',
  selectedVinduerTypeNye: 'trelags',
  completedVinduerType: 'tolags',
  checkedItems: new Set<string>(),
  completedItems: new Set<string>(),
};

describe('computeBygningSavings', () => {
  it('returnerer null-resultat uten tekPeriod eller boligtype', () => {
    const r = computeBygningSavings({ ...baseInput, tekPeriod: null });
    expect(r.tiltakInfo).toEqual([]);
    expect(r.completedTiltakInfo).toEqual([]);
    expect(r.totalCombinedSavingsKWh).toBe(0);
  });

  it('returnerer tomme arrays og 0 kWh for ingen valg', () => {
    const r = computeBygningSavings(baseInput);
    expect(r.tiltakInfo).toEqual([]);
    expect(r.completedTiltakInfo).toEqual([]);
    expect(r.completedSavingsKWh).toBe(0);
    expect(r.totalCombinedSavingsKWh).toBe(0);
    expect(r.newSavingsKWh).toBe(0);
    expect(r.newSolarKwhContribution).toBe(0);
  });

  it('beregner besparelse for ett nytt tiltak som matcher calculateCombinedSavings', () => {
    const checkedItems = new Set(['etterisolering-kjeller-loft']);
    const r = computeBygningSavings({ ...baseInput, checkedItems });
    expect(r.tiltakInfo).toHaveLength(1);
    expect(r.completedTiltakInfo).toHaveLength(0);
    const manual = calculateCombinedSavings(36000, r.tiltakInfo, 'TEK69', 'småhus', 150);
    expect(r.totalCombinedSavingsKWh).toBeCloseTo(manual, 6);
    expect(r.newSavingsKWh).toBeCloseTo(manual, 6);
  });

  it('summerer sol lineært i newSolarKwhContribution', () => {
    const r = computeBygningSavings({
      ...baseInput,
      checkedItems: new Set(['solenergi']),
    });
    expect(r.newSolarKwhContribution).toBe(6000);
    expect(r.totalCombinedSavingsKWh).toBe(6000);
    expect(r.newSavingsKWh).toBe(6000);
  });

  it('hopper over solenergi hvis filteredSolarEnergy er 0 eller null', () => {
    const r = computeBygningSavings({
      ...baseInput,
      filteredSolarEnergy: 0,
      checkedItems: new Set(['solenergi']),
    });
    expect(r.tiltakInfo).toHaveLength(0);
    expect(r.newSolarKwhContribution).toBe(0);
  });

  it('dedupliserer vinduer når tolags er gjennomført og trelags krysset som nytt', () => {
    const r = computeBygningSavings({
      ...baseInput,
      checkedItems: new Set(['vinduer']),
      completedItems: new Set(['vinduer']),
    });
    // completedTiltakInfo har én vinduer (tolags), tiltakInfo har én (trelags).
    // allTiltakInfo skal droppe completed-vinduer og bare beholde nye.
    expect(r.completedTiltakInfo).toHaveLength(1);
    expect(r.tiltakInfo).toHaveLength(1);
    // Ingen dobbel multiplikasjon: totalen må matche bare trelags-vinduer alene.
    const trelagsOnly = calculateCombinedSavings(36000, r.tiltakInfo, 'TEK69', 'småhus', 150);
    expect(r.totalCombinedSavingsKWh).toBeCloseTo(trelagsOnly, 6);
  });

  it('kombinerer gjennomførte og nye tiltak når de ikke overlapper', () => {
    const r = computeBygningSavings({
      ...baseInput,
      checkedItems: new Set(['varmepumpe']),
      completedItems: new Set(['etterisolering-kjeller-loft']),
    });
    expect(r.completedTiltakInfo).toHaveLength(1);
    expect(r.tiltakInfo).toHaveLength(1);
    expect(r.allTiltakInfo).toHaveLength(2);
    const combined = calculateCombinedSavings(36000, r.allTiltakInfo, 'TEK69', 'småhus', 150);
    expect(r.totalCombinedSavingsKWh).toBeCloseTo(combined, 6);
    const baseline = calculateCombinedSavings(36000, r.completedTiltakInfo, 'TEK69', 'småhus', 150);
    expect(r.completedSavingsKWh).toBeCloseTo(baseline, 6);
    expect(r.newSavingsKWh).toBeCloseTo(combined - baseline, 6);
  });

  it('returnerer 0 kWh når yearlyConsumption er 0', () => {
    const r = computeBygningSavings({
      ...baseInput,
      yearlyConsumption: 0,
      checkedItems: new Set(['etterisolering-kjeller-loft']),
    });
    expect(r.tiltakInfo).toHaveLength(1);
    expect(r.totalCombinedSavingsKWh).toBe(0);
    expect(r.newSavingsKWh).toBe(0);
  });
});
