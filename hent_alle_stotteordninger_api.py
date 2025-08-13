import sys
import json
from hent_stotteordninger import StotteordningFinner

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python hent_alle_stotteordninger_api.py <bygningstype>"}))
        sys.exit(1)
    
    bygningstype = sys.argv[1]
    
    try:
        finder = StotteordningFinner("(2) Matrise_Energitiltak og relevante støtteordninger.xlsx")
        
        # Definer alle tiltak
        tiltak_liste = [
            'tetting', 
            'solenergi', 
            'etterisolering_fasade', 
            'etterisolering_kjeller_loft', 
            'varmepumpe', 
            'ventilasjon', 
            'vinduer', 
            'smart_energistyring'
        ]
        
        # Hent støtteordninger for alle tiltak
        resultater = {}
        
        for tiltak in tiltak_liste:
            # Hent både gul og normal liste
            resultater[tiltak] = {
                'normal': finder.finn_stotteordninger(False, tiltak, bygningstype),
                'gul': finder.finn_stotteordninger(True, tiltak, bygningstype)
            }
        
        print(json.dumps(resultater, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()