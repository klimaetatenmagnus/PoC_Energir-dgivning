# Publiserings-wizard for Admin-UI

Opprettet: 2025-11-26
Single source of truth for utvikling av publiserings-wizarden.

---

## 1. Bakgrunn og mål

Redaktører trenger en intuitiv, steg-for-steg-flyt for å oppdatere innhold på energinøkkelen.no uten å involvere utviklere eller kommandolinjen. Wizarden skal:

- Samle alle upubliserte endringer og guide redaktøren gjennom publisering
- Sørge for visuell QA i staging før prod-publisering
- Gi mulighet til å nullstille/forkaste endringer underveis
- Ikke involvere GitHub – all innholdsdata lever i GCS-bøtter

---

## 2. Kontekst fra eksisterende system

### 2.1 To-fil-strategi for draft/published

Admin-systemet bruker en to-fil-strategi for å håndtere upubliserte endringer:

| Fil | Innhold | Hvem leser |
|-----|---------|------------|
| `<id>.json` | Sist publiserte versjon | Frontend (alltid) |
| `<id>.draft.json` | Arbeidsversjon under redigering | Admin-UI via Admin-API |

**Eksisterende API-endepunkter for enkeltfiler:**

| Endepunkt | Metode | Beskrivelse |
|-----------|--------|-------------|
| `/admin/api/content/tiltak/:id` | GET | Returnerer draft hvis den finnes, ellers publisert versjon. Response inkluderer `hasDraft` og `source`. |
| `/admin/api/content/tiltak/:id` | PUT | Skriver alltid til `*.draft.json`. Setter `status: "draft"` automatisk. |
| `/admin/api/content/tiltak/:id/publish` | POST | Kopierer draft til hovedfil med `status: "published"`, sletter draft-filen. |
| `/admin/api/content/tiltak/:id/draft` | DELETE | Forkaster draft uten å publisere. |

Tilsvarende endepunkter finnes for `/admin/api/content/tilskudd/:id`.

### 2.2 Cloud Build-integrasjon

Admin-API (`services/admin-api/*`) har allerede `POST /admin/api/publish` som trigger en Cloud Build-jobb for staging→prod-synkronisering:

**Request-body:**
```json
{
  "changeSummary": "Kort forklaring (5-1000 tegn)",
  "items": [
    { "id": "solenergi", "collection": "tiltak" },
    { "id": "enova-solcelleanlegg", "collection": "tilskudd" }
  ],
  "dryRun": false,
  "targetEnvironment": "prod"
}
```

**Response (202 Accepted):**
```json
{
  "requestId": "51d7b3ab-...",
  "buildId": "f1fa2a88-...",
  "operationName": "operations/build/...",
  "status": "QUEUED",
  "logUrl": "https://console.cloud.google.com/cloud-build/builds/...",
  "consoleUrl": "https://console.cloud.google.com/cloud-build/builds/..."
}
```

Cloud Build-jobben kjører:
1. `gsutil -m rsync -d -r gs://energinokkelen-content/content gs://energinokkelen-content-prod/content`
2. Skriver publiseringslogg til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json`

### 2.3 GCS-bøtter og miljøer

| Miljø | Bøtte | Beskrivelse |
|-------|-------|-------------|
| Staging | `gs://energinokkelen-content/content/` | Draft-filer og QA |
| Prod | `gs://energinokkelen-content-prod/content/` | Publisert innhold |
| Logger | `gs://energinokkelen-content-prod/content/logs/` | Publiseringshistorikk |

**GCP-prosjekt:** `energiverktoy-poc-1234` (region: `europe-north1`)

**Staging-URL:** `staging.energinøkkelen.no` (IP `34.111.174.210`)

### 2.4 Servicekontoer og tilgang

| Servicekonto | Rolle | Beskrivelse |
|--------------|-------|-------------|
| `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` | `storage.objectAdmin` | Kjører Cloud Build-stegene for staging→prod sync |
| `run-energinokkelen-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` | `cloudbuild.builds.editor`, `storage.objectAdmin` | Kjører Admin-API på Cloud Run |

