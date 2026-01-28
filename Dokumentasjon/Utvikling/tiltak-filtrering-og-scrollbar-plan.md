# Plan: Scrollbar for tiltaksliste og avansert filtrering i Admin-UI

Opprettet: 2025-11-27
Single source of truth for implementering av:
1. Scrollbar for tiltakslisten i frontend
2. Byggtype-filtrering for tiltak i Admin-UI
3. Byggår-filtrering for tiltak i Admin-UI

---

## Status og fremdrift

> **VIKTIG:** Denne seksjonen skal oppdateres etter hvert arbeid som gjennomføres.

### Fasestatus

| Fase | Beskrivelse | Status | Fullført dato |
|------|-------------|--------|---------------|
| **Fase 1** | Datamodell og Admin-UI | ✅ Fullført | 2025-11-27 |
| **Fase 2** | Frontend scrollbar og dynamisk liste | ✅ Fullført | 2025-11-27 |
| **Fase 3** | Migrasjon og testing | 🔄 Pågår | – |
| **Fase 4** | Opprettelse av nye tiltak i Admin-UI | ✅ Fullført | 2025-11-27 |

**Statusnøkkel:** ⏳ Ikke startet · 🔄 Pågår · ✅ Fullført · ⚠️ Blokkert

### Deloppgave-status

#### Fase 1: Datamodell og Admin-UI
- [x] 1.1 Utvid `TiltakContentSchema` med nye felt
- [x] 1.2 Oppdater `TiltakCatalogItem` type
- [x] 1.3 Oppdater katalog-generering i API-server
- [x] 1.4 Oppdater Admin-API for nye felt
- [x] 1.5 Legg til "Synlighet"-seksjon i `TiltakEditor`
- [x] 1.6 Test ende-til-ende i admin (TypeScript og innholdsvalidering passerer)

#### Fase 2: Frontend scrollbar og dynamisk liste
- [x] 2.1 Lag CSS for scrollbar-container
- [x] 2.2 Refaktorer `EnergySolutionButtons` til scrollbar
- [x] 2.3 Hent tiltak dynamisk fra katalog
- [x] 2.4 Implementer filtreringslogikk
- [ ] 2.5 Test med ulike kombinasjoner (manuell testing)

#### Fase 3: Migrasjon og testing
- [x] 3.1 Oppdater eksisterende tiltak-JSON (ikke nødvendig - schema har default-verdier)
- [x] 3.2 Validering med `npm run content:validate`
- [ ] 3.3 Manuell QA lokalt (venter på at Matrikkel-API er oppe)
- [ ] 3.4 Deploy til staging (push til deploy/gcp)
- [x] 3.5 Oppdater dokumentasjon

#### Fase 4: Opprettelse av nye tiltak i Admin-UI
- [x] 4.1 Legg til `createTiltak`-funksjon i `adminApiClient.ts`
- [x] 4.2 Legg til POST-endepunkt i admin-api (`/content/tiltak`)
- [x] 4.3 Utvid `TiltakEditor` med tittel-felt og støtte for create-modus
- [x] 4.4 Oppdater `ContentList` med onClick for "Opprett tiltak"-knappen
- [x] 4.5 Oppdater `AdminApp` med create-modus og routing
- [ ] 4.6 Test ende-til-ende: opprett nytt tiltak, rediger, publiser (manuell testing)

---

## Arbeidslogg

> **VIKTIG:** Loggfør alt arbeid her med dato, hvem som utførte arbeidet, og hva som ble gjort.

| Dato | Utført av | Beskrivelse | Relaterte filer |
|------|-----------|-------------|-----------------|
| 2025-11-27 | Claude | Opprettet plan med løsningsdesign, implementeringsplan og tekniske detaljer | `tiltak-filtrering-og-scrollbar-plan.md` |
| 2025-11-27 | Claude | La til detaljerte Punkt-komponentspesifikasjoner for Admin-UI | `tiltak-filtrering-og-scrollbar-plan.md` |
| 2025-11-27 | Claude | **Fullført Fase 1**: Implementert datamodell og Admin-UI for synlighet-filtrering | `content/tiltak/schema.ts`, `src/types/contentCatalog.ts`, `src/api-server.ts`, `src/admin/components/TiltakEditor.tsx`, `src/admin/components/TiltakEditor.css` |
| 2025-11-27 | Claude | Refaktorert TiltakEditor til fane-struktur: "Endre tiltaksinformasjon" og "Endre synlighet" med PktTabs | `src/admin/components/TiltakEditor.tsx`, `src/admin/components/TiltakEditor.css` |
| 2025-11-27 | Claude | **Fullført Fase 2**: Implementert scrollbar-container, dynamisk tiltaksliste fra katalog, og filtreringslogikk basert på byggtype og byggår | `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx`, `src/components/FigmaBlokk/components/EnergySolutionButtons.css` |
| 2025-11-27 | Claude | Verifisert validering og TypeScript-kompilering. Oppdatert dokumentasjon med ny seksjon 5.1 om synlighet-filtrering. Venter på Matrikkel-API for manuell QA og deploy. | `Dokumentasjon/innholdsdrift-tiltak.md` |
| 2025-11-27 | Claude | Lagt til **Fase 4: Opprettelse av nye tiltak** med full teknisk spesifikasjon (API-endepunkt, klient, TiltakEditor-utvidelser, UX-flyt) | `tiltak-filtrering-og-scrollbar-plan.md` |
| 2025-11-27 | Claude | **Fullført Fase 4**: Implementert opprettelse av nye tiltak. API-klient (`createTiltak`), POST-endepunkt, TiltakEditor i create-modus med tittel/ID-felt, ContentList-knapp, AdminApp routing. TypeScript-kompilering verifisert. | `src/admin/api/adminApiClient.ts`, `services/admin-api/contentRouter.ts`, `src/admin/components/TiltakEditor.tsx`, `src/admin/components/TiltakEditorPage.tsx`, `src/admin/components/ContentList.tsx`, `src/admin/AdminApp.tsx` |
| 2025-11-27 | Claude | Lagt til støtte for gul liste-varianter i opprettelse av nye tiltak. `createEmptyTiltak()` inkluderer nå `audiences: ["standard", "gulliste"]` og en tom gulliste-variant. | `src/admin/components/TiltakEditorPage.tsx` |
| 2025-11-27 | Claude | Fikset valideringsfeil ved opprettelse: Lagt til `updatedBy: "pending"` placeholder og validering av intro/byggtype-tekst i TiltakEditor. | `src/admin/components/TiltakEditorPage.tsx`, `src/admin/components/TiltakEditor.tsx`, `src/admin/components/TiltakEditor.css` |
| 2025-11-27 | Claude | Lagt til refresh av drafts-listen i AdminApp etter lagring, slik at PublishActionBar oppdateres med nye tiltak. | `src/admin/AdminApp.tsx` |
| 2025-11-28 | Claude | Gjort tittel redigerbar for eksisterende tiltak. Flyttet "Grunnleggende informasjon"-seksjonen inn i "Tiltaksinformasjon"-fanen. ID vises som readonly i edit-modus. | `src/admin/components/TiltakEditor.tsx`, `src/admin/components/TiltakEditor.css` |

