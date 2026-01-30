# Cloud Armor – Oppsett og konfigurasjon

Opprettet: 2026-01-30
Status: **Arbeidsdokument** (oppdateres til ren dokumentasjon etter ferdigstilling)

> Når oppsettet er fullført:
> 1. Fjern arbeidssteg og sjekklister, behold kun konfigurasjon og driftsinfo
> 2. Oppdater `gcp-driftshandbok.md` seksjon 6 med sammendrag og lenke hit
> 3. Endre status øverst til "Ferdigstilt"

---

## 1. Bakgrunn

Cloud Armor-policy `energinokkelen-armor` ble opprettet i oktober 2025, men ble aldri aktivert på backend-tjenestene fordi første forsøk ga 403-feil for legitim trafikk. Sannsynlig årsak: default-regel satt til `deny` uten tilstrekkelige allow-regler.

Tjenesten er offentlig tilgjengelig via Global HTTPS Load Balancer (`staging-frontend-map`) med `allUsers`-tilgang på Cloud Run. Uten Cloud Armor har infrastrukturen ingen beskyttelse mot misbruk, rate-overbelastning eller vanlige webangrepsvektorer.

**Estimert kostnad:** ~USD 23/mnd + USD 0.10 per million forespørsler.

---

## 2. Backend-tjenester som skal beskyttes

| Backend-tjeneste | Type | Beskrivelse |
|---|---|---|
| `staging-api-backend` | Serverless NEG | Staging API (Cloud Run `energinokkelen`) |
| `prod-api-backend` | Serverless NEG | Prod API (Cloud Run `energinokkelen-prod`) |
| `staging-admin-backend` | Serverless NEG | Staging admin (Cloud Run `energinokkelen-admin`, allerede bak IAP) |
| `staging-frontend-bucket` | Backend bucket | Staging frontend (GCS) |
| `prod-frontend-bucket` | Backend bucket | Prod frontend (GCS) |

> **Merk:** Cloud Armor kan kobles til backend *services*, ikke backend *buckets* direkte. Frontend-bucketene beskyttes indirekte via CDN og har ingen dynamisk angrepsflate. Fokus bør være på API-backendene.

---

## 3. Regelsett

### 3.1 Oversikt

| Prioritet | Regel | Handling | Preview først? |
|---|---|---|---|
| 1000 | OWASP ModSecurity CRS – SQLi | deny(403) | Ja |
| 1001 | OWASP ModSecurity CRS – XSS | deny(403) | Ja |
| 1002 | OWASP ModSecurity CRS – LFI | deny(403) | Ja |
| 1003 | OWASP ModSecurity CRS – RFI | deny(403) | Ja |
| 1004 | OWASP ModSecurity CRS – Scanner detection | deny(403) | Ja |
| 1005 | OWASP ModSecurity CRS – Protocol attack | deny(403) | Ja |
| 2000 | Rate limiting – 60 req/min per IP | throttle | Ja |
| 2147483647 | Default rule | allow | Nei |

**Prinsipp:** Default allow, blokker kjente trusler. Alle blokkeringsregler starter i preview-modus.

### 3.2 OWASP-regler (preconfigured WAF)

Cloud Armor tilbyr preconfigured ModSecurity Core Rule Set. Vi aktiverer de mest relevante:

- `sqli-v33-stable` – SQL injection
- `xss-v33-stable` – Cross-site scripting
- `lfi-v33-stable` – Local file inclusion
- `rfi-v33-stable` – Remote file inclusion
- `scannerdetection-v33-stable` – Scanner/bot detection
- `protocolattack-v33-stable` – Protocol-level attacks (HTTP splitting etc.)

### 3.3 Rate limiting

60 forespørsler per minutt per klient-IP. Cloud Run har max 4 instanser, så dette beskytter mot kostnadsspiraler ved misbruk. Verdien kan justeres basert på reell trafikk etter monitorering.

---

## 4. Gjennomføring – steg for steg

Alle kommandoer kjøres med prosjekt `energiverktoy-poc-1234`. Sett først:

```bash
gcloud config set project energiverktoy-poc-1234
```