**IAP-beskyttelse:** Admin-UI (`/admin/*`) er beskyttet av Identity-Aware Proxy. Kun medlemmer av Workspace-gruppen `energinokkel-redaktor@klimaoslo.no` har tilgang.

**Cloud Run-tjeneste:** Admin-UI kjører på `energinokkelen-admin` (staging) med ingress `internal-and-cloud-load-balancing`.

### 2.5 Eksisterende Admin-UI struktur

```
src/admin/
├── AdminApp.tsx              # Hovedkomponent med providers
├── api/adminApiClient.ts     # API-klient mot Admin-API
├── components/
│   ├── ContentList.tsx       # Katalog over tiltak/tilskudd
│   ├── TiltakEditor.tsx      # Skjema for tiltak-redigering
│   ├── TiltakEditorPage.tsx  # Wrapper med draft/publish-workflow
│   ├── TilskuddEditor.tsx    # Skjema for tilskudd-redigering
│   ├── TilskuddEditorPage.tsx
│   ├── BenefitsPage.tsx      # Fordel-editor
│   ├── GlossaryPage.tsx      # Ordliste-editor
│   └── PreviewPanel.tsx      # Forhåndsvisning
├── context/                  # React context for dictionary etc.
└── types.ts                  # TypeScript-typer
```

---

## 3. Brukerreise (5 steg)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. ENDRE        2. FORHÅNDSVIS     3. STAGING      4. QA         5. PROD   │
│  ───────────────────────────────────────────────────────────────────────── │
│  Rediger i       Se endringer       Send til        Sjekk på      Publiser  │
│  editor          i admin-preview    staging         staging.      til       │
│                                                     energi-       energi-   │
│                                                     nokkelen.no   nøkkelen  │
│                                                                   .no       │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Steg | Navn | Beskrivelse | Handling |
|------|------|-------------|----------|
| 1 | **Endre innhold** | Redaktøren redigerer tiltak/tilskudd/fordeler/ordliste via editorene. Endringer lagres som `*.draft.json`. | Automatisk – skjer i eksisterende editorer |
| 2 | **Forhåndsvis** | Se endringene i admin-preview med valgt audience og byggtype. Verifiser at tekst og layout ser riktig ut. | Klikk "Forhåndsvis" i editoren |
| 3 | **Send til staging** | Synk draft-filer til staging-bøtten (`gs://energinokkelen-content`). Gjør endringene tilgjengelige på staging-frontend. | Klikk "Send til staging" i wizarden |
| 4 | **Visuell QA** | Åpne `staging.energinøkkelen.no` og verifiser at tiltakskortene vises korrekt i faktisk frontend-kontekst. Sjekkliste vises i wizarden. | Klikk "Åpne staging" + bekreft sjekkliste |
| 5 | **Publiser til prod** | Trigger Cloud Build-jobb som kopierer staging→prod. Logger publiseringen. | Klikk "Publiser til energinøkkelen.no" |

---

## 4. UI-design

### 4.1 Floating action bar

Knappene ligger i en fast posisjonert boks (`position: fixed; bottom: 24px; right: 24px;`) som alltid er synlig uavhengig av scroll eller hvilken del av `/admin` brukeren befinner seg på. Dette gir:

- Konstant oversikt over upubliserte endringer
- Lett tilgang til publisering fra alle sider (katalog, editor, fordeler, ordliste)
- Mulighet til å redigere flere elementer før man starter wizard

```
                                        ┌─────────────────────────────────────┐
                                        │  3 upubliserte endringer            │
                                        │                                     │
                                        │  ┌───────────────────────────────┐  │
                                        │  │ 🚀 Oppdater Energinøkkelen   │  │
                                        │  └───────────────────────────────┘  │
                                        │  ┌───────────────────────────────┐  │
                                        │  │ ↩ Nullstill endringer        │  │
                                        │  └───────────────────────────────┘  │
                                        └─────────────────────────────────────┘
```