---

## 1. Bakgrunn og mål

### 1.1 Problemstilling

I dag er tiltakslisten i frontend statisk med 8 forhåndsdefinerte tiltak (hardkodet i `constants.ts`). Dette begrenser fleksibiliteten når innholdsredaktører ønsker å:
- Vise flere tiltak enn dagens 8
- Styre hvilke tiltak som vises for spesifikke byggtyper
- Begrense tiltak til bygg med byggår eldre enn et gitt årstall

### 1.2 Dagens løsning

**Frontend (FigmaBlokk):**
- `ENERGY_SOLUTIONS` i `src/components/FigmaBlokk/constants.ts` definerer 8 hardkodede tiltak
- `EnergySolutionButtons.tsx` rendrer listen som SVG-elementer med fast høyde (50px per tiltak)
- Listen har fast bredde (471px) og vises nederst på skjermen
- Ingen scrolling – alle 8 tiltak vises alltid

**Admin-UI:**
- `TiltakEditor` støtter allerede redigering av byggtype-spesifikk tekst via `buildingTypeParagraphs`
- Ingen funksjonalitet for å styre *hvilke* byggtyper et tiltak skal vises for
- Ingen funksjonalitet for byggår-basert filtrering

**Datamodell (`content/tiltak/schema.ts`):**
- `buildingTypeParagraphs` finnes – brukes for tekstvariasjon, ikke synlighet
- Ingen felt for byggtype-synlighet eller byggår-filter

---

## 2. Løsningsdesign

### 2.1 Frontend: Scrollbar for tiltakslisten

**Mål:** Gjøre tiltakslisten scrollbar slik at den kan vise flere enn 8 tiltak uten å ta mer plass på skjermen.

**Foreslått løsning:**
1. Bytt fra individuelt rendrede SVG-elementer til en container med `overflow-y: scroll`
2. Behold samme visuelle stil (471px bredde, 50px per tiltak-rad)
3. Sett `max-height` basert på tilgjengelig plass (f.eks. 400px eller dynamisk basert på viewport)
4. Legg til custom scrollbar-styling som matcher Oslo-designsystemet
5. Hent synlige tiltak dynamisk fra katalog-endepunkt i stedet for hardkodet array

**Filer som må endres:**
- `src/components/FigmaBlokk/constants.ts` – fjerne/endre `ENERGY_SOLUTIONS`
- `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` – legge til scrollbar-container
- `src/components/FigmaBlokk/components/EnergySolutionButtons.css` (ny) – scrollbar-styling

### 2.2 Datamodell: Nye felt for filtrering

**Nye felt i `TiltakContentSchema`:**

```typescript
// Nye felt som legges til i TiltakContentSchema
visibleForBuildingTypes: z.array(BuildingTypeKeySchema).default([]),  // Tom array = alle byggtyper
minBuildingYear: z.number().int().min(1800).max(2100).optional(),     // Bygg må være eldre enn dette året
```

**Semantikk:**
- `visibleForBuildingTypes: []` (tom array) betyr "vis for ingen byggtyper" (tiltaket skjules helt)
- `visibleForBuildingTypes: ['enebolig', 'rekkehus']` betyr "vis kun for enebolig og rekkehus"
- `minBuildingYear: 1970` betyr "vis kun for bygg bygget før 1970"
- `minBuildingYear: undefined` betyr "ingen årsfiltrering" (default/bakoverkompatibelt)

**Filer som må endres:**
- `content/tiltak/schema.ts` – legge til nye felt
- `content/schema-helpers.ts` – eventuelt nye helpers
- `src/types/contentCatalog.ts` – legge til felt i `TiltakCatalogItem`

### 2.3 Admin-UI: Redigering av filtreringsregler (Punkt-komponenter)

**Nye UI-elementer i `TiltakEditor`:**

Alle komponenter importeres fra `@oslokommune/punkt-react` og følger eksisterende mønster i `TiltakEditor.tsx` og `TilskuddEditor.tsx`.

#### 1. Byggtype-synlighet (checkboxer)

Bruker `PktInputWrapper` med `hasFieldset` for å gruppere checkboxer, og `PktCheckbox` for hver byggtype. Dette mønsteret er allerede etablert i `TilskuddEditor.tsx` for byggtype-valg.

