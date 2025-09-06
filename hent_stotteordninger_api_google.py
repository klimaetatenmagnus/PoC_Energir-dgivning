import sys
import json
import io
from hent_stotteordninger_google import StotteordningFinner

# Sett UTF-8 encoding for stdout
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def main():
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python hent_stotteordninger_api.py <gulliste> <tiltak> <bygningstype>"}))
        sys.exit(1)
    
    gulliste = sys.argv[1].lower() == 'true'
    tiltak = sys.argv[2]
    bygningstype = sys.argv[3]
    
    try:
        finder = StotteordningFinner()  # Bruker Google Sheets, ikke Excel-fil
        resultater = finder.finn_stotteordninger(gulliste, tiltak, bygningstype)
        print(json.dumps(resultater, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()