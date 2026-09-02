"""Öffentliche Feldlisten - Positivliste, an einer Stelle definiert.

Sowohl die Live-Endpunkte (app/routes/stands.py) als auch der Job, der das
statische Karten-Artefakt baut (app/jobs/stands_artifact.py), müssen exakt
dieselben Spalten verwenden - nur diese Felder dürfen die öffentliche
Karte/Liste je erreichen. Kein Klarname, keine E-Mail, kein Token.
"""

PUBLIC_LIST_COLUMNS = (
    "id, nickname, adresse, lat, lng, beschreibung, kategorien, zahlungsarten, created_at"
)
PUBLIC_GEOJSON_COLUMNS = "id, nickname, adresse, lat, lng, beschreibung, kategorien, zahlungsarten"

# Gemeinsamer Sichtbarkeits-Filter für alle vier Stellen, die die
# öffentliche Karte/Liste beliefern (die zwei Live-Endpunkte in
# app/routes/stands.py UND die zwei Queries in app/jobs/stands_artifact.py,
# das das von der Karte tatsächlich gelesene Artefakt erzeugt) - an einer
# Stelle definiert, damit ein deaktivierter Stand nicht versehentlich nur
# aus einer der vier Abfragen verschwindet.
PUBLIC_STANDS_FILTER = "status = 'APPROVED' AND NOT deactivated"


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
                    "zahlungsarten": list(r["zahlungsarten"] or []),
                },
            }
            for r in rows
        ],
    }