```tsx
import { PktInputWrapper, PktCheckbox, PktButton } from "@oslokommune/punkt-react";

{/* Synlighet-seksjon */}
<section className="tiltak-editor__section">
  <h3 className="pkt-txt-18-medium">Synlighet</h3>

  <PktInputWrapper
    label="Vis for byggtyper"
    helptext="Velg hvilke byggtyper dette tiltaket skal vises for i tjenesten. La alle stå umarkert for å vise for alle byggtyper."
    forId="buildingtype-visibility-group"
    hasFieldset
  >
    <div className="tiltak-editor__checkbox-row">
      <PktButton
        skin="tertiary"
        size="small"
        onClick={selectAllBuildingTypes}
      >
        Velg alle
      </PktButton>
      <PktButton
        skin="tertiary"
        size="small"
        onClick={clearAllBuildingTypes}
      >
        Fjern alle
      </PktButton>
    </div>

    <div className="tiltak-editor__checkbox-grid">
      {buildingTypes.map((bt) => (
        <PktCheckbox
          key={bt.id}
          id={`visibility-${bt.id}`}
          label={bt.label}
          checked={visibleForBuildingTypes.includes(bt.id)}
          onChange={() => toggleBuildingTypeVisibility(bt.id)}
        />
      ))}
    </div>
  </PktInputWrapper>
</section>
```

#### 2. Byggår-filter (tekstinput med type="number")

Bruker `PktTextinput` med `type="number"` for årstall-input. Validering skjer med `hasError` og `errorMessage` props.

```tsx
import { PktTextinput, PktAlert } from "@oslokommune/punkt-react";

<PktTextinput
  id="min-building-year"
  label="Vis kun for bygg eldre enn år"
  helptext="Tiltaket vises kun for bygg bygget før dette årstallet. La stå tomt for å vise for alle bygg uavhengig av byggeår."
  type="number"
  placeholder="f.eks. 1970"
  value={minBuildingYear?.toString() ?? ""}
  onChange={(e) => handleMinBuildingYearChange(e.target.value)}
  onBlur={(e) => validateMinBuildingYear(e.target.value)}
  hasError={hasMinBuildingYearError}
  errorMessage="Årstallet må være mellom 1800 og 2100"
  min={1800}
  max={2100}
/>
```

**Punkt-komponenter som brukes:**

| Komponent | Import | Bruksområde |
|-----------|--------|-------------|
| `PktInputWrapper` | `@oslokommune/punkt-react` | Gruppere checkboxer med label, helptext og fieldset |
| `PktCheckbox` | `@oslokommune/punkt-react` | Individuelle byggtype-valg |
| `PktTextinput` | `@oslokommune/punkt-react` | Årstall-input med type="number" |
| `PktButton` | `@oslokommune/punkt-react` | "Velg alle" / "Fjern alle" knapper |
| `PktAlert` | `@oslokommune/punkt-react` | Feilmeldinger ved ugyldig input (hvis nødvendig) |

**CSS-klasser (legges til i `TiltakEditor.css`):**

```css
/* Checkbox-grid for byggtype-synlighet */
.tiltak-editor__checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--pkt-spacing-3);
  margin-top: var(--pkt-spacing-3);
}

/* Knapperad over checkboxene */
.tiltak-editor__checkbox-row {
  display: flex;
  gap: var(--pkt-spacing-2);
  margin-bottom: var(--pkt-spacing-3);
}

/* Synlighet-seksjon */
.tiltak-editor__section--visibility {
  background-color: var(--pkt-color-grays-grey-50);
  padding: var(--pkt-spacing-4);
  border-radius: var(--pkt-border-radius-medium);
  margin-top: var(--pkt-spacing-4);
}
```

**Filer som må endres:**
- `src/admin/components/TiltakEditor.tsx` – legge til ny seksjon med Punkt-komponenter
- `src/admin/components/TiltakEditor.css` – styling med Punkt-tokens
- `services/admin-api/contentRouter.ts` – støtte for nye felt ved lagring

### 2.4 Frontend: Dynamisk filtrering

**Filtreringslogikk:**
1. Ved oppstart hentes tiltakskatalogen med metadata inkludert `visibleForBuildingTypes` og `minBuildingYear`
2. Basert på brukerens adresse bestemmes:
   - `buildingType` fra Matrikkelen/CSV-data
   - `byggeaar` fra Matrikkelen/CSV-data
3. Filtrer tiltak:
   - Inkluder tiltak der `visibleForBuildingTypes` er tom ELLER inneholder brukerens byggtype
   - Inkluder tiltak der `minBuildingYear` er undefined ELLER `byggeaar < minBuildingYear`
4. Vis kun de filtrerte tiltakene i scrollbar-listen

**Filer som må endres:**
- `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` – hente og filtrere tiltak
- `src/hooks/contentHooks.tsx` – eventuelt ny hook `useTiltakCatalogFiltered(buildingType, buildingYear)`

---

## 3. Implementeringsplan

### Fase 1: Datamodell og Admin-UI (backend først)

| # | Oppgave | Filer | Avhengigheter |
|---|---------|-------|---------------|
| 1.1 | Utvid `TiltakContentSchema` med `visibleForBuildingTypes` og `minBuildingYear` | `content/tiltak/schema.ts` | – |
| 1.2 | Oppdater `TiltakCatalogItem` type med nye felt | `src/types/contentCatalog.ts` | 1.1 |
| 1.3 | Oppdater katalog-generering i API-server | `src/api-server.ts` | 1.2 |
| 1.4 | Oppdater Admin-API for nye felt | `services/admin-api/contentRouter.ts` | 1.1 |
| 1.5 | Legg til "Synlighet"-seksjon i `TiltakEditor` | `src/admin/components/TiltakEditor.tsx` | 1.4 |
| 1.6 | Test ende-til-ende i admin: lagre og hente med nye felt | – | 1.5 |

