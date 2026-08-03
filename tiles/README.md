# Kartenkacheln selbst hosten (PMTiles)

Einmaliger, manueller Build - **nie in CI**, keine Netzwerk-/Rechenlast
während des laufenden Betriebs. Ersetzt die Live-Abhängigkeit von
`tiles.openfreemap.org` (nicht garantiert EU-gehostet) durch eine einzelne
statische Datei, die auf demselben Object-Storage-Bucket liegt wie die
Stands-Artefakte.

Nur nötig, wenn `tiles/zirndorf.pmtiles` noch nicht existiert oder sich das
darzustellende Gebiet/die Zoomstufen ändern. Für dieses Event reicht ein
einziger Lauf vor dem 4.10.2026.

## Ablauf

1. **OSM-Ausschnitt für Mittelfranken/Zirndorf herunterladen** (Geofabrik,
   Deutschland-Server):

   ```bash
   curl -o mittelfranken.osm.pbf \
     https://download.geofabrik.de/europe/germany/bayern/mittelfranken-latest.osm.pbf
   ```

2. **Auf das Zirndorf-Gebiet zuschneiden** mit Osmium (osmium-tool, per
   Docker-Image, kein lokales Install nötig):

   ```bash
   docker run --rm -v "$PWD:/data" stefda/osmium-tool \
     extract --polygon /data/zirndorf.poly /data/mittelfranken.osm.pbf \
     -o /data/zirndorf.osm.pbf
   ```

   `zirndorf.poly` ist ein Osmium-Polygon-Filter (Textdatei mit
   Grenzkoordinaten des gewünschten Gebiets, z.B. via
   [BBox-to-Poly-Generatoren](https://github.com/osmcode/osmium-tool) oder
   `overpass`-Boundary-Export erzeugt) - noch zu erstellen, sobald die
   genauen Kartengrenzen feststehen.

3. **Zu PMTiles bauen** mit Planetiler (Docker-Image, Standardprofil =
   OpenMapTiles-Schema - identisch zu dem, das OpenFreeMap nutzt, damit die
   bestehenden MapLibre-Style-Regeln unverändert weiterfunktionieren):

   ```bash
   docker run --rm -v "$PWD:/data" ghcr.io/onthegomap/planetiler:latest \
     --osm-path=/data/zirndorf.osm.pbf \
     --output=/data/zirndorf.pmtiles
   ```

4. **Hochladen** auf denselben Bucket wie die Stands-Artefakte (siehe
   `infra/main.tf`, `scaleway_object_bucket.stands`), fester Key
   `tiles/zirndorf.pmtiles`:

   ```bash
   scw object put bucket=garagenflohmarkt-stands \
     key=tiles/zirndorf.pmtiles file=zirndorf.pmtiles \
     content-type=application/octet-stream
   ```

   Bewusst **nicht** über `app/jobs/stands_artifact.py` - dieser Job räumt
   beim Löschtermin (07.10.2026) nur den `stands/`-Präfix auf und lässt
   `tiles/` unangetastet, da Kartografie keinen Personenbezug hat und beim
   nächsten Event wiederverwendet werden kann.

## Frontend-Anbindung (noch nicht umgestellt)

Die Karte läuft aktuell noch auf `tiles.openfreemap.org`
(`frontend/src/components/flohmarkt-map.tsx`). Sobald
`tiles/zirndorf.pmtiles` einmal gebaut und hochgeladen ist:

1. `pmtiles`-Paket zu `frontend/package.json` hinzufügen.
2. Protokoll registrieren: `maplibregl.addProtocol("pmtiles", new pmtiles.Protocol().tile)`.
3. Eine lokale Kopie des (MIT-lizenzierten) "Liberty"-Style-JSON von
   OpenFreeMap in `frontend/public/map-style.json` ablegen und
   `sources.openmaptiles.url` auf
   `pmtiles://<VITE_STATIC_BASE_URL>/tiles/zirndorf.pmtiles` umschreiben.
4. `style: "https://tiles.openfreemap.org/styles/liberty"` in
   `flohmarkt-map.tsx` durch `style: "/map-style.json"` ersetzen.

Der bereits eingebaute Degradationspfad (`map-or-list.tsx`) schaltet bei
jedem Kartenfehler automatisch auf die Listenansicht um - unabhängig davon,
ob die Kartenkacheln von OpenFreeMap oder aus dem eigenen Bucket kommen.
Bewusst **kein** Live-Fallback auf OpenFreeMap im Fehlerfall, damit die
EU-only-Garantie auch im Fehlerfall gilt.
