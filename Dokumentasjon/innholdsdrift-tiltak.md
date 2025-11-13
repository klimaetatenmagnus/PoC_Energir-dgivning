# Driftsrutine for tiltak- og tilskuddsinnhold

Oppdatert: 2025-11-13 (Codex)

Dette dokumentet beskriver hvordan tiltak- og tilskuddsinnhold håndteres før admin-verktøyet er på plass. Rutinen dekker variant-/gul-liste-data, schema-validering, staging→prod-synk og auditlogging i GCS. Når admin-UI lanseres skal den følge samme prosess under panseret.

---

## 1. Roller og tilgang

- **Redaktører:** medlemmer av Google Workspace-gruppen `energinokkelredaktor@klimaoslo.no`. Gruppen gis tilgang til admin-UI, GCS og Cloud Run når disse settes opp.
- **Utviklere/opperativ drift:** ansvarlige for å holde skript og dokumentasjon oppdatert, samt bistå ved feil i schema eller integrasjon.
- **Servicekontoer:** `content-admin@energiverktoy-poc-1234.iam.gserviceaccount.com` utfører skriptoperasjoner i Cloud Build/Cloud Run. Kontoen må ha `roles/storage.objectAdmin` på begge content-bøtter.

---

## 2. Artefakter og begreper

| Element | Beskrivelse |
| --- | --- |
| `content/tiltak/*.json` | Ett dokument per tiltak. Må inneholde `audiences`, `metadata` og eventuelle `variants[]` for gul liste. |
| `content/tilskudd/*.json` | Ett dokument per støtteordning. Refereres fra tiltak via `grants`. |
| `TiltakContentSchema` / `TilskuddContentSchema` | Definerer påkrevde felter, variant- og metadata-struktur. Valideres av script og API. |
| **Staging-bøtte** | `gs://energinokkelen-content/content/` – brukes til daglige oppdateringer og QA. |
| **Prod-bøtte** | `gs://energinokkelen-content-prod/content/` – eksponeres av API-et i prod. |
| **Publiseringslogg** | JSON-filer i `gs://energinokkelen-content-prod/content/logs/` som beskriver hvem som promoterte innhold og når. |

---

## 3. Arbeidsflyt (kortversjon)

1. **Rediger lokalt** – oppdater tiltak/tilskudd i `content/`, sett `metadata.updatedBy`, `updatedAt` og fyll `changeSummary`.
2. **Valider schema** – `npm run content:validate`. Skriptet sikrer at alle filer (inkl. gul-listevarianter) følger gjeldende schema.
3. **Synk til staging** – `npm run content:publish -- push-staging` laster opp hele `content/`-mappen til staging-bøtten.
4. **QA i staging** – bruk staging-frontend/Admin (når tilgjengelig) + `curl https://.../config/content/<slug>.json?draft=1` for å se data, inkl. `audience=gulliste`-variantene.
5. **Oppdater metadata** – sett `metadata.status` til `published` når QA er godkjent. Drafts skal ha `status=draft`.
6. **Promoter til prod** – `npm run content:publish -- promote` kopierer staging-bøtten til prod og legger igjen en publiseringslogg i `content/logs/`.
7. **Verifiser prod** – kall prod-endepunktet `/config/content/<slug>.json` (uten `draft=1`). Sørg for at frontend plukker opp endringen.

---

## 4. Variant- og gul-listeretningslinjer

- `audiences` i hoveddokumentet må alltid inkludere `standard`. Legg til `gulliste` når tiltaket har egne tekster for vernede bygg.
- `variants[]` brukes til overrides. Hvert objekt må ha `audience`. Feltene du angir her erstatter verdiene fra basen. Felter du ikke spesifiserer arver standardinnholdet.
- `buildingTypeParagraphs` på hovednivå _og_ i varianter skal alltid ha `default` i tillegg til spesifikke byggtyper dersom du ønsker fallback-tekst. (Varianter kan droppe `default` dersom de kun overstyrer enkeltbygg; basen brukes da som fallback.)
- `grants` og `supportTags` kan settes per variant hvis støtteordninger/tags varierer mellom standard- og gul liste.
- Sett `metadata.reviewStatus` til `in-review` mens teksten kvalitetssikres, og `approved` når alt er godkjent. Dette feltet logges i publish-skriptet.

---

## 5. Skript og kommandoer

| Kommando | Når brukes den? | Effekt |
| --- | --- | --- |
| `npm run content:validate` | Etter hver endring i `content/` | Validerer alle tiltak- og tilskuddsfiler mot Zod-skjemaene. Feiler hvis noe mangler (inkl. variantfelter). |
| `npm run content:publish -- push-staging` | Når endringer skal testes i staging | Kjører `gsutil -m rsync -d -r content gs://energinokkelen-content/content`. Sletter objekter i staging som ikke finnes lokalt. |
| `npm run content:publish -- promote` | Når staging-versjonen er godkjent | Kjører `gsutil -m rsync` fra staging-bøtten til prod og skriver loggfil til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json`. |

> **Tips:** Legg ved `changeSummary` i hvert JSON-dokument. Det gjør det enklere å forstå publiseringsloggen i etterkant.

---

## 6. Kvalitetssikring før prod

1. Åpne staging-frontend (`https://energinokkelen-168751968131.europe-north1.run.app`) og naviger til tiltaket.
2. Test begge målgrupper ved å bruke gul-liste-rutene i UI eller ved å sette `audience`-parametere i komponenten.
3. Bekreft at `/config/content/tiltak/<slug>.json?draft=1` og `/config/content/tilskudd/<slug>.json?draft=1` returnerer forventet `metadata.status`.
4. Når alt er godkjent, kjør promote-skriptet og ta en kjapp smoke-test i prod (`https://energinøkkelen.no/config/content/...`).

---

## 7. Audit, logging og rollback

- **Publiseringslogg:** Hver `promote`-operasjon lager et JSON-objekt i `gs://energinokkelen-content-prod/content/logs/` med brukernavn, tidspunkt og `gitSha`. Loggen kan lastes ned med `gcloud storage cp`.
- **GCS object versioning:** Begge content-bøtter har versjonering aktivert. Bruk `gcloud storage objects list --versions` for å finne tidligere versjoner og `gcloud storage objects restore` for å rulle tilbake.
- **Metadata:** Feltene `metadata.updatedBy`, `updatedAt`, `changeSummary` og `reviewStatus` fungerer som audit per fil. API-et og admin-UI (senere) skal vise disse verdiene.

---

## 8. Veien videre mot admin-UI

Admin-verktøyet skal i praksis gjøre følgende på vegne av redaktøren:

1. Skrive JSON til staging-bøtten med samme struktur som beskrevet over.
2. Kjøre tilsvarende schema-validering (bruk `TiltakContentSchema` og `TilskuddContentSchema` fra `content/`).
3. La redaktøren forhåndsvise data i staging-miljøet (`draft=1`).
4. Trigge `promote`-flyten med logging når publisering godkjennes.

Til vi er der, brukes kommandoene over som “grunnsannhet” for hvordan pipeline fungerer.