### Fase 2: Frontend scrollbar og dynamisk liste

| # | Oppgave | Filer | Avhengigheter |
|---|---------|-------|---------------|
| 2.1 | Lag CSS for scrollbar-container | `src/components/FigmaBlokk/components/EnergySolutionButtons.css` | – |
| 2.2 | Refaktorer `EnergySolutionButtons` til å bruke scrollbar-container | `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` | 2.1 |
| 2.3 | Hent tiltak dynamisk fra katalog i stedet for `ENERGY_SOLUTIONS` | `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` | 1.3 |
| 2.4 | Implementer filtreringslogikk basert på byggtype og byggår | `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` | 2.3 |
| 2.5 | Test med mock-data og ulike kombinasjoner | – | 2.4 |

### Fase 3: Migrasjon og testing

| # | Oppgave | Filer | Avhengigheter |
|---|---------|-------|---------------|
| 3.1 | Oppdater eksisterende tiltak-JSON med default-verdier | `content/tiltak/*.json` | 1.1 |
| 3.2 | Validering: kjør `npm run content:validate` | – | 3.1 |
| 3.3 | Deploy til staging og test ende-til-ende | – | 3.2 |
| 3.4 | Dokumentasjon: oppdater innholdsdrift-tiltak.md | `Dokumentasjon/innholdsdrift-tiltak.md` | 3.3 |

### Fase 4: Opprettelse av nye tiltak i Admin-UI

| # | Oppgave | Filer | Avhengigheter |
|---|---------|-------|---------------|
| 4.1 | Legg til `createTiltak`-funksjon i API-klient | `src/admin/api/adminApiClient.ts` | – |
| 4.2 | Legg til POST-endepunkt for nye tiltak | `services/admin-api/contentRouter.ts` | – |
| 4.3 | Utvid `TiltakEditor` med tittel-felt og create-modus | `src/admin/components/TiltakEditor.tsx` | 4.1, 4.2 |
| 4.4 | Oppdater `ContentList` med onClick for "Opprett"-knappen | `src/admin/components/ContentList.tsx` | 4.3 |
| 4.5 | Oppdater `AdminApp` med create-modus og routing | `src/admin/AdminApp.tsx` | 4.4 |
| 4.6 | Test ende-til-ende: opprett, rediger, publiser | – | 4.5 |

---

## 4. Tekniske detaljer

### 4.1 Schema-endringer

```typescript
// Legg til i TiltakContentSchema (content/tiltak/schema.ts)

const VisibilitySchema = z
  .object({
    buildingTypes: z.array(BuildingTypeKeySchema).default([]),  // Tom = alle
    minBuildingYear: z.number().int().min(1800).max(2100).optional()
  })
  .strict();

// Alternativt som flat struktur:
visibleForBuildingTypes: z.array(BuildingTypeKeySchema).default([]),
minBuildingYear: z.number().int().min(1800).max(2100).optional(),
```

### 4.2 Katalog-respons

```typescript
// TiltakCatalogItem utvidet (src/types/contentCatalog.ts)
export type TiltakCatalogItem = ContentCatalogItemBase<'tiltak'> & {
  grants: string[];
  supportTags: string[];
  buildingTypes: string[];           // Eksisterende: byggtyper med tekst
  visibleForBuildingTypes: string[]; // NY: byggtyper tiltaket vises for
  minBuildingYear?: number;          // NY: byggår-filter
  variantAudiences: string[];
};
```

### 4.3 Filtreringslogikk (frontend)

```typescript
function filterTiltakForBuilding(
  tiltak: TiltakCatalogItem[],
  buildingType: string | undefined,
  buildingYear: number | undefined
): TiltakCatalogItem[] {
  return tiltak.filter(t => {
    // Byggtype-filter
    const buildingTypeMatch =
      t.visibleForBuildingTypes.length === 0 ||  // Tom = vis for alle
      (buildingType && t.visibleForBuildingTypes.includes(buildingType));

    // Byggår-filter
    const buildingYearMatch =
      t.minBuildingYear === undefined ||  // Ingen filter = vis alltid
      (buildingYear !== undefined && buildingYear < t.minBuildingYear);

    return buildingTypeMatch && buildingYearMatch;
  });
}
```

### 4.4 Scrollbar CSS

```css
.tiltak-list-container {
  max-height: 400px;  /* Eller dynamisk basert på viewport */
  overflow-y: auto;
  width: 471px;

  /* Custom scrollbar */
  scrollbar-width: thin;
  scrollbar-color: #2A2859 #F8F0DD;
}

.tiltak-list-container::-webkit-scrollbar {
  width: 8px;
}

.tiltak-list-container::-webkit-scrollbar-track {
  background: #F8F0DD;
}

.tiltak-list-container::-webkit-scrollbar-thumb {
  background-color: #2A2859;
  border-radius: 4px;
}
```

### 4.5 Komplett implementasjon for TiltakEditor (Punkt-komponenter)

Nedenfor er fullstendig kode for den nye "Synlighet"-seksjonen i `TiltakEditor.tsx`, inkludert state-håndtering og callbacks.

#### Nye imports (legges til i eksisterende import-statement):

```tsx
import {
  PktAlert,
  PktButton,
  PktCheckbox,       // NY
  PktInputWrapper,
  PktRadioButton,
  PktSelect,
  PktTextarea,
  PktTextinput,
  PktTabs,
} from "@oslokommune/punkt-react";
```

#### Ny state og callbacks (legges til i TiltakEditor-komponenten):

