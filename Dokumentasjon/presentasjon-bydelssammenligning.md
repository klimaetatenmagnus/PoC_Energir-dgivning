# Energinøkkelen: Bydelssammenligning av energieffektivitet

> **Presentasjon av muligheter basert på Enova bulk-data**
> Dato: 22. januar 2026

---

## 1. Datakildene vi har tilgang til

### Enova Bulk API (nytt funn!)

| Data | Kilde | Oppdatering |
|------|-------|-------------|
| **34,199 energimerker** for Oslo (2024) | Enova API v1/v2 | Månedlig |
| Postnummer per bolig | Inkludert i CSV | - |
| Energikarakter (A-G) | Inkludert i CSV | - |
| kWh/m² beregnet | Inkludert i CSV | - |
| Bygningskategori | Inkludert i CSV | - |
| Byggeår | Inkludert i CSV | - |

### Eksisterende datakilder

| Data | Kilde |
|------|-------|
| Bydel/delbydel per bygning | Matrikkel 2023 CSV |
| Postnummer → bydel mapping | Kan bygges fra data |
| Boligtype-kategorier | ArcGIS Oslo kommune |

---

## 2. Hva kan vi vise brukerne?

### 2.1 Sammenligning mot bydel

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Din bolig sammenlignet med Nordre Aker                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Din blokkleilighet bruker:     145 kWh/m²/år                  │
│  Snitt for blokk i Nordre Aker: 168 kWh/m²/år                  │
│                                                                 │
│  ✅ Du bruker 14% mindre energi enn gjennomsnittet!            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │      │
│  │ Din bolig                              Bydelssnitt   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Energikarakter-fordeling i bydelen

```
┌─────────────────────────────────────────────────────────────────┐
│  🏠 Energikarakter-fordeling for blokkleiligheter i Frogner    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  A  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░  3%                         │
│  B  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  8%                         │
│  C  ██████████░░░░░░░░░░░░░░░░░░░░  18%                        │
│  D  ████████████████░░░░░░░░░░░░░░  28%  ← Din bolig (D)       │
│  E  ██████████████░░░░░░░░░░░░░░░░  24%                        │
│  F  ████████░░░░░░░░░░░░░░░░░░░░░░  14%                        │
│  G  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░  5%                         │
│                                                                 │
│  📍 Din bolig ligger på medianen for bydelen                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Besparelsespotensial relativt til bydel

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 Ditt forbedringspotensial                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hvis du oppgraderer til energikarakter B:                     │
│                                                                 │
│  • Du vil bruke 95 kWh/m²/år (ned fra 168)                     │
│  • Det er 43% bedre enn bydelssnitt                            │
│  • Du vil være blant topp 11% i Frogner                        │
│                                                                 │
│  ┌─────────────────────────────────────────────┐               │
│  │   Nå        Mål         Beste i bydelen    │               │
│  │    D    →    B              A              │               │
│  │  168 kWh   95 kWh         65 kWh           │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Geografiske sammenligningsnivåer

### Tre nivåer av sammenligning

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────────┐                                               │
│   │    OSLO     │  Nivå 1: Hele byen                           │
│   │  353,256    │  "Sammenlignet med Oslo generelt"            │
│   │   boliger   │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│   ┌──────▼──────┐                                               │
│   │   BYDEL     │  Nivå 2: Bydel (15 bydeler)                  │
│   │  ~23,500    │  "Sammenlignet med Nordre Aker"              │
│   │   boliger   │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│   ┌──────▼──────┐                                               │
│   │  DELBYDEL   │  Nivå 3: Delbydel (94 delbydeler)            │
│   │  ~3,750     │  "Sammenlignet med Tåsen"                    │
│   │   boliger   │                                               │
│   └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Postnummer → Bydel mapping

Vi kan bygge en mapping-tabell basert på Matrikkel-dataene:

| Postnummer | Poststed | Bydel | Delbydel |
|------------|----------|-------|----------|
| 0271 | Oslo | Frogner | Frogner |
| 0585 | Oslo | Bjerke | Veitvet |
| 0661 | Oslo | Gamle Oslo | Ensjø |
| 0491 | Oslo | Nordre Aker | Tåsen |
| ... | ... | ... | ... |

---

## 4. Mulige sammenligningsmetrikker

### 4.1 Primære metrikker

| Metrikk | Beskrivelse | Visning |
|---------|-------------|---------|
| **kWh/m²/år** | Energiforbruk per kvadratmeter | Tall + stolpediagram |
| **Energikarakter** | A-G skala | Bokstav + posisjon i fordeling |
| **Percentil** | Hvor du ligger i bydelen | "Topp 20%" |

### 4.2 Kontekstuelle metrikker

| Metrikk | Beskrivelse |
|---------|-------------|
| **Byggeår-justert** | Sammenlign med boliger fra samme periode |
| **Størrelse-justert** | Sammenlign med boliger av lignende størrelse |
| **Oppvarmingstype** | Sammenlign basert på oppvarmingskarakter |

---

## 5. Eksempel på brukerreise

### Steg 1: Bruker slår opp adresse

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Kapellveien 156C, 0493 Oslo                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Boligtype:     Tomannsbolig (Småhus)                          │
│  Bydel:         Nordre Aker                                     │
│  Delbydel:      Tåsen                                           │
│  Byggeår:       2013                                            │
│  Bruksareal:    159 m²                                          │
│                                                                 │
│  Energimerke:   C (fra Enova)                                  │
│  Forbruk:       123 kWh/m²/år                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Steg 2: System beregner sammenligning

```
Henter statistikk for:
├── Boligtype: Småhus
├── Bydel: Nordre Aker
├── Postnummer: 0493
└── Byggeår-gruppe: 2010-2020 (TEK10)

