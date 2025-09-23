import json
import sys
import io
from hent_stotteordninger_google import StotteordningFinner

# Sett UTF-8 encoding for stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Konfigurasjon - Google Sheets brukes direkte i klassen
# Ingen filnavn nødvendig

def main():
    """Henter støtteordninger direkte fra Google Sheets basert på parametre"""
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Mangler parametre: gulliste, tiltak, bygningstype"}))
        sys.exit(1)
    
    gulliste = sys.argv[1].lower() == 'true'
    tiltak = sys.argv[2]
    bygningstype = sys.argv[3]
    
    try:
        # Opprett instans og hent data direkte fra Google Sheets
        henter = StotteordningFinner()  # Bruker Google Sheets
        resultater = henter.finn_stotteordninger(gulliste, tiltak, bygningstype)
        
        # Konverter til JSON og print
        print(json.dumps(resultater, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()