import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios før vi importerer tjenesten
vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
    },
  };
});

import axios from 'axios';
import { sjekkGulListeMedGnrBnr } from '../../../src/services/gul-liste-service';

// Reell WFS-respons for Malerhaugveien-eiendommen (gnr 130, bnr 1, teigid 290209538).
// Inneholder to vernede enkeltminne-bygg (2J og 2A), én hensynssone (utomhus) og
// én kulturmiljø-lokalitet. Kun bygg-polygonene passerer MAPPING/KATEGORI-filteret.
const MALERHAUG_WFS_XML = `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection xmlns:ms="x" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs">
  <gml:featureMember>
    <ms:eiendom_polygon>
      <ms:msGeometry>
        <gml:Polygon><gml:exterior><gml:LinearRing>
          <gml:posList srsDimension="2">600242.76 6642845.39 600246.32 6642840.16 600251.82 6642843.91 600257.26 6642847.63 600253.70 6642852.85 600250.90 6642856.95 600248.10 6642861.06 600244.50 6642866.33 600238.92 6642862.49 600233.60 6642858.83 600237.17 6642853.60 600236.81 6642853.35 600239.59 6642849.24 600242.37 6642845.13 600242.76 6642845.39</gml:posList>
        </gml:LinearRing></gml:exterior></gml:Polygon>
      </ms:msGeometry>
      <ms:NAVN>Malerhaugen - Valle Øvre - Malerhaugveien 2J</ms:NAVN>
      <ms:TYPE>Enkeltminne</ms:TYPE>
      <ms:MAPPING>Regulert til bevaring</ms:MAPPING>
      <ms:KATEGORI>Enkeltminne bygning</ms:KATEGORI>
      <ms:VERN>Vernet etter PBL</ms:VERN>
    </ms:eiendom_polygon>
  </gml:featureMember>
  <gml:featureMember>
    <ms:eiendom_polygon>
      <ms:msGeometry>
        <gml:Polygon><gml:exterior><gml:LinearRing>
          <gml:posList srsDimension="2">600295.74 6642902.02 600291.66 6642899.16 600287.73 6642896.40 600291.81 6642890.54 600290.97 6642889.95 600293.71 6642886.04 600294.54 6642886.62 600298.34 6642881.15 600302.31 6642883.83 600306.28 6642886.53 600302.38 6642892.26 600303.82 6642893.24 600301.19 6642897.02 600299.84 6642895.99 600295.74 6642902.02</gml:posList>
        </gml:LinearRing></gml:exterior></gml:Polygon>
      </ms:msGeometry>
      <ms:NAVN>Fengsel/bolig - Malerhaugveien 2A</ms:NAVN>
      <ms:TYPE>Enkeltminne</ms:TYPE>
      <ms:MAPPING>Regulert til bevaring</ms:MAPPING>
      <ms:KATEGORI>Enkeltminne bygning</ms:KATEGORI>
      <ms:VERN>Vernet etter PBL</ms:VERN>
    </ms:eiendom_polygon>
  </gml:featureMember>
  <gml:featureMember>
    <ms:eiendom_polygon>
      <ms:msGeometry>
        <gml:Polygon><gml:exterior><gml:LinearRing>
          <gml:posList srsDimension="2">600222 6642794 600324 6642794 600324 6642909 600222 6642909 600222 6642794</gml:posList>
        </gml:LinearRing></gml:exterior></gml:Polygon>
      </ms:msGeometry>
      <ms:NAVN>Hensynssone</ms:NAVN>
      <ms:TYPE>Enkeltminne</ms:TYPE>
      <ms:MAPPING>Regulert til bevaring</ms:MAPPING>
      <ms:KATEGORI>Enkeltminne utomhus</ms:KATEGORI>
      <ms:VERN>Vernet etter PBL</ms:VERN>
    </ms:eiendom_polygon>
  </gml:featureMember>
  <gml:featureMember>
    <ms:eiendom_polygon>
      <ms:msGeometry>
        <gml:Polygon><gml:exterior><gml:LinearRing>
          <gml:posList srsDimension="2">600222 6642794 600324 6642794 600324 6642909 600222 6642909 600222 6642794</gml:posList>
        </gml:LinearRing></gml:exterior></gml:Polygon>
      </ms:msGeometry>
      <ms:NAVN>Malerhaugen gård - Valle Øvre</ms:NAVN>
      <ms:TYPE>Lokalitet</ms:TYPE>
      <ms:MAPPING>Annen type lokalitet</ms:MAPPING>
      <ms:KATEGORI>Bygningslokalitet</ms:KATEGORI>
      <ms:VERN>Vernet etter PBL</ms:VERN>
    </ms:eiendom_polygon>
  </gml:featureMember>
</wfs:FeatureCollection>`;

// WFS_SOK-respons for gnr 130, bnr 1 → teigid 290209538
const TEIGID_XML = `<?xml version='1.0' ?><wfs:FeatureCollection xmlns:ms="x" xmlns:wfs="http://www.opengis.net/wfs"><ms:ID>290209538</ms:ID></wfs:FeatureCollection>`;

beforeEach(() => {
  vi.clearAllMocks();
  const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };
  mockedAxios.get.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => {
    const params = config?.params ?? {};
    if (params.map === 'WFS_SOK') {
      return Promise.resolve({ data: TEIGID_XML });
    }
    if (params.map === 'EIENDOM_TABELL') {
      return Promise.resolve({ data: MALERHAUG_WFS_XML });
    }
    return Promise.reject(new Error(`Uventet URL/params: ${url}`));
  });
});

describe('sjekkGulListeMedGnrBnr med point-in-polygon', () => {
  it('Malerhaugveien 2V (utenfor alle bygg-polygoner) skal IKKE rapporteres som gul liste', async () => {
    const result = await sjekkGulListeMedGnrBnr(130, 1, {
      x: 600253.2,
      y: 6642876.5,
      epsg: 'EPSG:32632',
    });
    expect(result.erPaaGulListe).toBe(false);
  });

  it('Malerhaugveien 2A (innenfor 2A-polygon) skal rapporteres som gul liste', async () => {
    // Punkt midt i 2A-polygonen (bounds: 600287-600306, 6642881-6642902)
    const result = await sjekkGulListeMedGnrBnr(130, 1, {
      x: 600296,
      y: 6642891,
      epsg: 'EPSG:32632',
    });
    expect(result.erPaaGulListe).toBe(true);
    expect(result.navn).toContain('2A');
  });

  it('Malerhaugveien 2J (innenfor 2J-polygon) skal rapporteres som gul liste', async () => {
    // Punkt midt i 2J-polygonen (bounds: 600233-600257, 6642840-6642866)
    const result = await sjekkGulListeMedGnrBnr(130, 1, {
      x: 600245,
      y: 6642853,
      epsg: 'EPSG:32632',
    });
    expect(result.erPaaGulListe).toBe(true);
    expect(result.navn).toContain('2J');
  });

  it('uten koordinat (bakoverkompatibilitet) → markerer eiendommen som gul liste hvis noen bygg er vernet', async () => {
    const result = await sjekkGulListeMedGnrBnr(130, 1);
    expect(result.erPaaGulListe).toBe(true);
  });
});