Resultat fra 847 lignende boliger:
├── Snitt kWh/m²: 142
├── Median karakter: D
└── Standardavvik: 34
```

### Steg 3: Visning til bruker

```
┌─────────────────────────────────────────────────────────────────┐
│  🏆 Gratulerer! Din bolig er mer energieffektiv enn            │
│     gjennomsnittet for småhus i Nordre Aker!                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     BEDRE ◄──────────────────────────────► DÅRLIGERE    │   │
│  │                                                         │   │
│  │  A    B    C    D    E    F    G                       │   │
│  │            ▲                                           │   │
│  │         DIN BOLIG                                      │   │
│  │            │                                           │   │
│  │            └── 13% bedre enn bydelssnitt               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 Statistikk for småhus i Nordre Aker:                       │
│                                                                 │
│  • 847 boliger i sammenligningsgruppen                         │
│  • Gjennomsnitt: 142 kWh/m²/år                                 │
│  • Din bolig: 123 kWh/m²/år                                    │
│  • Du er blant de 35% mest energieffektive                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Dataflyt og arkitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │  Enova API   │     │  Matrikkel   │     │   ArcGIS     │   │
│  │  Bulk CSV    │     │    CSV       │     │    Oslo      │   │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘   │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │              STATISTIKK-DATABASE                       │   │
│  │                                                        │   │
│  │  • Aggregert per bydel/delbydel/postnummer            │   │
│  │  • Fordelt på boligtype og byggeår                    │   │
│  │  • Oppdateres månedlig fra Enova                      │   │
│  │                                                        │   │
│  └────────────────────────────┬───────────────────────────┘   │
│                               │                               │
│                               ▼                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │                    ENERGINØKKELEN                      │   │
│  │                                                        │   │
│  │  Bruker slår opp adresse                              │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Hent boligdata + energimerke                         │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Slå opp statistikk for bydel/type                    │   │
│  │         │                                              │   │
│  │         ▼                                              │   │
│  │  Vis sammenligning til bruker                         │   │
│  │                                                        │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Foreslåtte visninger i UI

