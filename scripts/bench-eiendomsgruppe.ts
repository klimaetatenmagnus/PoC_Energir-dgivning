import { aggregateForBorettslag, aggregateForSameie, clearEiendomsgruppeCache } from "../services/grunnbok-service/EiendomsgruppeService.ts";

const cases: Array<{ label: string; run: () => Promise<unknown> }> = [
  { label: "Oppsal Borettslag (598 andeler)", run: () => aggregateForBorettslag("948544474") },
  { label: "Hesteskoen sameie (gnr 73/bnr 739)", run: () => aggregateForSameie("0301", 73, 739) },
  { label: "Myrer Borettslag (via Fallanveien)", run: () => aggregateForBorettslag("948152436") },
];

for (const c of cases) {
  clearEiendomsgruppeCache();
  const t0 = Date.now();
  try {
    const result = await c.run() as { antallUnikeBygg: number; antallByggMedSolarData: number };
    const ms = Date.now() - t0;
    console.log(
      `${c.label.padEnd(45)} ${ms.toString().padStart(6)}ms  bygg=${result.antallUnikeBygg}  solar=${result.antallByggMedSolarData}`,
    );
  } catch (e) {
    console.log(`${c.label}: FEILET – ${e instanceof Error ? e.message : e}`);
  }
}
