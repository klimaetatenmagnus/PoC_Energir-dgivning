import json
import sys
from hent_stotteordninger import StotteordningFinner

# Konfigurasjon - endre filnavnet her
EXCEL_FILNAVN = "(2) Matrise_Energitiltak og relevante støtteordninger.xlsx"
# EXCEL_FILNAVN = "StøtteordningerTEST.xlsx"  # Test fil

def main():
    """Henter støtteordninger direkte fra Excel basert på parametre"""
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Mangler parametre: gulliste, tiltak, bygningstype"}))
        sys.exit(1)
    
    gulliste = sys.argv[1].lower() == 'true'
    tiltak = sys.argv[2]
    bygningstype = sys.argv[3]
    
    try:
        # Opprett instans og hent data direkte fra Excel
        henter = StotteordningFinner(EXCEL_FILNAVN)
        resultater = henter.finn_stotteordninger(gulliste, tiltak, bygningstype)
        
        # Konverter til JSON og print
        print(json.dumps(resultater, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()