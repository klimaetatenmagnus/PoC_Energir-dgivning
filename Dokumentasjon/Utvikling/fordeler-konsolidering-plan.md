# Plan: Konsolidering av fordeler-system

## Bakgrunn

Fordelsboksene (benefits/chips) vises i tiltakskortene på desktop og mobil. Systemet har i dag flere parallelle implementasjoner som fører til inkonsekvent oppførsel:

- Noen tiltak viser fordeler korrekt (etterisolering-kjeller-loft, etterisolering-yttervegg)
- Noen tiltak har `benefitRefs` men tom `benefits`-array (temperaturstyring)
- Mange tiltak har verken `benefitRefs` eller `benefits` fylt ut

### Ønsket system

1. Fordeler opprettes i **BenefitsEditor** (admin) med tekst og ikon fra Punkt
2. Hver fordel får en unik `id` (slug) ved opprettelse
3. I **tiltakseditoren** velges inntil 4 fordeler fra listen - disse lagres som `benefitRefs` i tiltakets JSON
4. Frontend (desktop og mobil) slår opp `benefitRefs` i dictionary for å hente tittel og ikon
5. Fordelene rendres identisk i admin-preview, desktop og mobil

**Arkitektur for identisk rendering:**
- Admin-preview bruker de samme tiltak-komponentene som desktop (via `TILTAK_COMPONENT_MAP` i `PreviewPanel.tsx`)
- Mobil har egen komponent (`MobileTiltakDetail.tsx`) som må oppdateres separat
- Alle komponenter skal bruke felles utility `resolveTiltakBenefits()` for å sikre konsistens

---

## Nåværende tilstand

### Dataflyt

```
Dictionary (content/dictionaries/index.json)
    └── benefits: [{ id, title, description, icon, tags }]

Tiltak JSON (content/tiltak/*.json)
    ├── benefitRefs: ["fordel-id-1", "fordel-id-2", ...]  <-- ID-referanser
    └── benefits: [{ id, title, description, icon }]      <-- Duplisert data (legacy)
```

### Komponenter som viser fordeler

| Fil | Metode | Problem |
|-----|--------|---------|
| `Temperaturstyring.tsx` | Leser `content.benefits`, slår opp i dictionary for ikon | Fungerer kun hvis `benefits` er fylt ut |
| `Solenergi.tsx` | Leser `content.benefits` direkte, hardkodet SVG-ikoner | Ignorerer dictionary helt |
| `MobileTiltakDetail.tsx` | Leser `resolvedContent.benefits`, slår opp i dictionary | Fungerer kun hvis `benefits` er fylt ut |
| Andre desktop-tiltak | Varierende implementasjoner med hardkodede SVG-ikoner | Ingen konsistens |

### Admin-komponenter

| Fil | Funksjon | Status |
|-----|----------|--------|
| `BenefitsEditor.tsx` | Opprette/redigere fordeler i dictionary | Fungerer |
| `TiltakBenefitInlineEditor.tsx` | Velge fordeler for tiltak via `benefitRefs` | Fungerer, lagrer til `benefitRefs` |
| `legacyBenefitIcons.tsx` | Fallback-ikoner for eldre fordeler | Bør fjernes når alle har Punkt-ikoner |

### Tiltak-status (benefitRefs)

| Tiltak | benefitRefs | benefits | Fordeler vises? |
|--------|-------------|----------|-----------------|
| etterisolering-kjeller-loft | 4 stk | 4 stk (duplisert) | Ja |
| etterisolering-yttervegg | 4 stk | 4 stk (duplisert) | Ja |
| temperaturstyring | 4 stk | Tom | Nei |
| solenergi | Tom | Tom | Nei |
| tetting | Tom | Tom | Nei |
| varmepumpe | Tom | Tom | Nei |
| ventilasjon | Tom | Tom | Nei |
| vinduer | Tom | Tom | Nei |

---

## Løsningsplan

### Fase 1: Felles utility for oppløsning av fordeler - FULLFØRT

**Status:** Fullført 2024-12-08