### Steg 1: Inspiser eksisterende policy

```bash
gcloud compute security-policies describe energinokkelen-armor --format=yaml
```

Sjekk:
- [x] Hva er default-regelens action? (Bør være `allow`) — Gammel policy hadde `allow` default, men uønsket regel på prioritet 1000. Slettet og opprettet ny.
- [x] Finnes det eksisterende regler som blokkerer? — Ja, gammel regel `allow true` på 1000. Policy ble slettet og opprettet på nytt.

Hvis policyen har uønsket konfigurasjon, slett og opprett på nytt:

```bash
gcloud compute security-policies delete energinokkelen-armor --quiet
```

### Steg 2: Opprett policy med default allow

```bash
gcloud compute security-policies create energinokkelen-armor \
  --description="WAF og rate limiting for Energinøkkelen" \
  --type=CLOUD_ARMOR
```

Default-regelen (prioritet 2147483647) er automatisk `allow`.

Verifiser:
```bash
gcloud compute security-policies rules describe 2147483647 \
  --security-policy=energinokkelen-armor
```

- [x] Bekreftet: default rule = allow ✓ (2026-01-30)

### Steg 3: Legg til OWASP WAF-regler (preview-modus)

```bash
# SQLi
gcloud compute security-policies rules create 1000 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('sqli-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP SQLi (preview)"

# XSS
gcloud compute security-policies rules create 1001 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('xss-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP XSS (preview)"

# LFI
gcloud compute security-policies rules create 1002 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('lfi-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP LFI (preview)"

# RFI
gcloud compute security-policies rules create 1003 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('rfi-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP RFI (preview)"

# Scanner detection
gcloud compute security-policies rules create 1004 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('scannerdetection-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP scanner detection (preview)"

# Protocol attack
gcloud compute security-policies rules create 1005 \
  --security-policy=energinokkelen-armor \
  --expression="evaluatePreconfiguredExpr('protocolattack-v33-stable')" \
  --action=deny-403 \
  --preview \
  --description="OWASP protocol attack (preview)"
```

- [x] Alle 6 regler opprettet i preview-modus ✓ (2026-01-30)

### Steg 4: Legg til rate limiting (preview-modus)

```bash
gcloud compute security-policies rules create 2000 \
  --security-policy=energinokkelen-armor \
  --src-ip-ranges="*" \
  --action=throttle \
  --rate-limit-threshold-count=60 \
  --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP \
  --preview \
  --description="Rate limit 60 req/min per IP (preview)"
```

- [x] Rate limiting-regel opprettet i preview-modus ✓ (2026-01-30)

### Steg 5: Koble policy til backend-tjenester

```bash
# Prod API (viktigst)
gcloud compute backend-services update prod-api-backend \
  --security-policy=energinokkelen-armor \
  --global

# Staging API
gcloud compute backend-services update staging-api-backend \
  --security-policy=energinokkelen-armor \
  --global

# Admin (allerede bak IAP, men ekstra lag)
gcloud compute backend-services update staging-admin-backend \
  --security-policy=energinokkelen-armor \
  --global
```

- [x] Policy koblet til `prod-api-backend` ✓ (2026-01-30)
- [x] Policy koblet til `staging-api-backend` ✓ (2026-01-30)
- [x] Policy koblet til `staging-admin-backend` ✓ (2026-01-30)

### Steg 6: Verifiser at tjenestene fortsatt fungerer

```bash
# Prod
curl -s -o /dev/null -w "%{http_code}" https://xn--energinkkelen-hnb.no/config/app.json

# Staging
curl -s -o /dev/null -w "%{http_code}" https://energinokkelen-168751968131.europe-north1.run.app/config/app.json
```

- [x] Prod returnerer 200 ✓ (2026-01-30)
- [x] Staging returnerer 200 ✓ (2026-01-30)

Kjør også smoke-tester:
```bash
npm run test:smoke -- --baseUrl=https://xn--energinkkelen-hnb.no
```

- [x] Smoke-tester passerer ✓ (2026-01-30, lokalt – prod/staging verifisert via curl)

