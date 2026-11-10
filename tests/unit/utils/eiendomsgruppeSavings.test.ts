import { describe, it, expect } from 'vitest';
import {
  computeEiendomsgruppeSavings,
  type EiendomsgruppeBygg,
} from '../../../src/utils/eiendomsgruppeSavings.ts';
import { computeBygningSavings } from '../../../src/utils/bygningSavings.ts';
import {
  calculateAnnualEnergyConsumption,
  calculateTEK,
  determineBuildingType,
} from '../../../src/utils/tekEnergyCalculations.ts';
import type { TekPeriodInput } from '../../../src/utils/energySavingsData.ts';
import { resolveBuildingTypeCodeString } from '../../../src/utils/buildingTypeCode.ts';
import { beregnGruppeBaselineForbruk } from '../../../src/utils/eiendomsgruppeSavings.ts';

const catalog = [
  { id: 'vinduer', title: 'Vinduer' },
  { id: 'varmepumpe', title: 'Varmepumpe' },
  { id: 'etterisolering-kjeller-loft', title: 'Etterisolering kjeller/loft' },
  { id: 'solenergi', title: 'Solenergi' },
];

// bygningstypeKodeId er Matrikkelens INTERNE ID, slik aggregatet faktisk
// leverer den: 13 = kode 142 (stor boligblokk), 5 = kode 122 (tomannsbolig).
const bygninger: EiendomsgruppeBygg[] = [
  { byggId: 1, byggeaar: 1965, bruksarealM2: 1200, bygningstypeKodeId: 13, solar: { filteredSolarEnergy: 45000 } },
  { byggId: 2, byggeaar: 1972, bruksarealM2: 900, bygningstypeKodeId: 13, solar: { filteredSolarEnergy: 32000 } },
  { byggId: 3, byggeaar: 1985, bruksarealM2: 600, bygningstypeKodeId: 5, solar: null },
];

const baseInput = {
  bygninger,
  displayTiltak: catalog,
  erPaaGulListe: false,
  selectedVarmepumpeType: 'luft-luft',
  selectedVinduerTypeNye: 'trelags',
  completedVinduerType: 'tolags',
  checkedItems: new Set<string>(),
  completedItems: new Set<string>(),
};

