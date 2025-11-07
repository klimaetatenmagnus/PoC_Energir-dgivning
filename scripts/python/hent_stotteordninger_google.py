import csv
from io import StringIO
from typing import List, Dict, Optional
import re
import ssl
import sys
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

try:
    import certifi
except ImportError:  # pragma: no cover - certifi er optional
    certifi = None

# KONFIGURASJON - Endre denne URL-en for å bruke et annet Google Sheets
# Kopier hele URL-en fra Google Sheets (inkludert /edit eller /view delen)
# Eksempel: "https://docs.google.com/spreadsheets/d/ABC123/edit?usp=sharing"
GOOGLE_SHEETS_URL = "https://docs.google.com/spreadsheets/d/1leRApSj2shrINHooseors2QjpZQO3ez08YuXzK3E0M8/edit?usp=sharing"

class StotteordningFinner:
    def __init__(self, excel_path: str = None):
        """
        Initialiserer Google Sheets-basert støtteordning-finder.
        excel_path parameter ignoreres siden vi bruker Google Sheets URL direkte.
        """
        # Ekstraher sheet ID fra URL
        self.sheet_id = self._extract_sheet_id(GOOGLE_SHEETS_URL)
        if not self.sheet_id:
            raise ValueError(f"Kunne ikke finne Google Sheets ID i URL: {GOOGLE_SHEETS_URL}")
        
        self.csv_url = f"https://docs.google.com/spreadsheets/d/{self.sheet_id}/export?format=csv"
        
        # Definer tiltak og deres kolonneposisjoner
        self.tiltak_kolonner = {
            "tetting": {"start": 5, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "solenergi": {"start": 8, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "etterisolering_fasade": {"start": 11, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "etterisolering_kjeller_loft": {"start": 14, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "varmepumpe": {"start": 17, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "ventilasjon": {"start": 20, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "vinduer": {"start": 23, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "smart_energistyring": {"start": 26, "bygningstyper": ["enebolig", "rekkehus", "blokk"]},
            "annen_oppvarming": {"start": 29, "bygningstyper": ["enebolig", "rekkehus", "blokk"]}
        }
        
        # Definer bygningstype kolonneindeks
        self.bygningstype_offset = {
            "enebolig": 0,
            "rekkehus": 1,
            "blokk": 2
        }
        
        # Last ned og parse data
        self._last_ned_data()
    
    def _extract_sheet_id(self, url: str) -> Optional[str]:
        """Ekstraherer Google Sheets ID fra en Google Sheets URL"""
        # Matcher både standard URLs og delte URLs
        patterns = [
            r'/spreadsheets/d/([a-zA-Z0-9-_]+)',
            r'/d/([a-zA-Z0-9-_]+)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        
        return None
        
    def _last_ned_data(self):
        """Laster ned og parser data fra Google Sheets"""
        try:
            csv_bytes = self._download_csv()
        except URLError as url_error:
            reason = getattr(url_error, "reason", None)
            reason_text = str(reason) if reason else ""
            error_text = str(url_error)
            if "CERTIFICATE_VERIFY_FAILED" in reason_text or "CERTIFICATE_VERIFY_FAILED" in error_text:
                print("Advarsel: SSL-sertifikat kunne ikke verifiseres – prøver uten verifisering (kun for lokal bruk).", file=sys.stderr)
                csv_bytes = self._download_csv(allow_insecure=True)
            else:
                raise Exception(f"Kunne ikke laste data fra Google Sheets: {url_error}") from url_error
        except HTTPError as http_error:
            raise Exception(f"Kunne ikke laste data fra Google Sheets: {http_error}") from http_error
        except Exception as e:
            raise Exception(f"Kunne ikke parse data fra Google Sheets: {e}") from e
        
        csv_text = csv_bytes.decode('utf-8')
        csv_reader = csv.reader(StringIO(csv_text))
        self.all_values = list(csv_reader)
        
        # Finn dynamisk start- og sluttrad basert på markørene
        self._finn_rad_grenser()

    def _download_csv(self, allow_insecure: bool = False) -> bytes:
        """Henter CSV fra Google Sheets, med valgfri SSL-verifisering"""
        request = Request(
            self.csv_url,
            headers={
                'User-Agent': 'Energinokkelen/1.0 (+https://energinokkelen.no)'
            }
        )

        if allow_insecure:
            context = ssl._create_unverified_context()
        else:
            context = ssl.create_default_context()
            if certifi:
                context.load_verify_locations(certifi.where())

        with urlopen(request, timeout=15, context=context) as response:
            return response.read()
    
    def _finn_rad_grenser(self):
        """Finner dynamisk rad-grenser basert på tekstene i sheets"""
        self.gulliste_marker_rad = None
        self.ikke_gulliste_marker_rad = None
        
        # Søk etter markørene (kolonne C er indeks 2)
        for i, row in enumerate(self.all_values):
            if len(row) > 2:
                celle_tekst = str(row[2]).strip()
                # Håndter både korrekt encoding og mulige encoding-problemer
                if celle_tekst in ["For bygg på gul liste", "For bygg p\xe5 gul liste", "For bygg p� gul liste"]:
                    self.gulliste_marker_rad = i + 1
                elif celle_tekst in ["For bygg som ikke er på gul liste", "For bygg som ikke er p\xe5 gul liste", "For bygg som ikke er p� gul liste"]:
                    self.ikke_gulliste_marker_rad = i + 1
        
        if self.gulliste_marker_rad and self.ikke_gulliste_marker_rad:
            # Sett grenser basert på markørenes posisjoner
            self.gulliste_start = self.gulliste_marker_rad + 2
            self.gulliste_slutt = self.ikke_gulliste_marker_rad - 1
            
            self.ikke_gulliste_start = self.ikke_gulliste_marker_rad + 2
            self.ikke_gulliste_slutt = len(self.all_values)
        else:
            # Fallback til standard verdier hvis markørene ikke finnes
            self.gulliste_start = 7
            self.gulliste_slutt = 50
            self.ikke_gulliste_start = 52
            self.ikke_gulliste_slutt = 80
    
    def finn_stotteordninger(self, gulliste: bool, tiltak: str, bygningstype: str) -> List[Dict[str, str]]:
        """
        Finner støtteordninger basert på gulliste-status, tiltak og bygningstype.
        
        Args:
            gulliste: True hvis bygget er på gul liste, False ellers
            tiltak: Type tiltak (f.eks. "solenergi", "tetting", "varmepumpe")
            bygningstype: Type bygg ("enebolig", "rekkehus" eller "blokk")
            
        Returns:
            Liste med dictionaries som inneholder ordningsnavn og lenke
        """
        resultater = []
        
        # Valider input
        if tiltak not in self.tiltak_kolonner:
            raise ValueError(f"Ukjent tiltak: {tiltak}. Gyldige tiltak: {list(self.tiltak_kolonner.keys())}")
        
        if bygningstype not in self.bygningstype_offset:
            raise ValueError(f"Ukjent bygningstype: {bygningstype}. Gyldige typer: {list(self.bygningstype_offset.keys())}")
        
        # Finn riktig kolonne (0-indeksert for Python)
        tiltak_info = self.tiltak_kolonner[tiltak]
        kolonne = tiltak_info["start"] + self.bygningstype_offset[bygningstype] - 1  # -1 for 0-indeksering
        
        # Bestem radområde basert på gulliste
        if gulliste:
            start_rad = self.gulliste_start
            slutt_rad = self.gulliste_slutt
        else:
            start_rad = self.ikke_gulliste_start
            slutt_rad = self.ikke_gulliste_slutt
        
        # Hold styr på gjeldende overskrift
        overskrifter = ["Klima- og energifondet", "Enova", "Byantikvaren", "Riksantikvaren", "Kulturminnefondet", "Klimaetaten"]
        gjeldende_overskrift = None
        
        # Gå gjennom rader og finn markerte celler
        for rad_idx in range(start_rad - 1, min(slutt_rad, len(self.all_values))):
            row = self.all_values[rad_idx]
            
            if len(row) <= kolonne:
                continue
                
            # Sjekk om denne raden har en overskrift
            if len(row) > 2 and row[2]:
                celle_verdi = str(row[2]).strip()
                
                # Sjekk om dette er en ren overskrift
                if celle_verdi in overskrifter:
                    gjeldende_overskrift = celle_verdi
                elif "| Enova" in celle_verdi:
                    # Dette er en Enova-støtteordning, ikke en overskriftsendring
                    pass
                elif "- Klimaetaten" in celle_verdi and gjeldende_overskrift != "Enova":
                    if gjeldende_overskrift != "Klima- og energifondet":
                        gjeldende_overskrift = "Klima- og energifondet"
            
            # Sjekk om cellen er markert
            if row[kolonne] and str(row[kolonne]).strip() not in ["", "None"]:
                # Finn ordningsnavn og beløp
                if len(row) > 2 and row[2]:
                    ordning_info = {
                        "ordning": str(row[2]),  # Kolonne C
                        "lenke": None,
                        "belop": str(row[3]) if len(row) > 3 and row[3] else None,  # Kolonne D
                        "rad": rad_idx + 1,
                        "overskrift": gjeldende_overskrift
                    }
                    
                    # Google Sheets CSV export inkluderer ikke hyperlinks
                    # Lenker må eventuelt lagres i egen kolonne eller hentes på annen måte
                    
                    resultater.append(ordning_info)
        
        return resultater
    
    def print_resultater(self, resultater: List[Dict[str, str]], gulliste: bool, tiltak: str, bygningstype: str):
        """Printer resultatene på en formatert måte"""
        print(f"\n{'='*80}")
        print(f"Støtteordninger for:")
        print(f"  - Gulliste: {'Ja' if gulliste else 'Nei'}")
        print(f"  - Tiltak: {tiltak}")
        print(f"  - Bygningstype: {bygningstype}")
        print(f"{'='*80}")
        
        if not resultater:
            print("Ingen støtteordninger funnet for denne kombinasjonen.")
        else:
            for i, ordning in enumerate(resultater, 1):
                print(f"\n{i}. {ordning['ordning']}")
                if ordning.get('overskrift'):
                    print(f"   Under: {ordning['overskrift']}")
                if ordning['belop']:
                    print(f"   Beløp/info: {ordning['belop']}")
                if ordning['lenke']:
                    print(f"   Lenke: {ordning['lenke']}")
                print(f"   (Fra rad {ordning['rad']})")


def main():
    # Opprett objekt
    finder = StotteordningFinner()
    
    # Test case 1: Gulliste=True, Solenergi, Rekkehus
    print("\n\nTEST CASE 1:")
    resultater1 = finder.finn_stotteordninger(
        gulliste=True,
        tiltak="solenergi",
        bygningstype="rekkehus"
    )
    finder.print_resultater(resultater1, True, "solenergi", "rekkehus")
    
    # Test case 2: Gulliste=False, Solenergi, Enebolig
    print("\n\nTEST CASE 2:")
    resultater2 = finder.finn_stotteordninger(
        gulliste=False,
        tiltak="solenergi",
        bygningstype="enebolig"
    )
    finder.print_resultater(resultater2, False, "solenergi", "enebolig")
    
    # Test case 3: Gulliste=True, Tetting, Blokk
    print("\n\nTEST CASE 3:")
    resultater3 = finder.finn_stotteordninger(
        gulliste=True,
        tiltak="tetting",
        bygningstype="blokk"
    )
    finder.print_resultater(resultater3, True, "tetting", "blokk")


if __name__ == "__main__":
    main()
