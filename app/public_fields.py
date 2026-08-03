"""Öffentliche Feldlisten - Positivliste, an einer Stelle definiert.

Sowohl die Live-Endpunkte (app/routes/stands.py) als auch der Job, der das
statische Karten-Artefakt baut (app/jobs/stands_artifact.py), müssen exakt
dieselben Spalten verwenden - nur diese Felder dürfen die öffentliche
Karte/Liste je erreichen. Kein Klarname, keine E-Mail, kein Token.
"""

PUBLIC_LIST_COLUMNS = "id, nickname, adresse, lat, lng, beschreibung, kategorien, uhrzeit, created_at"
PUBLIC_GEOJSON_COLUMNS = "id, nickname, adresse, lat, lng, beschreibung, kategorien, uhrzeit"


def rows_to_geojson(rows) -> dict:
    """Baut eine FeatureCollection aus Zeilen, die mit PUBLIC_GEOJSON_COLUMNS
    abgefragt wurden. Geteilt zwischen dem Live-Endpunkt und dem
    Artefakt-Job, damit beide exakt dasselbe Format erzeugen."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lng"], r["lat"]]},
                "properties": {
                    "id": r["id"],
                    "nickname": r["nickname"],
                    "adresse": r["adresse"],
                    "beschreibung": r["beschreibung"],
                    "kategorien": list(r["kategorien"] or []),
                    "uhrzeit": r["uhrzeit"],
                },
            }
            for r in rows
        ],
    }
