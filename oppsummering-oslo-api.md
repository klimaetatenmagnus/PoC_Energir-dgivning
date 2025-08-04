# Oppsummering: Oslo kommune kart API-er

## Funn fra undersøkelsen:

### 1. Oslo PBE WMS (https://od2.pbe.oslo.kommune.no/cgi-bin/wms)
- **Status**: ✅ Fungerer
- **Format**: MapServer WMS med `map=` parameter
- **Gul liste kart**: `map=GULLISTE`
- **Problem**: Ingen av lagene er queryable (kan ikke hente data via GetFeatureInfo)
- **Bruk**: Kun for visualisering/kartbilder

### 2. Tilgjengelige kart funnet:
- GULLISTE - Inneholder "Gul liste" lag for bevaringsverdige bygninger
- REGULERING - Reguleringsplaner med mange lag
- VANN, FJERNVARME, AADT, etc. - Andre infrastruktur-kart

### 3. API-status for kulturminner:
- **Riksantikvaren API** (https://kart.ra.no/): Server er nede (error 500)
- **Oslo kommune geodata**: Ikke tilgjengelig direkte API funnet
- **Geonorge WMS**: Ingen fungerende kulturminne-tjenester funnet

## Konklusjon:

Oslo kommune bruker WMS primært for kartvisning, ikke for datauthenting. For å sjekke om en bygning er på gul liste må man enten:

1. **Bruke visuell kartsjekk**: Laste WMS-bilde og se om bygningen er markert
2. **Finne alternativ datakilde**: F.eks. nedlastbare datasett fra Oslo kommune
3. **Bruke annen tjeneste**: Kanskje Byantikvaren har eget API

## Anbefaling for din applikasjon:

Siden API-ene ikke støtter direkte oppslag, kan du vurdere:
- Laste ned gul liste som statisk datasett (hvis tilgjengelig)
- Integrere med kartvisning for manuell sjekk
- Kontakte Oslo kommune for tilgang til deres interne API-er
- Sjekke om Byantikvaren har egne tjenester