**Oppførsel:**
- Vises kun når `drafts.count > 0`
- Skjules automatisk når alle drafts er publisert eller forkastet
- Animeres inn/ut med fade + slide for å ikke distrahere
- Z-index høy nok til å ligge over alt annet innhold
- På mobil: full bredde med margin, sentrert nederst

**Punkt-komponenter:**
- Container: `pkt-card` med `skin="outlined"` og skygge
- Teller: `PktTag skin="blue"` eller ren tekst
- `PktButton skin="primary"` → "Oppdater Energinøkkelen"
- `PktButton skin="secondary"` → "Nullstill endringer"

**CSS:**

```css
.publish-action-bar {
  position: fixed;
  bottom: var(--pkt-spacing-6); /* 24px */
  right: var(--pkt-spacing-6);
  z-index: 1000;

  display: flex;
  flex-direction: column;
  gap: var(--pkt-spacing-3);
  padding: var(--pkt-spacing-4);

  background: var(--pkt-color-brand-white);
  border: 1px solid var(--pkt-color-grays-grey-200);
  border-radius: var(--pkt-border-radius-medium);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* Animasjon */
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Mobil */
@media (max-width: 599px) {
  .publish-action-bar {
    left: var(--pkt-spacing-4);
    right: var(--pkt-spacing-4);
    bottom: var(--pkt-spacing-4);
  }
}
```

### 4.2 Wizard-modal med PktStepper

Bruker `PktStepper` med vertikal orientering for å vise fremdrift:

```jsx
<PktStepper orientation="vertical" activeStep={currentStep}>
  <PktStep title="Gjennomgå endringer" status={step1Status}>
    {/* Liste over draft-filer med tittel og changeSummary */}
  </PktStep>
  <PktStep title="Send til staging" status={step2Status}>
    {/* Knapp + status for staging-sync */}
  </PktStep>
  <PktStep title="Visuell QA i staging" status={step3Status}>
    {/* Lenke til staging + sjekkliste */}
  </PktStep>
  <PktStep title="Publiser til energinøkkelen.no" status={step4Status}>
    {/* Bekreft + Cloud Build-status */}
  </PktStep>
</PktStepper>
```

### 4.3 Steg 1 – Gjennomgå endringer

```
┌─────────────────────────────────────────────────────────────────┐
│  ● Gjennomgå endringer                                          │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Følgende endringer vil bli publisert:                         │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📄 Varmepumpe (tiltak)                                    │ │
│  │    "Oppdatert intro-tekst og lagt til ny fordel"         │ │
│  │    Sist endret: 26. nov 2025 kl. 14:32                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 📄 Enova varmepumpe (tilskudd)                            │ │
│  │    "Justert søknadslenke"                                 │ │
│  │    Sist endret: 26. nov 2025 kl. 14:15                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │ Neste: Staging →│                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Steg 2 – Send til staging

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Gjennomgå endringer                                          │
│  ● Send til staging                                             │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Endringene sendes til staging-miljøet slik at du kan          │
│  verifisere dem på staging.energinøkkelen.no før de            │
│  publiseres til brukerne.                                       │
│                                                                 │
│  ┌─────────────────────────┐                                   │
│  │ 📤 Send til staging    │                                   │
│  └─────────────────────────┘                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✓ Staging oppdatert!                                    │   │
│  │   2 filer synkronisert til staging-bøtten.              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────┐                                           │
│  │ Neste: QA →     │                                           │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Steg 3 – Visuell QA

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Gjennomgå endringer                                          │
│  ✓ Send til staging                                             │
│  ● Visuell QA i staging                                         │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Åpne staging-nettsiden og verifiser at endringene ser         │
│  riktige ut i faktisk frontend-kontekst.                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔗 Åpne staging.energinøkkelen.no                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Sjekkliste før publisering:                                    │
│  ☐ Teksten vises korrekt i tiltakskortet                       │
│  ☐ Fordeler og støtteordninger er riktige                      │
│  ☐ Lenker fungerer                                              │
│  ☐ Gul liste-varianten (hvis relevant) er sjekket              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✓ Jeg har verifisert endringene i staging               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Neste: Publiser →                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.6 Steg 4 – Publiser til prod

```
┌─────────────────────────────────────────────────────────────────┐
│  ✓ Gjennomgå endringer                                          │
│  ✓ Send til staging                                             │
│  ✓ Visuell QA i staging                                         │
│  ● Publiser til energinøkkelen.no                               │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  ⚠️  Dette publiserer endringene til energinøkkelen.no         │
│      og gjør dem synlige for alle brukere.                      │
│                                                                 │
│  Oppsummering:                                                  │
│  • 2 tiltak oppdatert                                           │
│  • 1 tilskudd oppdatert                                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Legg til en kort beskrivelse av endringene:              │  │
│  │ ┌────────────────────────────────────────────────────┐   │  │
│  │ │ Oppdatert varmepumpe-info og Enova-lenke          │   │  │
│  │ └────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────┐                         │
│  │ 🚀 Publiser til energinøkkelen.no │                         │
│  └───────────────────────────────────┘                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ✓ Publisering fullført!                                 │   │
│  │   Cloud Build-jobb: cb-abc123                           │   │
│  │   Se logg: [Åpne i Cloud Console]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.7 Nullstilling av endringer