```tsx
// ========== SYNLIGHET-STATE ==========

// Lokal state for byggtype-synlighet
const visibleForBuildingTypes = useMemo(
  () => editedTiltak.visibleForBuildingTypes ?? [],
  [editedTiltak.visibleForBuildingTypes]
);

// Lokal state for byggår-filter
const minBuildingYear = useMemo(
  () => editedTiltak.minBuildingYear,
  [editedTiltak.minBuildingYear]
);

// Validering for byggår
const [hasMinBuildingYearError, setMinBuildingYearError] = useState(false);

// ========== SYNLIGHET-CALLBACKS ==========

// Toggle en enkelt byggtype for synlighet
const toggleBuildingTypeVisibility = useCallback(
  (buildingTypeId: string) => {
    const current = editedTiltak.visibleForBuildingTypes ?? [];
    const updated = current.includes(buildingTypeId)
      ? current.filter((bt) => bt !== buildingTypeId)
      : [...current, buildingTypeId];

    setEditedTiltak((prev) => ({
      ...prev,
      visibleForBuildingTypes: updated,
    }));
    setIsDirty(true);
  },
  [editedTiltak.visibleForBuildingTypes]
);

// Velg alle byggtyper for synlighet
const selectAllBuildingTypesVisibility = useCallback(() => {
  const allIds = buildingTypes.map((bt) => bt.id);
  setEditedTiltak((prev) => ({
    ...prev,
    visibleForBuildingTypes: allIds,
  }));
  setIsDirty(true);
}, [buildingTypes]);

// Fjern alle byggtyper (vis for alle)
const clearAllBuildingTypesVisibility = useCallback(() => {
  setEditedTiltak((prev) => ({
    ...prev,
    visibleForBuildingTypes: [],
  }));
  setIsDirty(true);
}, []);

// Håndter endring av byggår-filter
const handleMinBuildingYearChange = useCallback((value: string) => {
  const trimmed = value.trim();

  if (trimmed === "") {
    setEditedTiltak((prev) => ({
      ...prev,
      minBuildingYear: undefined,
    }));
    setMinBuildingYearError(false);
    setIsDirty(true);
    return;
  }

  const parsed = parseInt(trimmed, 10);
  if (!Number.isNaN(parsed)) {
    setEditedTiltak((prev) => ({
      ...prev,
      minBuildingYear: parsed,
    }));
    setIsDirty(true);
  }
}, []);

// Valider byggår-filter ved blur
const validateMinBuildingYear = useCallback((value: string) => {
  const trimmed = value.trim();

  if (trimmed === "") {
    setMinBuildingYearError(false);
    return;
  }

  const parsed = parseInt(trimmed, 10);
  const isValid = !Number.isNaN(parsed) && parsed >= 1800 && parsed <= 2100;
  setMinBuildingYearError(!isValid);
}, []);
```

#### JSX for Synlighet-seksjonen (legges til i TiltakEditor render):

```tsx
{/* ========== SYNLIGHET-SEKSJON ========== */}
<section className="tiltak-editor__section tiltak-editor__section--visibility">
  <h3 className="pkt-txt-18-medium">Synlighet i tjenesten</h3>
  <p className="pkt-txt-14 tiltak-editor__section-description">
    Styr hvilke bygg tiltaket skal vises for basert på byggtype og byggeår.
  </p>

  {/* Byggtype-synlighet */}
  <PktInputWrapper
    label="Vis for byggtyper"
    helptext="Velg hvilke byggtyper dette tiltaket skal vises for. La alle stå umarkert for å vise for alle byggtyper."
    forId="buildingtype-visibility-group"
    hasFieldset
  >
    <div className="tiltak-editor__checkbox-row">
      <PktButton
        skin="tertiary"
        size="small"
        onClick={selectAllBuildingTypesVisibility}
      >
        Velg alle
      </PktButton>
      <PktButton
        skin="tertiary"
        size="small"
        onClick={clearAllBuildingTypesVisibility}
      >
        Fjern alle (vis for alle)
      </PktButton>
    </div>

    <div className="tiltak-editor__checkbox-grid">
      {buildingTypes
        .filter((bt) => bt.id !== "default")
        .map((bt) => (
          <PktCheckbox
            key={bt.id}
            id={`visibility-${bt.id}`}
            label={bt.label}
            checked={visibleForBuildingTypes.includes(bt.id)}
            onChange={() => toggleBuildingTypeVisibility(bt.id)}
          />
        ))}
    </div>

    {visibleForBuildingTypes.length === 0 && (
      <p className="tiltak-editor__hint pkt-txt-14">
        <em>Ingen byggtyper valgt – tiltaket vises for alle byggtyper.</em>
      </p>
    )}
  </PktInputWrapper>

  {/* Byggår-filter */}
  <div className="tiltak-editor__field-group">
    <PktTextinput
      id="min-building-year"
      label="Vis kun for bygg eldre enn år"
      helptext="Tiltaket vises kun for bygg bygget før dette årstallet. La feltet stå tomt for å vise for alle bygg."
      type="number"
      placeholder="f.eks. 1970"
      value={minBuildingYear?.toString() ?? ""}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        handleMinBuildingYearChange(e.target.value)
      }
      onBlur={(e: React.FocusEvent<HTMLInputElement>) =>
        validateMinBuildingYear(e.target.value)
      }
      hasError={hasMinBuildingYearError}
      errorMessage="Årstallet må være et heltall mellom 1800 og 2100"
    />

    {minBuildingYear && !hasMinBuildingYearError && (
      <p className="tiltak-editor__hint pkt-txt-14">
        <em>
          Tiltaket vises kun for bygg bygget før {minBuildingYear}.
        </em>
      </p>
    )}
  </div>
</section>
```

#### Tillegg til TiltakEditor.css:

```css
/* ========== SYNLIGHET-SEKSJON ========== */

.tiltak-editor__section--visibility {
  background-color: var(--pkt-color-surface-subtle, #f8f8f8);
  padding: var(--pkt-spacing-5, 24px);
  border-radius: var(--pkt-border-radius-medium, 8px);
  margin-top: var(--pkt-spacing-6, 32px);
  border: 1px solid var(--pkt-color-border-subtle, #e0e0e0);
}

.tiltak-editor__section-description {
  color: var(--pkt-color-text-subtle, #666);
  margin-bottom: var(--pkt-spacing-4, 16px);
}

.tiltak-editor__checkbox-row {
  display: flex;
  gap: var(--pkt-spacing-3, 12px);
  margin-bottom: var(--pkt-spacing-4, 16px);
}

.tiltak-editor__checkbox-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--pkt-spacing-3, 12px);
  margin-top: var(--pkt-spacing-3, 12px);
}

.tiltak-editor__field-group {
  margin-top: var(--pkt-spacing-5, 24px);
}

.tiltak-editor__hint {
  color: var(--pkt-color-text-subtle, #666);
  margin-top: var(--pkt-spacing-2, 8px);
  font-style: italic;
}
```

### 4.6 Fase 4: Opprettelse av nye tiltak – Teknisk spesifikasjon

#### 4.6.1 Bakgrunn og mål

I dag kan redaktører kun redigere eksisterende tiltak via Admin-UI. "Opprett tiltak"-knappen i `/admin` mangler funksjonalitet. Målet er å gjøre det mulig å:
1. Opprette helt nye tiltak direkte i Admin-UI
2. Angi tittel og ID (slug) for det nye tiltaket
3. Gjenbruke eksisterende redigeringsskjema fra `TiltakEditor`

#### 4.6.2 Arkitekturvalg

**Tilnærming:** Gjenbruk `TiltakEditor` med en ny prop `mode: "create" | "edit"`. I create-modus:
- Starter med et tomt tiltak-objekt (default-verdier fra schema)
- Tittel-feltet er redigerbart og påkrevd
- ID (slug) genereres automatisk fra tittelen, men kan overstyres
- Lagring kaller `createTiltak` (POST) i stedet for `updateTiltak` (PUT)

**Alternativ vurdert (forkastet):** Egen `TiltakCreateWizard`-komponent. Forkastet fordi det ville duplisere mye logikk fra `TiltakEditor`, og skjemastrukturene er identiske.

#### 4.6.3 API-endepunkt (Backend)

**Nytt endepunkt:** `POST /admin/api/content/tiltak`

```typescript
// services/admin-api/contentRouter.ts

const CreateTiltakPayloadSchema = z.object({
  tiltak: TiltakContentSchema,
  changeSummary: z
    .string()
    .trim()
    .min(5, { message: "Bruk en kort oppsummering" })
    .max(280)
    .optional(),
});

router.post("/content/tiltak", async (req, res, next) => {
  try {
    const body = CreateTiltakPayloadSchema.parse(req.body ?? {});
    const actor = resolveUserContext(req);
    const tiltakId = body.tiltak.id;

    // Valider at ID er gyldig slug
    SlugSchema.parse(tiltakId);

    // Sjekk at tiltak med denne ID-en ikke allerede eksisterer
    const publishedPath = buildTiltakPath(tiltakId);
    const draftPath = buildTiltakDraftPath(tiltakId);

    const [publishedExists, draftExists] = await Promise.all([
      storage.exists(publishedPath),
      storage.exists(draftPath),
    ]);

    if (publishedExists || draftExists) {
      throw new HttpError(
        409,
        `Et tiltak med ID "${tiltakId}" eksisterer allerede`
      );
    }

    // Hent dictionary for å bygge benefits fra refs
    const { dictionary } = await loadDictionary(storage);
    const refs = dedupeRefs(body.tiltak.benefitRefs ?? []);
    if (refs.length > 0) {
      validateBenefitRefs(refs, dictionary);
    }

    const now = new Date().toISOString();
    const summary = body.changeSummary?.trim() || "Opprettet via admin-UI";

    // Opprett som draft (ikke publisert)
    const newTiltak: TiltakContent = {
      ...body.tiltak,
      benefitRefs: refs,
      benefits: buildBenefitsFromRefs(refs, dictionary),
      metadata: {
        ...body.tiltak.metadata,
        status: "draft",
        updatedAt: now,
        updatedBy: actor.email,
        changeSummary: summary.slice(0, 500),
      },
    };

    // Skriv til draft-fil
    const result = await storage.writeJson(draftPath, newTiltak);

    console.warn(
      `[admin-api] ${actor.email} opprettet nytt tiltak ${tiltakId}`
    );

    res.status(201).json({
      id: newTiltak.id,
      path: draftPath,
      tiltak: newTiltak,
      metadata: newTiltak.metadata,
      generation: result.generation,
      hasDraft: true,
      hasPublished: false,
      source: "draft",
    });
  } catch (error) {
    next(error);
  }
});
```

**Respons-type:**
```typescript
export type CreateTiltakResponse = {
  id: string;
  path: string;
  tiltak: TiltakContent;
  metadata: TiltakContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft";
};
```

#### 4.6.4 API-klient (Frontend)

**Ny funksjon i `adminApiClient.ts`:**

