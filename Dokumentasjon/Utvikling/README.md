# Refaktorering mot Marvin

Denne katalogen samler underlag, beslutninger og logg som trengs for å gjøre kodebasen klar for Marvin-plattformen. Dokumentene brukes aktivt under refaktoreringsløpet og oppdateres når vi gjør nye avklaringer.

## Innhold
- `refaktor-oversikt.md` – hoveddokumentet med mål, krav, strategi og refaktorlogg. Oppdateres fortløpende.
- `refaktor-plan.rtf` – opprinnelig gap-analyse og tiltaksliste (arkiv, brukes som referanse).
- `*.docx` – støtteark for Marvin-plattformen:
  - Argo CD/ApplicationSet og deploy (`Deploy.docx`, `Hvordan konfigurere Argo CD Application.docx`, `Hvordan bruke Argo CD ApplicationSet.docx`).
  - GitOps og tilgang (`Tilgang fra ArgoCD.docx`, `Tilgangsstyring.docx`, `Bruke public Helm Charts.docx`).
  - Secrets og Key Vault (`Hvordan bruke secrets i applikasjonen.docx`, `Hvordan opprette Resource groups og Key Vaults.docx`, `Om Secrets.docx`).
  - Drift/sikkerhet (`Kontinuerlig Deployment.docx`, `Om nettverk.docx`, `Sjekkliste for å vurdere sikkerhetsnivå.docx`, `Tilgang fra ArgoCD.docx`).
  - Observability (`Om Grafana.docx`, `Om metrikker.docx`).
- Øvrige hjelpefiler (for eksempel kontaktpunkter og plattformsbeskrivelser) legges her slik at alt Marvin-relatert ligger ett sted.

## Arbeidsform
- Oppdater `refaktor-oversikt.md` før og etter større deloppgaver (f.eks. nye faser, beslutninger, testresultater).
- Hold docx-ressursene som referanse – de beskriver hvordan Argo CD, External Secrets, nettverk og observability skal fungere i Marvin.
- Når strategi eller mål endres, speil det både i `refaktor-oversikt.md` og her slik at andre raskt ser status.

## Konvertering av docx-vedlegg
Filene er lagret i Office-format for å kunne deles bredt. Ved behov for rask lesing fra terminal kan de konverteres on-the-fly, for eksempel:

```bash
textutil -convert txt -stdout "Dokumentasjon/Utvikling/Hvordan bruke secrets i applikasjonen.docx"
```

Bruk en kopi dersom du skal redigere innholdet; originalene fungerer som kildedokumentasjon i refaktoreringsarbeidet.