"Nullstill endringer"-knappen åpner en bekreftelsesdialog:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Forkast alle upubliserte endringer?                        │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Dette vil slette alle draft-filer og tilbakestille            │
│  innholdet til sist publiserte versjon.                         │
│                                                                 │
│  Følgende endringer vil bli forkastet:                          │
│  • Varmepumpe (tiltak)                                          │
│  • Enova varmepumpe (tilskudd)                                  │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────────────┐               │
│  │ Avbryt          │  │ 🗑 Forkast endringer    │               │
│  └─────────────────┘  └─────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. API-endepunkter

### 5.1 Nye endepunkter

| Endepunkt | Metode | Beskrivelse |
|-----------|--------|-------------|
| `/admin/api/drafts` | GET | Liste alle draft-filer (tiltak + tilskudd + dictionary) |
| `/admin/api/drafts/sync-staging` | POST | Synk alle drafts til staging-bøtten |
| `/admin/api/drafts/discard-all` | DELETE | Slett alle draft-filer |

### 5.2 GET /admin/api/drafts

**Response:**

```json
{
  "drafts": [
    {
      "id": "varmepumpe",
      "collection": "tiltak",
      "title": "Varmepumpe",
      "changeSummary": "Oppdatert intro-tekst",
      "updatedAt": "2025-11-26T14:32:00Z",
      "updatedBy": "redaktor@klimaoslo.no"
    },
    {
      "id": "enova-varmepumpe",
      "collection": "tilskudd",
      "title": "Enova varmepumpe",
      "changeSummary": "Justert søknadslenke",
      "updatedAt": "2025-11-26T14:15:00Z",
      "updatedBy": "redaktor@klimaoslo.no"
    }
  ],
  "count": 2
}
```

### 5.3 POST /admin/api/drafts/sync-staging

**Response:**

```json
{
  "success": true,
  "synced": [
    { "id": "varmepumpe", "collection": "tiltak" },
    { "id": "enova-varmepumpe", "collection": "tilskudd" }
  ],
  "stagingUrl": "https://staging.energinøkkelen.no"
}
```

### 5.4 Eksisterende endepunkt: POST /admin/api/publish

Brukes i steg 4 for å trigger Cloud Build staging→prod. Se §2.2 for request/response-format.

---

## 6. React-komponenter

### 6.1 Nye komponenter

