# Test Mode - For deling uten API-tilgang

## Hvordan bruke test-modus

### Quick Start
1. Start applikasjonen med `npm run dev`
2. Gå til Figma-modus (klikk på "Figma" knappen)
3. **Skriv et tall i adressefeltet:**
   - **"1"** = Lyseveien 3 (Enebolig)
   - **"2"** = Thereses gate 11A (Blokkleilighet)  
   - **"3"** = Thereses gate 44A (Bygård)
4. UIen vil automatisk laste med forhåndslagrede data

### Hva skjer i test-modus?
- Systemet bruker forhåndslagrede data for tre forskjellige bygningstyper
- Alle API-kall blir simulert med lokalt lagrede data
- Ingen eksterne API-er trengs - perfekt for demo og testing

### Inkluderte data
Test-modusen inkluderer fullstendige data for:
- ✅ Bygningsinformasjon (matrikkel, areal, byggeår, etc.)
- ✅ Energiattest (energikarakter E)
- ✅ Solenergi-data (takflater, produksjonspotensial)
- ✅ Estimater for solcellepaneler
- ✅ Støtteordninger og besparelser

### For deling med andre
Når du deler med kolleger som ikke har API-tilgang:
1. Start serveren: `npm run dev`
2. Del IP-adressen som vises (f.eks. `http://192.168.x.x:5173`)
3. Be dem:
   - Gå til Figma-modus
   - Skrive "1", "2" eller "3" i søkefeltet
   - De vil få opp full UI med test-data for valgt adresse

### Tekniske detaljer
- Test-data ligger i: 
  - `/src/testData/lyseveien3.ts` (Enebolig)
  - `/src/testData/theresegate11a.ts` (Blokkleilighet)
  - `/src/testData/theresegate44a.ts` (Bygård)
- Trigges i: `App.tsx` (handleFigmaInputChange)
- Solar-data håndteres i: `FigmaMainScript.tsx`

### Test-adresser og deres egenskaper

#### 1. Lyseveien 3 (Enebolig)
- Bygningstype: Enebolig (111)
- Solenergi: Godt egnet
- Energikarakter: E
- Perfekt for å demonstrere enebolig-animasjon

#### 2. Thereses gate 11A (Blokkleilighet)
- Bygningstype: Blokkleilighet (143)
- Solenergi: Middels egnet
- Energikarakter: F
- Bevaringsverdig bygning
- Demonstrerer delt tak/fellesløsninger

#### 3. Thereses gate 44A (Bygård)
- Bygningstype: Bygård (142)
- Solenergi: Mindre egnet
- Energikarakter: G
- Gul liste / verneverdig
- Fjernvarme tilkoblet
- Demonstrerer komplekse tak og vernehensyn

### Utvide test-modus
For å legge til flere test-adresser:
1. Kopier strukturen i `lyseveien3.ts`
2. Legg til ny trigger i `App.tsx` (f.eks. "2" for en annen adresse)
3. Oppdater solar-data sjekken i `FigmaBlokk_temp.tsx`