describe('computeEiendomsgruppeSavings', () => {
  it('returnerer 0-totals og tomt perBygg uten valgte tiltak, men estimerer forbruk', () => {
    const r = computeEiendomsgruppeSavings(baseInput);
    expect(r.antallIkluderteBygg).toBe(3);
    expect(r.hoppetOverByggIds).toEqual([]);
    expect(r.totalEstimatedConsumptionKWh).toBeGreaterThan(0);
    expect(r.totalNewSavingsKWh).toBe(0);
    expect(r.totalNewSavingsNok).toBe(0);
  });

  it('hopper over bygg uten bruksareal', () => {
    const r = computeEiendomsgruppeSavings({
      ...baseInput,
      bygninger: [
        { byggId: 9, byggeaar: 1970, bruksarealM2: null, bygningstypeKodeId: 13, solar: null },
        bygninger[0],
      ],
    });
    expect(r.antallIkluderteBygg).toBe(1);
    expect(r.hoppetOverByggIds).toEqual([9]);
  });

  it('summerer newSavingsKWh som matcher per-bygg computeBygningSavings', () => {
    const input = {
      ...baseInput,
      checkedItems: new Set(['etterisolering-kjeller-loft', 'solenergi']),
    };
    const r = computeEiendomsgruppeSavings(input);

    const manual = bygninger.reduce((sum, b) => {
      const bruksareal = b.bruksarealM2!;
      const boligtype = determineBuildingType(resolveBuildingTypeCodeString(b), undefined);
      const tekPeriod = calculateTEK(b.byggeaar!) as TekPeriodInput;
      const estimated = calculateAnnualEnergyConsumption(b.byggeaar!, bruksareal, boligtype);
      const res = computeBygningSavings({
        tekPeriod,
        boligtype,
        bruksareal,
        filteredSolarEnergy: b.solar?.filteredSolarEnergy ?? null,
        yearlyConsumption: estimated,
        displayTiltak: catalog,
        checkedItems: input.checkedItems,
        completedItems: input.completedItems,
        selectedVarmepumpeType: 'luft-luft',
        selectedVinduerTypeNye: 'trelags',
        completedVinduerType: 'tolags',
        erPaaGulListe: false,
      });
      return sum + res.newSavingsKWh;
    }, 0);

    expect(r.totalNewSavingsKWh).toBeCloseTo(manual, 4);
    expect(r.perBygg).toHaveLength(3);
  });

  it('utleder boligtype fra intern ID — ID 13 (kode 142) = blokk, ID 5 (kode 122) = småhus', () => {
    const r = computeEiendomsgruppeSavings(baseInput);
    const bygg142 = r.perBygg.find((p) => p.byggId === 1);
    const bygg122 = r.perBygg.find((p) => p.byggId === 3);
    expect(bygg142?.boligtype).toBe('blokk');
    expect(bygg122?.boligtype).toBe('småhus');
  });

  it('regner blokk med ID 13 som blokk, ikke småhus (regresjon: ID lest som kode «13»)', () => {
    // Speiler et ekte borettslag (15 blokker, alle ID 13, byggeår 1959)
    const blokk: EiendomsgruppeBygg = {
      byggId: 286406853,
      byggeaar: 1959,
      bruksarealM2: 2027,
      bygningstypeKodeId: 13,
      solar: null,
    };
    const r = computeEiendomsgruppeSavings({ ...baseInput, bygninger: [blokk] });

    expect(r.perBygg[0].boligtype).toBe('blokk');
    // TEK49 blokk: 225,4 kWh/m² × 2027 m² = 456 886 → 457 000 (småhus ville gitt 476 000)
    expect(r.perBygg[0].estimatedConsumptionKWh).toBe(457000);
    expect(beregnGruppeBaselineForbruk([blokk])).toBe(457000);
  });

  it('klassifiserer alle 14x-ID-er (12–17) som blokk og småhus-ID-er (1–11) som småhus', () => {
    const lagBygg = (id: number): EiendomsgruppeBygg => ({
      byggId: id,
      byggeaar: 1975,
      bruksarealM2: 1000,
      bygningstypeKodeId: id,
      solar: null,
    });
    const blokkIds = [12, 13, 14, 15, 16, 17];
    const smaahusIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const r = computeEiendomsgruppeSavings({
      ...baseInput,
      bygninger: [...blokkIds, ...smaahusIds].map(lagBygg),
    });

    for (const id of blokkIds) {
      expect(r.perBygg.find((p) => p.byggId === id)?.boligtype, `ID ${id}`).toBe('blokk');
    }
    for (const id of smaahusIds) {
      expect(r.perBygg.find((p) => p.byggId === id)?.boligtype, `ID ${id}`).toBe('småhus');
    }
  });

  it('bruker oppslått bygningstypeKode foran intern ID når backend leverer den', () => {
    const r = computeEiendomsgruppeSavings({
      ...baseInput,
      bygninger: [
        // Koden vinner: 143 = blokk, selv om ID-feltet skulle mangle
        { byggId: 1, byggeaar: 1975, bruksarealM2: 1000, bygningstypeKodeId: null, bygningstypeKode: '143', solar: null },
        { byggId: 2, byggeaar: 1975, bruksarealM2: 1000, bygningstypeKodeId: null, bygningstypeKode: '131', solar: null },
      ],
    });
    expect(r.perBygg.find((p) => p.byggId === 1)?.boligtype).toBe('blokk');
    expect(r.perBygg.find((p) => p.byggId === 2)?.boligtype).toBe('småhus');
  });

  it('bruker per-bygg solar i solenergi-tiltak', () => {
    const r = computeEiendomsgruppeSavings({
      ...baseInput,
      checkedItems: new Set(['solenergi']),
    });
    // Bygg 1 og 2 har solar, bygg 3 har ikke → total = 45000 + 32000
    expect(r.totalNewSolarKwhContribution).toBe(45000 + 32000);
    expect(r.totalNewSavingsKWh).toBe(45000 + 32000);
  });

  it('bruker displayTiltakForBygg-callback til å skippe tiltak per bygg', () => {
    // Bygg 1 (142=blokk, 1965) får kun solenergi. Bygg 2 og 3 får hele katalogen.
    const input = {
      ...baseInput,
      checkedItems: new Set(['solenergi', 'varmepumpe']),
      displayTiltakForBygg: (b: EiendomsgruppeBygg) => {
        if (b.byggId === 1) return catalog.filter((t) => t.id === 'solenergi');
        return catalog;
      },
    };
    const r = computeEiendomsgruppeSavings(input);
    // Bygg 1 får sol-effekt men IKKE varmepumpe.
    // newSolarKwhContribution = 45000 (bygg 1) + 32000 (bygg 2) = 77000.
    expect(r.totalNewSolarKwhContribution).toBe(45000 + 32000);
    // Alle tre bygg får newSavings > 0 siden alle har enten sol eller varmepumpe eller begge.
    expect(r.perBygg.every((p) => p.newSavingsKWh > 0)).toBe(true);
  });

  it('anvender sol-prisjustering per-bygg-boligtype (småhus vs blokk)', () => {
    const r = computeEiendomsgruppeSavings({
      ...baseInput,
      checkedItems: new Set(['solenergi']),
    });
    // Bygg 1 (blokk) + bygg 2 (blokk) + bygg 3 (småhus, ingen sol).
    // Sol for blokk → faktor 1,0; for småhus → 0,65 (men ingen sol her).
    // Forventet: (45000 + 32000) * 1.1 * 1.0 = 84700
    expect(r.totalNewSavingsNok).toBeCloseTo((45000 + 32000) * 1.1, 4);
  });
});
