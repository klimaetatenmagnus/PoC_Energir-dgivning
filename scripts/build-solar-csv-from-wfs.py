#!/usr/bin/env python3
"""Bygg data/raw/solar_tak_wfs.csv fra PBE sin live WFS.

Paginerer gjennom `takflater2024`-laget i
`https://od2.pbe.oslo.kommune.no/cgi-bin/wms` og skriver én rad per takflate
med feltene vi trenger for solberegning:

    bygningsnummer, tak_id, area_m2, irr_kwh_m2_yr, homogen_m2, flatt_tak

Parallelle workers gir akseptabel kjøretid (~2-3 min for ~635k takflater).
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urlencode
from xml.etree import ElementTree as ET

import urllib.request

WFS_URL = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms"
MAP_FILE = "d:/data_mapserver/kartfiler/solkart.map"
LAYER = "takflater2024"
PAGE_SIZE = 1000  # MapServer DefaultMaxFeatures
NS = {
    "wfs": "http://www.opengis.net/wfs",
    "gml": "http://www.opengis.net/gml",
    "ms": "http://mapserver.gis.umn.edu/mapserver",
}

OUT = Path(__file__).resolve().parents[1] / "data" / "raw" / "solar_tak_wfs.csv"
COLUMNS = [
    "bygningsnummer",
    "tak_id",
    "area_m2",
    "irr_kwh_m2_yr",
    "homogen_m2",
    "flatt_tak",
]

PROPERTYNAMES = ",".join(
    ["TAK_ID", "BYGGNR", "AREA", "SUM_AAR_KWH", "HOMOGEN_KVM", "FLATT_TAK"]
)


def fetch_page(start_index: int, attempt: int = 0) -> list[dict]:
    params = {
        "map": MAP_FILE,
        "SERVICE": "WFS",
        "VERSION": "1.1.0",
        "REQUEST": "GetFeature",
        "TYPENAME": LAYER,
        "MAXFEATURES": str(PAGE_SIZE),
        "STARTINDEX": str(start_index),
        "PROPERTYNAME": PROPERTYNAMES,
    }
    url = f"{WFS_URL}?{urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "energinokkelen-solar-ingest"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
    except Exception as err:
        if attempt < 3:
            time.sleep(2 ** attempt)
            return fetch_page(start_index, attempt + 1)
        raise RuntimeError(f"fetch_page({start_index}) feilet etter 3 forsøk: {err}")

    root = ET.fromstring(body)
    rows: list[dict] = []
    for fm in root.findall("gml:featureMember", NS):
        feat = fm.find("ms:takflater2024", NS)
        if feat is None:
            continue

        def txt(tag: str) -> str | None:
            el = feat.find(f"ms:{tag}", NS)
            return el.text.strip() if el is not None and el.text is not None else None

        byggnr = txt("BYGGNR")
        if not byggnr:
            continue  # dropp takflater uten byggnr (kan ikke lookup-es per bygg)
        try:
            byggnr_int = int(byggnr)
        except ValueError:
            continue

        tak_id_s = txt("TAK_ID")
        area_s = txt("AREA")
        irr_s = txt("SUM_AAR_KWH")
        hom_s = txt("HOMOGEN_KVM")
        flatt = txt("FLATT_TAK")

        def to_float(s: str | None) -> float | None:
            if s is None or s == "":
                return None
            # Norsk desimal-komma fra MapServer
            return float(s.replace(",", "."))

        rows.append(
            {
                "bygningsnummer": byggnr_int,
                "tak_id": int(tak_id_s) if tak_id_s else None,
                "area_m2": to_float(area_s),
                "irr_kwh_m2_yr": to_float(irr_s),
                "homogen_m2": to_float(hom_s),
                "flatt_tak": flatt or "",
            }
        )
    return rows


def find_total_count(upper_bound: int = 700_000) -> int:
    """Binary-search etter total antall features siden MapServer rapporterer
    feil tall i RESULTTYPE=hits (cap på 1000)."""
    # Vi vet fra smoke-test at det er mellom 630k og 640k. Gjør likevel en
    # robust binary search for forsikring.
    lo, hi = 0, upper_bound
    while lo < hi:
        mid = (lo + hi + 1) // 2
        rows = fetch_page(mid)
        if rows:
            lo = mid
        else:
            hi = mid - 1
    # lo er høyeste startindex som ga data; total count = lo + antall i siste side
    last_page = fetch_page(lo)
    # Siden PAGE_SIZE=1000, kan siste side være mindre. Men startindex=lo
    # returnerte >=1 feature, og lo+1 returnerte 0 (fra binary search).
    # Faktisk total = lo + len(last_page), men bare hvis vi sjekker grensen.
    # Forenkler: total = lo + len(last_page)
    return lo + len(last_page)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workers", type=int, default=6, help="parallelle paginerings-workers"
    )
    parser.add_argument(
        "--total",
        type=int,
        default=0,
        help="overstyr total antall features (ellers autodetektert)",
    )
    args = parser.parse_args()

    if args.total > 0:
        total = args.total
    else:
        print("[wfs] finner total antall features ...", file=sys.stderr)
        total = find_total_count()
    print(f"[wfs] estimert total: {total} features", file=sys.stderr)

    page_starts = list(range(0, total + PAGE_SIZE, PAGE_SIZE))
    print(
        f"[wfs] paginerer i {len(page_starts)} kall à {PAGE_SIZE} features, {args.workers} workers",
        file=sys.stderr,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    total_written = 0
    total_dropped_no_byggnr = 0

    with OUT.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS)
        writer.writeheader()

        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {
                ex.submit(fetch_page, start): start for start in page_starts
            }
            completed = 0
            for fut in as_completed(futures):
                start = futures[fut]
                try:
                    rows = fut.result()
                except Exception as err:
                    print(
                        f"[wfs] WARN: startindex={start} feilet: {err}",
                        file=sys.stderr,
                    )
                    continue
                for r in rows:
                    writer.writerow(r)
                    total_written += 1
                completed += 1
                if completed % 20 == 0:
                    elapsed = time.time() - t0
                    pct = 100 * completed / len(page_starts)
                    eta = (elapsed / completed) * (len(page_starts) - completed)
                    print(
                        f"[wfs] {completed}/{len(page_starts)} sider ({pct:.0f}%), "
                        f"{total_written} rader, elapsed {elapsed:.0f}s, eta {eta:.0f}s",
                        file=sys.stderr,
                    )

    size_mb = OUT.stat().st_size / (1024 * 1024)
    elapsed = time.time() - t0
    print(
        f"[wfs] ferdig: {total_written} takflater → {OUT.name} ({size_mb:.1f} MB) "
        f"på {elapsed:.0f}s",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