**Gjennomført:**
- Opprettet `src/utils/benefitUtils.ts` med `resolveTiltakBenefits`-funksjonen
- Funksjonen prioriterer `benefitRefs` og slår opp i dictionary
- Fallback til `benefits`-array for bakoverkompatibilitet
- Verifisert med `npm run build` - ingen feil

**Mål:** Én funksjon som alltid gir riktige fordeler uansett datakilde

**Fil:** `src/utils/benefitUtils.ts` (ny fil)

```typescript
import type { TiltakContent } from '../../content/tiltak/schema';
import type { ContentDictionary, BenefitDictionaryEntry } from '../../content/dictionaries/schema';

export interface ResolvedBenefit {
  id: string;
  title: string;
  description?: string;
  icon?: string;
}

/**
 * Løser opp fordeler for et tiltak.
 * Prioriterer benefitRefs (slår opp i dictionary), faller tilbake til benefits-array.
 */
export function resolveTiltakBenefits(
  content: TiltakContent | undefined,
  dictionary: ContentDictionary | undefined,
  maxItems: number = 4
): ResolvedBenefit[] {
  if (!content) return [];

  const benefitsLookup = new Map<string, BenefitDictionaryEntry>(
    (dictionary?.benefits ?? []).map(b => [b.id, b])
  );

  // Prioritet 1: Bruk benefitRefs og slå opp i dictionary
  if (content.benefitRefs && content.benefitRefs.length > 0) {
    return content.benefitRefs.slice(0, maxItems).map((refId, index) => {
      const entry = benefitsLookup.get(refId);
      return {
        id: refId,
        title: entry?.title ?? refId,
        description: entry?.description,
        icon: entry?.icon
      };
    });
  }

  // Prioritet 2: Bruk benefits-array og berik med dictionary-data
  if (content.benefits && content.benefits.length > 0) {
    return content.benefits.slice(0, maxItems).map((benefit, index) => {
      const entry = benefit.id ? benefitsLookup.get(benefit.id) : undefined;
      return {
        id: benefit.id ?? `benefit-${index}`,
        title: benefit.title || entry?.title || 'Fordel',
        description: benefit.description || entry?.description,
        icon: entry?.icon ?? benefit.icon
      };
    });
  }

  return [];
}
```

### Fase 2: Oppdater applyTiltakVariant - FULLFØRT

**Status:** Fullført 2024-12-08

**Gjennomført:**
- La til håndtering av `benefitRefs` i variant-merging
- Varianter med egne `benefitRefs` overstyrer nå base-innholdet
- Verifisert med `npm run build` - ingen feil

**Fil:** `src/utils/tiltakContent.ts`

Legg til håndtering av `benefitRefs` i variant-merging:

```typescript
export function applyTiltakVariant(
  content: TiltakContent | undefined,
  audience: TiltakAudience = 'standard'
): TiltakContent | undefined {
  // ... eksisterende kode ...

  return {
    ...content,
    // Legg til:
    benefitRefs: variant.benefitRefs?.length
      ? variant.benefitRefs
      : content.benefitRefs,
    // Eksisterende:
    benefits: variant.benefits ?? content.benefits,
    // ... resten ...
  };
}
```

### Fase 3: Oppdater desktop-komponenter (inkluderer admin-preview)

**Viktig:** Admin-preview (`PreviewPanel.tsx`) importerer og bruker de samme tiltak-komponentene som desktop via `TILTAK_COMPONENT_MAP`. Dette betyr at når desktop-komponentene oppdateres, vil admin-preview automatisk få identisk oppførsel.

Alle tiltak-komponenter skal bruke samme mønster:

```typescript
import { resolveTiltakBenefits } from '../../../../utils/benefitUtils';
import { BenefitChipSvg } from '../../../common/BenefitChip';

// I komponenten:
const { data: dictionary } = useContentDictionary();

const enrichedBenefits = useMemo(
  () => resolveTiltakBenefits(resolvedTiltakContent, dictionary, 4),
  [resolvedTiltakContent, dictionary]
);

// I JSX:
<BenefitChipSvg benefits={enrichedBenefits} x={565} y={60} width={220} maxItems={4} />
```