### 7.1 Kompakt badge-visning (alltid synlig)

```
┌──────────────────────────────────────────┐
│  📊 13% bedre enn snitt i Nordre Aker   │
└──────────────────────────────────────────┘
```

### 7.2 Utvidet sammenligning (klikk for detaljer)

```
┌─────────────────────────────────────────────────────────────────┐
│  Energisammenligning for din bolig                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │   Din       │  Nordre     │   Oslo      │  Norge      │     │
│  │   bolig     │  Aker       │   snitt     │  snitt      │     │
│  ├─────────────┼─────────────┼─────────────┼─────────────┤     │
│  │   123       │   142       │   156       │   152       │     │
│  │  kWh/m²     │  kWh/m²     │  kWh/m²     │  kWh/m²     │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                 │
│  Din bolig er:                                                  │
│  • 13% bedre enn bydelssnitt                                   │
│  • 21% bedre enn Oslo-snitt                                    │
│  • Blant topp 35% i din bydel                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Motiverende meldinger basert på posisjon

| Percentil | Melding |
|-----------|---------|
| Topp 10% | "🏆 Imponerende! Du er blant de mest energieffektive i {bydel}!" |
| Topp 25% | "⭐ Bra jobbet! Din bolig er godt over gjennomsnittet i {bydel}" |
| 25-50% | "👍 Din bolig er bedre enn gjennomsnittet i {bydel}" |
| 50-75% | "💡 Det finnes gode muligheter for å forbedre energieffektiviteten" |
| Under 75% | "🔧 Med noen tiltak kan du spare betydelig på energiregningen" |

---

## 8. Datakvalitet og begrensninger

### Styrker

✅ **34,199 datapunkter** for Oslo i 2024 alene
✅ Offisielle Enova-data med energikarakter
✅ Postnummer muliggjør geografisk gruppering
✅ Månedlig oppdatering tilgjengelig
✅ Historiske data tilbake til 2010

### Begrensninger å kommunisere

⚠️ Kun boliger med registrert energiattest er inkludert
⚠️ Kan være skjevhet mot nyere/renoverte boliger
⚠️ Statistikken er basert på beregnet forbruk, ikke faktisk

### Foreslått disclaimer

```
"Sammenligningen er basert på {N} boliger med energiattest
i {bydel}. Tallene viser beregnet energiforbruk og kan
avvike fra faktisk forbruk."
```

---

## 9. Implementasjonsplan

### Fase 1: Datainnhenting (1-2 uker)
- [ ] Script for å laste ned Enova bulk-data
- [ ] Bygge postnummer → bydel mapping
- [ ] Opprette statistikk-database/JSON

### Fase 2: Backend-integrasjon (1 uke)
- [ ] API-endepunkt for bydelsstatistikk
- [ ] Caching av statistikk
- [ ] Månedlig oppdateringsrutine

### Fase 3: Frontend-visning (1-2 uker)
- [ ] Kompakt badge-komponent
- [ ] Utvidet sammenligningsvisning
- [ ] Integrasjon i eksisterende UI

---

## 10. Konklusjon

### Vi kan tilby brukerne:

1. **"Din bolig bruker X% mindre/mer energi enn snitt i {bydel}"**
2. **"Du er blant topp Y% mest energieffektive i {bydel}"**
3. **Visuell fordeling av energikarakterer i bydelen**
4. **Motiverende meldinger basert på posisjon**

### Nøkkeltall for Oslo

| Metrikk | Verdi |
|---------|-------|
| Energiattester 2024 | 34,199 |
| Bydeler | 15 |
| Delbydeler | 94 |
| Boligkategorier | 4-6 |

### Alt dette er mulig med eksisterende API-tilgang! ✅

---

*Dokumentet er basert på utforskning av Enova API-portal 22. januar 2026*