| Komponent | Fil | Beskrivelse |
|-----------|-----|-------------|
| `PublishActionBar` | `src/admin/components/PublishActionBar.tsx` | Floating action bar med knapper og draft-teller |
| `PublishActionBar.css` | `src/admin/components/PublishActionBar.css` | Fixed positioning, animasjoner, responsiv layout |
| `PublishWizard` | `src/admin/components/PublishWizard.tsx` | Modal med `PktStepper` for wizard-flyten |
| `PublishWizard.css` | `src/admin/components/PublishWizard.css` | Styling (Punkt-tokens) |
| `DraftsSummary` | `src/admin/components/DraftsSummary.tsx` | Liste over upubliserte endringer (steg 1) |
| `QAChecklist` | `src/admin/components/QAChecklist.tsx` | Sjekkliste for visuell QA (steg 3) |
| `DraftsProvider` | `src/admin/context/DraftsContext.tsx` | React context for draft-tilstand |

### 6.2 Plassering i komponenttreet

```
AdminApp.tsx
├── ContentFetchProvider
├── AdminDictionaryProvider
├── DraftsProvider              ← NY: holder styr på alle drafts
│   ├── Routes (katalog, editor, etc.)
│   └── PublishActionBar        ← NY: vises på alle sider når drafts > 0
│       └── PublishWizard       ← NY: åpnes som modal
```

`DraftsProvider` henter draft-listen ved oppstart og etter hver lagring, slik at `PublishActionBar` alltid viser korrekt antall.

### 6.3 Tilstandshåndtering

```typescript
interface DraftSummary {
  id: string;
  collection: 'tiltak' | 'tilskudd' | 'dictionary';
  title: string;
  changeSummary?: string;
  updatedAt: string;
  updatedBy?: string;
}

interface DraftsContextValue {
  drafts: DraftSummary[];
  count: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface PublishWizardState {
  currentStep: 1 | 2 | 3 | 4;
  drafts: DraftSummary[];
  stagingSynced: boolean;
  qaConfirmed: boolean;
  publishStatus: 'idle' | 'publishing' | 'success' | 'error';
  buildId?: string;
  error?: string;
}
```

---

## 7. Implementeringsplan

**Rutine:** Når en deloppgave er ferdig, oppdater tabellen under med ✅ i Status-kolonnen og legg til en rad i utviklingsloggen (§10).

| # | Oppgave | Størrelse | Avhengigheter | Status |
|---|---------|-----------|---------------|--------|
| 1 | Implementer `GET /admin/api/drafts` | Liten | Eksisterende contentStorage | ✅ |
| 2 | Implementer `POST /admin/api/drafts/sync-staging` | Medium | GCS-tilgang | ✅ |
| 3 | Implementer `DELETE /admin/api/drafts/discard-all` | Liten | Eksisterende delete-logikk | ✅ |
| 4 | Lag `DraftsProvider` context | Liten | #1 | ✅ |
| 5 | Lag `PublishActionBar`-komponent | Liten | #4 | ✅ |
| 6 | Lag `PublishWizard`-komponent med `PktStepper` | Medium | Punkt-react | ✅ |
| 7 | Lag `DraftsSummary` for steg 1 | Liten | #4 | ✅ |
| 8 | Lag staging-sync UI for steg 2 | Liten | #2 | ✅ |
| 9 | Lag `QAChecklist` for steg 3 | Liten | — | ✅ |
| 10 | Integrer eksisterende `POST /admin/api/publish` i steg 4 | Liten | Eksisterende API | ✅ |
| 11 | Lag "Nullstill endringer"-dialog | Liten | #3 | ✅ |
| 12 | Integrer `DraftsProvider` og `PublishActionBar` i `AdminApp.tsx` | Liten | #4, #5 | ✅ |
| 13 | Testing og QA | Medium | Alt over | |

---

## 8. Neste skritt

> Oppdateres fortløpende. Viser de 3-5 neste konkrete utviklingsoppgavene.

1. **Fiks: Tiltakskort laster ikke i staging** – `/config/content/tiltak/*.json` returnerer 404 i staging-miljøet. Må undersøke om innholdet mangler i GCS-bøtten eller om URL-mapping/routing er feil.
2. **Testing og QA** – Test hele wizard-flyten ende-til-ende i staging-miljøet.
3. **Eventuelt: Forbedre feilhåndtering** – Vurdere retry-logikk ved nettverksfeil.
4. **Eventuelt: Legge til publiseringslogg-visning** – Vise tidligere publiseringer i admin-UI.