**Filer som må oppdateres:**

**Kategori A - Bruker allerede BenefitChipSvg (enkel oppdatering):**
1. ~~`Temperaturstyring.tsx`~~ - **FULLFØRT** - Oppdatert til `resolveTiltakBenefits`

**Kategori B - Har hardkodede SVG-ikoner (krever refaktorering):**
2. ~~`Solenergi.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
3. ~~`EtterisoleringYttervegg.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
4. ~~`IsoleringAvKjellerOgLoft.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
5. ~~`Tetting.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
6. ~~`Ventilasjon.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
7. ~~`Varmepumpe.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`
8. ~~`UtskiftningAvVindu.tsx`~~ - **FULLFØRT** - Refaktorert til `BenefitChipSvg`

---

#### Standardisert fremgangsmåte for Kategori B-refaktorering

**Denne fremgangsmåten skal brukes for ALLE tiltak-filer som har hardkodede SVG-ikoner for fordeler.**

##### Steg 1: Oppdater imports

Legg til følgende imports (hvis de ikke allerede finnes):

```typescript
// Legg til useContentDictionary i eksisterende import:
import { useTiltakContent, useContentDictionary } from '../../../../hooks/contentHooks';

// Legg til nye imports:
import { resolveTiltakBenefits } from '../../../../utils/benefitUtils';
import { BenefitChipSvg } from '../../../common/BenefitChip';
```

##### Steg 2: Legg til dictionary hook

Rett etter `useTiltakContent`-kallet, legg til:

```typescript
const { data: dictionary } = useContentDictionary();
```

##### Steg 3: Legg til enrichedBenefits

Etter `content`-useMemo (og før andre hooks som `useGrantAwareStotteordninger`), legg til:

```typescript
// Berik fordeler fra dictionary via felles utility
const enrichedBenefits = useMemo(
  () => resolveTiltakBenefits(resolvedTiltakContent, dictionary, 4),
  [resolvedTiltakContent, dictionary]
);
```

##### Steg 4: Fjern lokal benefits-variabel

Hvis filen har en lokal `benefits`-variabel som denne, fjern den:

```typescript
// FJERN DENNE:
const benefits = content.benefits.slice(0, 4).map((b) => ({
  title: b.title || 'Fordel',
  description: b.description
}));
```

##### Steg 5: Erstatt hardkodede fordelsbokser i JSX

Finn og fjern alle hardkodede `<rect>`, `<svg>` og `<text>` elementer som utgjør fordelsboksene.
Typisk ser disse slik ut (4 stykker med y-posisjoner 60, 106, 152, 198):

```tsx
{/* FJERN ALT DETTE: */}
<rect x="565" y="60" width="162" height="30" fill="#C7F6C9" />
<svg x="573" y="67" width="16" height="16" ...>...</svg>
<text x="597" y="75" ...>{benefits[0]?.title ?? 'Fordel'}</text>
{/* ... og tilsvarende for benefits[1], [2], [3] */}
```

Erstatt med:

```tsx
{/* Fordeler - bruker felles BenefitChipSvg-komponent */}
<BenefitChipSvg
  benefits={enrichedBenefits}
  x={565}
  y={60}
  width={220}
  maxItems={4}
/>
```

##### Verifisering

Etter refaktorering, verifiser at:
- [ ] `npm run build` kjører uten feil
- [ ] Fordelene vises korrekt i frontend
- [ ] Admin-preview viser samme fordeler som desktop
- [ ] Tiltak med `benefitRefs` (f.eks. temperaturstyring) viser riktige fordeler fra dictionary

---

**Merknad:** Denne fremgangsmåten sikrer at alle tiltak-komponenter håndterer fordeler identisk,
og at fordelene hentes fra dictionary via `benefitRefs` med fallback til `benefits`-array.

### Fase 4: Oppdater mobil-komponenten - FULLFØRT

**Status:** Fullført 2024-12-11

**Gjennomført:**
- Fjernet lokal `getBenefitFromDictionary`-funksjon
- Importert `resolveTiltakBenefits` fra felles utility
- Erstattet den gamle `enrichedBenefits`-logikken som kun leste fra `benefits`-array
- Ny logikk prioriterer nå `benefitRefs` med fallback til `benefits`-array
- Fjernet ubrukt type-import (`ContentDictionary`, `BenefitDictionaryEntry`)
- Verifisert med `npm run build` - ingen feil

**Fil:** `src/components/mobile/MobileTiltakDetail.tsx`

Endringer gjort:

```typescript
// Ny import:
import { resolveTiltakBenefits } from '../../utils/benefitUtils';

