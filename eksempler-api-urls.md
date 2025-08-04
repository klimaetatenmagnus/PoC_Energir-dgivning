# Eksempler på typiske API URLs for kartdata

## WMS GetFeatureInfo (spørring på punkt):
```
https://example.com/wms?
  SERVICE=WMS&
  VERSION=1.3.0&
  REQUEST=GetFeatureInfo&
  LAYERS=gul_liste&
  QUERY_LAYERS=gul_liste&
  CRS=EPSG:4326&
  BBOX=10.7,59.9,10.8,60.0&
  WIDTH=100&
  HEIGHT=100&
  I=50&
  J=50&
  INFO_FORMAT=application/json
```

## WFS GetFeature (hente features i område):
```
https://example.com/wfs?
  SERVICE=WFS&
  VERSION=2.0.0&
  REQUEST=GetFeature&
  TYPENAMES=kulturminner:gul_liste&
  BBOX=10.7,59.9,10.8,60.0&
  OUTPUTFORMAT=application/json
```

## REST API (moderne stil):
```
https://api.example.com/v1/kulturminner/gul-liste?
  lat=59.9139&
  lon=10.7522&
  radius=100

eller:

https://api.example.com/v1/buildings/12345/conservation-status
```

## ArcGIS REST Services:
```
https://example.com/arcgis/rest/services/Kulturminner/MapServer/0/query?
  geometry=10.7522,59.9139&
  geometryType=esriGeometryPoint&
  inSR=4326&
  spatialRel=esriSpatialRelIntersects&
  returnGeometry=false&
  f=json
```

## Tile/Vector services:
```
https://example.com/tiles/kulturminner/{z}/{x}/{y}.pbf
https://example.com/vectortiles/v1/gul-liste/{z}/{x}/{y}.json
```

## Feature API (OGC API - Features):
```
https://api.example.com/collections/gul-liste/items?
  bbox=10.7,59.9,10.8,60.0&
  limit=10
```

## Typiske parametre å se etter:
- **SERVICE/REQUEST**: WMS, WFS, GetFeatureInfo, GetFeature
- **LAYERS/TYPENAMES**: gul_liste, kulturminner, bevaringsverdig
- **BBOX/GEOMETRY**: koordinater eller områder
- **FORMAT**: json, geojson, xml, gml
- **CRS/SRS/EPSG**: koordinatsystem (4326 for lat/lon, 32632/32633 for UTM)

## Hva du bør se etter i nettverksloggen:
1. URLs som inneholder ord som:
   - kulturminn
   - gul/gulliste
   - bevar/bevaring
   - vern/verneverdig
   - conservation
   - heritage

2. Requests som sendes når du:
   - Klikker på kartet
   - Zoomer inn på et område med gule bygninger
   - Åpner informasjon om en bygning

3. Response som inneholder:
   - JSON/GeoJSON data
   - Feature collections
   - Properties med bevaringsstatus

Kan du dele noen eksempler på GET-requests du ser i nettverksloggen?