---

## 9. Tekniske notater

- **Ingen GitHub-involvering:** Innholdsoppdateringer berører kun GCS-bøtter. Draft-filer lagres lokalt i staging-bøtten, og publish-jobben synker staging→prod via `gsutil rsync`.
- **Staging-URL:** `staging.energinøkkelen.no` (IP `34.111.174.210`). Redaktører som ikke har DNS-oppslag kan bruke direkte Cloud Run URL eller `/etc/hosts`-mapping.
- **Cloud Build-logging:** Publiseringsjobben logger til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json` med metadata:
  - `requestId` – unik ID for publiseringsforespørselen
  - `initiatedBy` – e-postadressen til redaktøren som trigget publiseringen
  - `items[]` – liste over publiserte elementer (`{id, collection}`)
  - `changeSummary` – redaktørens beskrivelse av endringene
  - `buildId` – Cloud Build-jobbens ID
  - `gitSha` – commit-hash (hvis tilgjengelig)
  - `triggeredAt` – tidspunkt for publisering
- **Rollback:** Begge content-bøttene har versjonering og soft delete aktivert. Ved feil etter prod-publisering:
  1. Bruk `gsutil ls -al gs://energinokkelen-content-prod/content/tiltak/<fil>.json` for å se objekthistorikk
  2. Gjenopprett via `gcloud storage objects restore` eller kopier tidligere versjon
  3. En fremtidig wizard-utvidelse kan eksponere rollback direkte i UI
- **Punkt-komponenter:** Wizarden bruker `PktStepper`, `PktStep`, `PktButton`, `PktCard`, `PktTag`, `PktAlert`, `PktCheckbox` fra `@oslokommune/punkt-react`.

---

## 10. Utviklingslogg

| Dato | Aktivitet | Referanse |
|------|-----------|-----------|
| 2025-11-26 | Implementert `PublishWizard` med `PktStepper`, `PktStep`, `PktModal`. Inkluderer `DraftsList`, `QAChecklist`, staging-sync UI og prod-publisering. Integrert i `AdminApp.tsx` | #6-#12 |
| 2025-11-26 | Implementert `PublishActionBar` med `PktCard`, `PktButton`, `PktTag`, integrert i `AdminApp.tsx` | #5 |
| 2025-11-26 | Implementert `DraftsProvider` context og API-funksjoner i `adminApiClient.ts` | #4 |
| 2025-11-26 | Implementert `DELETE /admin/api/drafts/discard-all` – sletter alle draft-filer | #3 |
| 2025-11-26 | Implementert `POST /admin/api/drafts/sync-staging` – kopierer draft-innhold til hovedfiler i staging | #2 |
| 2025-11-26 | Implementert `GET /admin/api/drafts` – ny `listFiles`-metode i `ContentStorage`, ny `draftsRouter.ts` | #1 |
| 2025-11-26 | Lagt til Status-kolonne i implementeringsplan, "Neste skritt"-seksjon, og dokumentert rutine for oppdatering | §7, §8 |
| 2025-11-26 | Utvidet med GCP-detaljer (servicekontoer, IAP, prosjekt-ID, rollback-prosedyre) fra driftshåndboken | `gcp-driftshandbok.md` |
| 2025-11-26 | Opprettet dette dokumentet, flyttet fra §11.7 i `innholdsdrift-tiltak.md` | Dette dokumentet |

---

## 11. Relatert dokumentasjon

- `Dokumentasjon/innholdsdrift-tiltak.md` – Hovedrutine for innholdsdrift og admin-UI
- `Dokumentasjon/gcp-driftshandbok.md` – GCP-konfig, Cloud Run, IAM, buckets
- `services/admin-api/` – Backend-kode for Admin-API
- `src/admin/` – Frontend-kode for Admin-UI