### Steg 7: Monitoreringsperiode (1–2 uker)

Alle regler er i preview-modus. Overvåk hva som *ville* blitt blokkert:

```bash
# Se security policy-logger
gcloud logging read \
  'resource.type="http_load_balancer" AND jsonPayload.enforcedSecurityPolicy.name="energinokkelen-armor"' \
  --project=energiverktoy-poc-1234 \
  --freshness=7d \
  --limit=50 \
  --format=json
```

For preview-treff spesifikt:
```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND jsonPayload.previewSecurityPolicy.name="energinokkelen-armor"' \
  --project=energiverktoy-poc-1234 \
  --freshness=7d \
  --limit=50 \
  --format=json
```

Sjekk:
- [ ] Ingen falske positiver på legitim trafikk
- [ ] Preview-logger viser forventet oppførsel (blokkerer kun ondsinnet trafikk)
- [ ] Rate limiting treffer ikke normale brukere

### Steg 8: Aktiver regler (fjern preview)

Når monitoreringsperioden er gjennomført uten falske positiver:

```bash
# OWASP-regler
for PRIORITY in 1000 1001 1002 1003 1004 1005; do
  gcloud compute security-policies rules update $PRIORITY \
    --security-policy=energinokkelen-armor \
    --no-preview
done

# Rate limiting
gcloud compute security-policies rules update 2000 \
  --security-policy=energinokkelen-armor \
  --no-preview
```

- [ ] Alle regler aktivert (preview fjernet)
- [ ] Ny verifiseringsrunde: prod + staging returnerer 200
- [ ] Smoke-tester passerer

### Steg 9: Eksporter policy til repo

```bash
gcloud compute security-policies export energinokkelen-armor \
  --file-name=deploy/gcp/security-policy-armor.yaml \
  --file-format=yaml
```

- [ ] Policy eksportert og committet til repoet

### Steg 10: Oppdater dokumentasjon

- [ ] Oppdater `gcp-driftshandbok.md` seksjon 6 med sammendrag og lenke til dette dokumentet
- [ ] Endre status i dette dokumentet fra "Arbeidsdokument" til "Ferdigstilt"
- [ ] Fjern sjekklister og arbeidssteg, behold konfigurasjon og driftsinfo

---

## 5. Driftsrutiner

### Inspisere policy

```bash
gcloud compute security-policies describe energinokkelen-armor --format=yaml
gcloud compute security-policies rules list --security-policy=energinokkelen-armor
```

### Se blokkerte forespørsler

```bash
gcloud logging read \
  'resource.type="http_load_balancer" AND jsonPayload.enforcedSecurityPolicy.outcome="DENY"' \
  --project=energiverktoy-poc-1234 \
  --freshness=24h \
  --limit=20
```

### Nødprosedyre – deaktiver policy ved problemer

Hvis Cloud Armor blokkerer legitim trafikk i produksjon:

```bash
# Fjern policy fra prod umiddelbart
gcloud compute backend-services update prod-api-backend \
  --no-security-policy \
  --global
```

Feilsøk deretter i logger og re-attach når problemet er løst.

### Oppdatere regler

For å legge til en ny regel eller endre en eksisterende:

```bash
# Eksempel: oppdater rate limit til 100 req/min
gcloud compute security-policies rules update 2000 \
  --security-policy=energinokkelen-armor \
  --rate-limit-threshold-count=100

# Eksporter oppdatert policy til repo
gcloud compute security-policies export energinokkelen-armor \
  --file-name=deploy/gcp/security-policy-armor.yaml \
  --file-format=yaml
```

Commit endringen og noter i endringsloggen i `gcp-driftshandbok.md`.

---

## 6. Endringslogg

| Dato | Beskrivelse | Utført av |
|---|---|---|
| 2026-01-30 | Arbeidsdokument opprettet med regelsett og gjennomføringsplan | Claude |
| 2026-01-30 | Steg 1–6 gjennomført: policy gjenskapt med default allow, 6 OWASP-regler + rate limiting i preview-modus, koblet til 3 backend-tjenester, verifisert prod+staging 200 | Claude |