```typescript
export type CreateTiltakPayload = {
  tiltak: TiltakContent;
  changeSummary?: string;
};

export type CreateTiltakResponse = {
  id: string;
  path: string;
  tiltak: TiltakContent;
  metadata: TiltakContent["metadata"];
  generation: string | null;
  hasDraft: boolean;
  hasPublished: boolean;
  source: "draft";
};

export async function createTiltak(
  payload: CreateTiltakPayload
): Promise<CreateTiltakResponse> {
  return request<CreateTiltakResponse>("/content/tiltak", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

#### 4.6.5 TiltakEditor-utvidelser

**Nye props:**

```typescript
export interface TiltakEditorProps {
  tiltak: TiltakContent;
  onSave: (updated: TiltakContent) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  mode?: "edit" | "create";  // NY - default "edit"
}
```

**Tittel-felt (vises alltid, redigerbart i create-modus):**

```tsx
{/* Tittel-felt - alltid synlig, redigerbart i create-modus */}
<section className="tiltak-editor__section">
  <PktTextinput
    id="tiltak-title"
    label="Tiltakstittel"
    helptext="Tittelen som vises i tiltakslisten og på tiltakskortet"
    value={editedTiltak.title}
    onChange={(e) => {
      const newTitle = e.target.value;
      setEditedTiltak((prev) => ({
        ...prev,
        title: newTitle,
        // I create-modus: generer slug fra tittel automatisk
        ...(mode === "create" && !manualIdOverride
          ? { id: generateSlug(newTitle) }
          : {}),
      }));
      setIsDirty(true);
    }}
    disabled={mode === "edit"}  // Kun redigerbar i create-modus
    hasError={mode === "create" && !editedTiltak.title.trim()}
    errorMessage="Tittel er påkrevd"
  />

  {mode === "create" && (
    <PktTextinput
      id="tiltak-id"
      label="Tiltak-ID (slug)"
      helptext="Unik identifikator. Genereres automatisk fra tittelen, men kan overstyres."
      value={editedTiltak.id}
      onChange={(e) => {
        setManualIdOverride(true);
        setEditedTiltak((prev) => ({
          ...prev,
          id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        }));
        setIsDirty(true);
      }}
      hasError={!isValidSlug(editedTiltak.id)}
      errorMessage="ID må være lowercase med kun bokstaver, tall og bindestreker"
    />
  )}
</section>
```

**Slug-generering:**

```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Fjern diakritiske tegn (æ→ae, ø→o, å→a)
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")      // Erstatt ikke-alfanumeriske med bindestrek
    .replace(/^-|-$/g, "")            // Fjern ledende/etterfølgende bindestreker
    .slice(0, 50);                     // Maks 50 tegn
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3;
}
```

**Default tiltak-objekt for create-modus:**

```typescript
function createEmptyTiltak(): TiltakContent {
  return {
    schemaVersion: 1,
    id: "",
    title: "",
    introParagraphs: [""],
    buildingTypeParagraphs: {
      default: [""],
    },
    benefitRefs: [],
    benefits: [],
    glossaryTermRefs: [],
    readMore: [],
    callsToAction: [],
    customSections: [],
    tabs: [],
    accordion: [],
    stats: [],
    grants: [],
    relatedTiltak: [],
    supportTags: [],
    audiences: ["standard", "gulliste"],  // Støtter begge målgrupper
    visibleForBuildingTypes: [],
    metadata: {
      status: "draft",
      updatedAt: new Date().toISOString(),
      updatedBy: "pending",  // Placeholder - backend overskriver med faktisk bruker
      changeSummary: "Opprettet",
    },
    // Tom gulliste-variant - vil bli fylt ut når bruker redigerer gul liste-innhold
    variants: [
      {
        audience: "gulliste",
        benefitRefs: [],
      },
    ],
  };
}
```

#### 4.6.6 ContentList-endringer

**Koble "Opprett tiltak"-knappen:**

```tsx
// I ContentList.tsx

<PktButton
  skin="primary"
  size="medium"
  variant="icon-left"
  iconName="plus-sign"
  onClick={() => onCreateNew?.()}  // NY prop
>
  <span>
    {mode === "tiltak" ? "Opprett tiltak" : "Opprett tilskudd"}
  </span>
