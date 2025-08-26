from hent_stotteordninger import StotteordningFinner
import json
from datetime import datetime

def kjor_og_lagre_tester_med_debug():
    # Opprett finder-objekt
    finder = StotteordningFinner("(2) Matrise_Energitiltak og relevante støtteordninger.xlsx")
    
    # Definer test-kombinasjoner
    test_kombinasjoner = [
        {
            "gulliste": True,
            "tiltak": "varmepumpe",
            "bygningstype": "enebolig",
            "beskrivelse": "Gulliste + Varmepumpe + Enebolig"
        },
        {
            "gulliste": False,
            "tiltak": "vinduer",
            "bygningstype": "blokk",
            "beskrivelse": "Ikke-gulliste + Vinduer + Blokk"
        },
        {
            "gulliste": True,
            "tiltak": "etterisolering_fasade",
            "bygningstype": "rekkehus",
            "beskrivelse": "Gulliste + Etterisolering fasade + Rekkehus"
        },
        {
            "gulliste": False,
            "tiltak": "ventilasjon",
            "bygningstype": "enebolig",
            "beskrivelse": "Ikke-gulliste + Ventilasjon + Enebolig"
        },
        {
            "gulliste": True,
            "tiltak": "smart_energistyring",
            "bygningstype": "blokk",
            "beskrivelse": "Gulliste + Smart energistyring + Blokk"
        },
        {
            "gulliste": True,
            "tiltak": "solenergi",
            "bygningstype": "rekkehus",
            "beskrivelse": "Gulliste + Solenergi + Rekkehus"
        },
        {
            "gulliste": False,
            "tiltak": "solenergi",
            "bygningstype": "enebolig",
            "beskrivelse": "Ikke-gulliste + Solenergi + Enebolig"
        },
        {
            "gulliste": True,
            "tiltak": "tetting",
            "bygningstype": "blokk",
            "beskrivelse": "Gulliste + Tetting + Blokk"
        },
        {
            "gulliste": True,
            "tiltak": "solenergi",
            "bygningstype": "blokk",
            "beskrivelse": "Gulliste + Solenergi + Blokk (test for 7 X-er)"
        }
    ]
    
    # Lagre alle resultater
    alle_resultater = {
        "testkjøring_dato": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "antall_tester": len(test_kombinasjoner),
        "tester": []
    }
    
    # Kjør testene
    for i, test in enumerate(test_kombinasjoner, 1):
        print(f"\n{'='*80}")
        print(f"TEST {i}: {test['beskrivelse']}")
        print(f"{'='*80}")
        
        try:
            # Beregn hvilken kolonne som sjekkes
            tiltak_info = finder.tiltak_kolonner[test["tiltak"]]
            kolonne = tiltak_info["start"] + finder.bygningstype_offset[test["bygningstype"]]
            
            print(f"Tiltak '{test['tiltak']}' starter på kolonne {tiltak_info['start']}")
            print(f"Bygningstype '{test['bygningstype']}' har offset {finder.bygningstype_offset[test['bygningstype']]}")
            print(f"SJEKKER KOLONNE: {kolonne}")
            
            # Vis radområde
            if test["gulliste"]:
                print(f"Radområde: {finder.gulliste_start} - {finder.gulliste_slutt} (gulliste)")
            else:
                print(f"Radområde: {finder.ikke_gulliste_start} - {finder.ikke_gulliste_slutt} (ikke-gulliste)")
            
            resultater = finder.finn_stotteordninger(
                gulliste=test["gulliste"],
                tiltak=test["tiltak"],
                bygningstype=test["bygningstype"]
            )
            
            test_resultat = {
                "test_nummer": i,
                "beskrivelse": test["beskrivelse"],
                "input": {
                    "gulliste": test["gulliste"],
                    "tiltak": test["tiltak"],
                    "bygningstype": test["bygningstype"]
                },
                "kolonne_sjekket": kolonne,
                "radområde": f"{finder.gulliste_start}-{finder.gulliste_slutt}" if test["gulliste"] else f"{finder.ikke_gulliste_start}-{finder.ikke_gulliste_slutt}",
                "antall_ordninger": len(resultater),
                "ordninger": resultater
            }
            
            alle_resultater["tester"].append(test_resultat)
            print(f"\n[OK] Fant {len(resultater)} støtteordninger")
            
            # Vis de første ordningene
            if resultater:
                print("Ordninger funnet:")
                for j, ordning in enumerate(resultater[:3], 1):
                    overskrift_text = f" - Under: {ordning.get('overskrift')}" if ordning.get('overskrift') else ""
                    print(f"  {j}. {ordning['ordning']} (rad {ordning['rad']}){overskrift_text}")
                if len(resultater) > 3:
                    print(f"  ... og {len(resultater) - 3} til")
            
        except Exception as e:
            print(f"[FEIL] {str(e)}")
            alle_resultater["tester"].append({
                "test_nummer": i,
                "beskrivelse": test["beskrivelse"],
                "feil": str(e)
            })
    
    # Lagre til JSON-fil
    with open("test_resultater_med_kolonne_info.json", "w", encoding="utf-8") as f:
        json.dump(alle_resultater, f, ensure_ascii=False, indent=2)
    
    print(f"\n\n{'='*80}")
    print("RESULTATER LAGRET!")
    print(f"{'='*80}")
    print(f"Fil: test_resultater_med_kolonne_info.json")
    print(f"Totalt antall tester: {len(test_kombinasjoner)}")
    print(f"Vellykkede tester: {len([t for t in alle_resultater['tester'] if 'ordninger' in t])}")
    
    # Vis oppsummering av kolonner sjekket
    print("\nKOLONNER SJEKKET:")
    for test in alle_resultater["tester"]:
        if "kolonne_sjekket" in test:
            print(f"  {test['beskrivelse']}: Kolonne {test['kolonne_sjekket']}")

if __name__ == "__main__":
    kjor_og_lagre_tester_med_debug()