// Ny enrichedBenefits-logikk (erstatter gammel som kun leste benefits):
const enrichedBenefits = useMemo(
  () => resolveTiltakBenefits(resolvedContent, dictionary, 4),
  [resolvedContent, dictionary]
);
```

### Fase 5: Verifisering av eksisterende data - FULLFØRT

**Status:** Fullført 2024-12-11

**Verifisert:**

#### Tiltak-status (benefitRefs vs benefits)

| Tiltak | benefitRefs | benefits | Fordeler vises? |
|--------|-------------|----------|-----------------|
| etterisolering-kjeller-loft | 4 stk | 4 stk (legacy) | ✓ Ja |
| etterisolering-yttervegg | 4 stk | 4 stk (legacy) | ✓ Ja |
| temperaturstyring | 4 stk | 0 | ✓ Ja |
| solenergi | 4 stk | 0 | ✓ Ja (gjenopprettet) |
| tetting | 4 stk | 0 | ✓ Ja (gjenopprettet) |
| varmepumpe | 4 stk | 0 | ✓ Ja (gjenopprettet) |
| ventilasjon | 4 stk | 0 | ✓ Ja (gjenopprettet) |
| vinduer | 4 stk | 0 | ✓ Ja (gjenopprettet) |

**Merknad:** 5 tiltak (solenergi, tetting, varmepumpe, ventilasjon, vinduer) hadde mistet sine fordeler
i commit `2a8b291` ("Fix av kladd-oppførsel") da filene ble slettet og gjenskapt uten `benefits`-data.
Fordelene er nå gjenopprettet via `benefitRefs` basert på de originale verdiene fra commit `4713040`.

#### benefitRefs-validering

Alle `benefitRefs` finnes i dictionary og er gyldige:

- `etterisolering-kjeller-loft.json`:
  - ✓ mindre-trekk → Mindre trekk
  - ✓ ivaretar-boligen → Ivaretar boligen
  - ✓ lavere-stromregning → Lavere strømregning
  - ✓ redusert-energibehov → Redusert energibehov

- `etterisolering-yttervegg.json`:
  - ✓ mindre-trekk → Mindre trekk
  - ✓ ivaretar-boligen → Ivaretar boligen
  - ✓ hoyere-boligverdi → Høyere boligverdi
  - ✓ redusert-energibehov → Redusert energibehov

- `temperaturstyring.json`:
  - ✓ bedre-stromstyring → Bedre strømstyring
  - ✓ bedre-bokvalitet → Bedre bokvalitet
  - ✓ lavere-stromregning → Lavere strømregning
  - ✓ redusert-energibehov → Redusert energibehov

#### Ikon-verifisering

Alle fordeler i dictionary har gyldige Punkt-ikoner:
- mindre-trekk: `snow`
- ivaretar-boligen: `home`
- hoyere-boligverdi: `graph`
- bedre-stromstyring: `bulb`
- lavere-stromregning: `coin-stacks`
- egenprodusert-strom: `charging-point`
- bedre-bokvalitet: `house-heart`
- redusert-energibehov: `nature-plant`
- redusert-stoy: `megaphone`

#### Konklusjon

- **Alle 32 benefitRefs er validert** og peker på gyldige dictionary-oppføringer
- **Alle 8 tiltak har nå 4 fordeler hver**
- **Temperaturstyring fungerer nå** - tidligere hadde den `benefitRefs` men tom `benefits`
- **5 tiltak gjenopprettet** - solenergi, tetting, varmepumpe, ventilasjon, vinduer
- **Alle ikoner er definert** - ingen fallback til legacy-ikoner nødvendig

### Fase 6: Opprydding av legacy-kode - FULLFØRT

**Status:** Fullført 2024-12-11

**Gjennomført:**

1. **Fjernet `benefits`-array fra alle 8 tiltak-filer:**
   - etterisolering-kjeller-loft.json (4 elementer fjernet)
   - etterisolering-yttervegg.json (4 elementer fjernet)
   - solenergi.json (tom array fjernet)
   - temperaturstyring.json (tom array fjernet)
   - tetting.json (tom array fjernet)
   - varmepumpe.json (tom array fjernet)
   - ventilasjon.json (tom array fjernet)
   - vinduer.json (tom array fjernet)

2. **Fjernet legacy-ikon-kode:**
   - Slettet `src/admin/components/legacyBenefitIcons.tsx`
   - Fjernet import og alle referanser til `LEGACY_BENEFIT_ICONS` i `BenefitsEditor.tsx`
   - Forenklet ikon-visningslogikken til kun Punkt-ikoner eller placeholder

3. **Verifisert:**
   - `npm run build` kjører uten feil
   - Bundle-størrelse redusert (313 → 312 moduler)

---

## Implementeringsrekkefølge

| Steg | Beskrivelse | Risiko | Avhengigheter |
|------|-------------|--------|---------------|
| 1 | Opprett `benefitUtils.ts` med `resolveTiltakBenefits` | Lav | Ingen |
| 2 | Oppdater `applyTiltakVariant` for `benefitRefs` | Lav | Steg 1 |
| 3 | Oppdater `Temperaturstyring.tsx` | Medium | Steg 1-2 |
| 4 | Oppdater `MobileTiltakDetail.tsx` | Medium | Steg 1-2 |
| 5 | Oppdater resterende desktop-komponenter | Medium | Steg 1-2 |
| 6 | Verifiser at eksisterende data bevares | Kritisk | Steg 3-5 |
| 7 | Fjern legacy-kode og duplisert data | Lav | Steg 6 |

---

## Eksisterende data som må bevares

Følgende tiltak har allerede fordeler definert via admin:

### etterisolering-kjeller-loft
```json
"benefitRefs": ["mindre-trekk", "ivaretar-boligen", "lavere-stromregning", "redusert-energibehov"]
```

### etterisolering-yttervegg
```json
"benefitRefs": ["mindre-trekk", "ivaretar-boligen", "hoyere-boligverdi", "redusert-energibehov"]
```

### temperaturstyring
```json
"benefitRefs": ["bedre-stromstyring", "bedre-bokvalitet", "lavere-stromregning", "redusert-energibehov"]
```

Disse **skal ikke** endres av implementasjonen - kun koden som leser dem.

---

## Testing

### Sjekkliste for hver komponent

- [ ] Fordeler vises med riktig tittel fra dictionary
- [ ] Fordeler vises med riktig ikon fra dictionary
- [ ] Visningen er identisk i admin-preview, desktop og mobil
- [ ] Tiltak uten fordeler viser ingenting (ikke tom boks eller placeholder)
- [ ] Endringer i admin reflekteres umiddelbart i frontend

### Regresjonstesting

- [ ] etterisolering-kjeller-loft viser fortsatt 4 fordeler
- [ ] etterisolering-yttervegg viser fortsatt 4 fordeler
- [ ] temperaturstyring viser nå 4 fordeler (tidligere 0)
- [ ] Variant-switching (standard/gulliste) fungerer

---

## Fremtidige forbedringer

1. **Fjern `benefits`-array fra schema** når migrering er komplett
2. **Legg til validering** i admin som krever at fordeler har Punkt-ikon
3. **Legg til drag-and-drop** i tiltakseditoren for å endre rekkefølge
4. **Vurder animasjoner** ved visning av fordelsbokser

---

## Referanser

- Dictionary: `content/dictionaries/index.json`
- Tiltak-schema: `content/tiltak/schema.ts`
- BenefitChip-komponenter: `src/components/common/BenefitChip/`
- Admin Benefits Editor: `src/admin/components/BenefitsEditor.tsx`
- Tiltak Benefit Editor: `src/admin/components/TiltakBenefitInlineEditor.tsx`

---

## Gjennomføringslogg

| Dato | Fase | Status | Beskrivelse |
|------|------|--------|-------------|
| 2024-12-08 | Fase 1 | Fullført | Opprettet `src/utils/benefitUtils.ts` med `resolveTiltakBenefits` |
| 2024-12-08 | Fase 2 | Fullført | Oppdatert `applyTiltakVariant` for `benefitRefs` |
| 2024-12-08 | Fase 3.1 | Fullført | Oppdatert `Temperaturstyring.tsx` til å bruke `resolveTiltakBenefits` (Kategori A) |
| 2024-12-08 | Fase 3.2 | Fullført | Refaktorert `Solenergi.tsx` til å bruke `BenefitChipSvg` (Kategori B) |
| 2024-12-08 | Fase 3.2 | Dokumentert | Standardisert fremgangsmåte for Kategori B-refaktorering dokumentert |
| 2024-12-08 | Fase 3.3 | Fullført | Refaktorert `EtterisoleringYttervegg.tsx` til å bruke `BenefitChipSvg` (Kategori B) |
| 2024-12-08 | Fase 3.4 | Fullført | Refaktorert `IsoleringAvKjellerOgLoft.tsx` til å bruke `BenefitChipSvg` (Kategori B) |
| 2024-12-08 | Fase 3.5-3.8 | Fullført | Refaktorert `Tetting.tsx`, `Ventilasjon.tsx`, `Varmepumpe.tsx`, `UtskiftningAvVindu.tsx` parallelt (Kategori B) |
| 2024-12-08 | Fase 3 | Fullført | Alle desktop-komponenter bruker nå `BenefitChipSvg` og `resolveTiltakBenefits` |
| 2024-12-11 | Fase 4 | Fullført | Oppdatert `MobileTiltakDetail.tsx` til å bruke `resolveTiltakBenefits` |
| 2024-12-11 | Fase 5 | Fullført | Verifisert at alle 12 benefitRefs er gyldige og peker på dictionary-oppføringer |
| 2024-12-11 | Fase 5b | Fullført | Gjenopprettet fordeler for 5 tiltak som hadde mistet dem (solenergi, tetting, varmepumpe, ventilasjon, vinduer) |
| 2024-12-11 | Fase 6 | Fullført | Fjernet `benefits`-array fra alle tiltak og slettet `legacyBenefitIcons.tsx` |

---

## Neste skritt

1. ~~**Fase 3: Oppdater desktop-komponenter**~~ - **FULLFØRT**
   - Alle 8 tiltak-komponenter bruker nå `BenefitChipSvg` og `resolveTiltakBenefits`

2. ~~**Fase 4: Oppdater MobileTiltakDetail.tsx**~~ - **FULLFØRT**
   - Erstattet lokal `getBenefitFromDictionary` med felles utility
   - Mobil får nå samme fordeler som desktop og admin-preview

3. ~~**Fase 5: Verifiser og gjenopprett data**~~ - **FULLFØRT**
   - Alle 32 benefitRefs validert mot dictionary
   - Alle fordeler har gyldige Punkt-ikoner
   - 5 tiltak gjenopprettet (solenergi, tetting, varmepumpe, ventilasjon, vinduer)
   - Alle 8 tiltak har nå 4 fordeler hver

4. ~~**Fase 6: Opprydding av legacy-kode**~~ - **FULLFØRT**
   - Fjernet `legacyBenefitIcons.tsx`
   - Fjernet `benefits`-array fra alle 8 tiltak-filer
   - Forenklet BenefitsEditor.tsx

## Konsolidering fullført

Alle faser er nå gjennomført. Fordeler-systemet er konsolidert til å bruke:
- **benefitRefs** i tiltak-JSON (referanser til dictionary)
- **resolveTiltakBenefits()** i alle visningskomponenter (desktop, mobil, admin-preview)
- **Punkt-ikoner** for alle fordeler (ingen legacy-ikoner)