</PktButton>
```

**Ny prop i interface:**

```typescript
interface ContentListProps {
  // ... eksisterende props
  onCreateNew?: () => void;  // NY
}
```

#### 4.6.7 AdminApp-endringer

**Ny state og håndtering:**

```typescript
function AdminShell() {
  // ... eksisterende state
  const [isCreating, setIsCreating] = useState(false);  // NY

  const handleCreateNew = useCallback(() => {
    setIsCreating(true);
    setActiveView("editor");
    setEditItem(null);  // Ingen eksisterende item
  }, []);

  const handleEditorClose = useCallback(() => {
    setEditItem(null);
    setIsCreating(false);  // Reset create-modus
    setActiveView("dashboard");
  }, []);

  // ... i return:

  {activeView === "editor" && isCreating && mode === "tiltak" && (
    <TiltakEditorPage
      tiltakId={null}  // null = create-modus
      onClose={handleEditorClose}
      onSaveSuccess={handleEditorSave}
      mode="create"
    />
  )}
```

#### 4.6.8 TiltakEditorPage-endringer

**Støtte for create-modus:**

```typescript
interface TiltakEditorPageProps {
  tiltakId: string | null;  // null = create-modus
  onClose: () => void;
  onSaveSuccess: () => void;
  mode?: "edit" | "create";
}

export function TiltakEditorPage({
  tiltakId,
  onClose,
  onSaveSuccess,
  mode = tiltakId ? "edit" : "create",
}: TiltakEditorPageProps) {
  // I create-modus: start med tomt tiltak
  const [tiltak, setTiltak] = useState<TiltakContent | null>(
    mode === "create" ? createEmptyTiltak() : null
  );

  // Hopp over fetch i create-modus
  useEffect(() => {
    if (mode === "create" || !tiltakId) return;
    // ... eksisterende fetch-logikk
  }, [tiltakId, mode]);

  const handleSave = useCallback(
    async (updated: TiltakContent) => {
      if (mode === "create") {
        // Opprett nytt tiltak
        const response = await createTiltak({
          tiltak: updated,
          changeSummary: updated.metadata.changeSummary,
        });
        setGeneration(response.generation);
        setTiltak(response.tiltak);
        // Bytt til edit-modus etter opprettelse
        // (eller naviger tilbake til liste)
        onSaveSuccess();
      } else {
        // Eksisterende oppdateringslogikk
        // ...
      }
    },
    [mode, onSaveSuccess]
  );

  // ...
}
```

#### 4.6.9 Valideringsregler

| Felt | Validering | Feilmelding |
|------|------------|-------------|
| `title` | Påkrevd, min 3 tegn | "Tittel er påkrevd (minst 3 tegn)" |
| `id` | Gyldig slug, unik | "ID må være lowercase med kun bokstaver, tall og bindestreker (minst 3 tegn)" / "Et tiltak med denne ID-en eksisterer allerede" |
| `introParagraphs` | Minst ett ikke-tomt avsnitt (kun for standard-audience) | "Introduksjonstekst er påkrevd" |
| `buildingTypeParagraphs.default` | Minst ett ikke-tomt avsnitt (kun for default byggtype og standard-audience) | "Standard byggtype-tekst er påkrevd" |
| `metadata.updatedBy` | Ikke tom streng (backend overskriver med faktisk bruker) | Skjema-validering feiler |

**Merk:** Frontend sender `updatedBy: "pending"` som placeholder. Backend overskriver dette med brukerens e-post fra request-header.

#### 4.6.10 UX-flyt

1. Bruker klikker "Opprett tiltak" i ContentList
2. TiltakEditorPage åpnes i create-modus med tomt skjema
3. Bruker fyller inn tittel → ID genereres automatisk
4. Bruker kan overstyre ID om ønskelig
5. Bruker fyller inn påkrevde felter (intro, byggtype-tekst)
6. Bruker klikker "Lagre" → tiltak opprettes som draft
7. Bruker kan fortsette å redigere eller publisere

#### 4.6.11 Feilhåndtering

| Scenario | Håndtering |
|----------|------------|
| ID allerede i bruk | Vis feilmelding, foreslå alternativ ID |
| Nettverksfeil ved lagring | Behold skjemadata, vis retry-knapp |
| Ugyldig slug-format | Blokkér lagring, vis inline-feil |
| Manglende påkrevde felt | Blokkér lagring, marker felter med feil |

---

## 5. Risikovurdering

| Risiko | Sannsynlighet | Konsekvens | Mitigering |
|--------|---------------|------------|------------|
| Breaking change for eksisterende tiltak | Lav | Høy | Default-verdier gjør endringen bakoverkompatibel |
| Performance ved mange tiltak | Lav | Medium | Katalog er cachet; kun metadata lastes |
| Scrollbar-UX på mobil | Medium | Medium | Test grundig på touch-enheter |
| Konflikter med eksisterende styling | Lav | Lav | CSS er isolert i egen fil |

---

## 6. Bakoverkompatibilitet

Alle endringer er designet for å være bakoverkompatible:

1. **Nye felt har default-verdier:**
   - `visibleForBuildingTypes: []` (tom array = vis for alle)
   - `minBuildingYear: undefined` (ingen filter)

2. **Eksisterende tiltak trenger ikke migrering:**
   - Schemaet vil automatisk fylle inn default-verdier
   - Ingen breaking changes for frontend

3. **Frontend graceful fallback:**
   - Hvis katalog mangler nye felt, behandles som "vis for alle"

---

## 7. Fremtidige utvidelser

Denne arkitekturen åpner for:
- **Rekkefølge-styring:** Legg til `displayOrder: number` for manuell sortering
- **Sesongstyring:** Legg til `visibleFrom`/`visibleTo` datoer
- **Geografisk filtrering:** Filtrering basert på kommune/bydel
- **Brukerbasert personalisering:** Lagre valg i localStorage

---

## 8. Neste steg

> **VIKTIG:** Denne seksjonen skal oppdateres etter hvert arbeid som gjennomføres. Fjern fullførte steg og legg til nye ved behov.

### Gjeldende neste steg

1. ✅ ~~**Fase 1**: Datamodell og Admin-UI~~ – Fullført 2025-11-27
2. ✅ ~~**Fase 2**: Frontend scrollbar og dynamisk liste~~ – Fullført 2025-11-27
3. 🔄 **Fase 3**: Migrasjon og testing – Pågår
4. ✅ ~~**Fase 4**: Opprettelse av nye tiltak i Admin-UI~~ – Fullført 2025-11-27

**Neste for Fase 3:** Når Matrikkel-API er oppe igjen:
1. Kjør manuell QA lokalt med ulike adresser/byggtyper
2. Test Fase 4-funksjonalitet: opprett nytt tiltak, rediger, publiser
3. Deploy til staging via push til `deploy/gcp`

### Etter fullført arbeid

Etter hver arbeidsøkt:
1. **Oppdater "Status og fremdrift"** – Merk av fullførte deloppgaver med `[x]` og oppdater fasestatus
2. **Legg til i "Arbeidslogg"** – Loggfør dato, hvem, hva og relaterte filer
3. **Oppdater "Neste steg"** – Fjern fullførte steg og legg til neste

### Validering underveis

- Etter schema-endringer: `npm run content:validate`
- Etter TypeScript-endringer: `npx tsc --noEmit`
- Etter Admin-UI-endringer: Test manuelt i admin på staging

---

## 9. Referanser

- `Dokumentasjon/innholdsdrift-tiltak.md` – Hovedrutine for innholdsdrift
- `Dokumentasjon/Utvikling/ui/publiserings-wizard.md` – Admin-UI publiseringsflyt
- `content/tiltak/schema.ts` – Eksisterende tiltak-schema
- `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx` – Eksisterende frontend-komponent
