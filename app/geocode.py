"""Adresse -> Koordinaten (+ strukturierte Bestandteile).

Primär OpenCage (https://opencagedata.com) statt der öffentlichen
Nominatim-Instanz: Nominatims eigene Nutzungsbedingungen
(https://operations.osmfoundation.org/policies/nominatim/) untersagen
automatisierte/programmatische Anfragen im Rahmen eines Dienstes,
unabhängig vom tatsächlichen Volumen. OpenCage bewusst statt anderer
Alternativen wie LocationIQ gewählt, weil OpenCage laut eigener Aussage
ausschließlich bei Hetzner in Deutschland hostet ("our logs never leave
Europe") - passend zur sonst durchgehenden EU-only-Ausrichtung dieses
Projekts. Kostenloser Tarif (2.500 Anfragen/Tag) reicht für dieses
Anmeldevolumen bei Weitem.

GEOCODE_API_KEY setzen (siehe infra/main.tf) - ohne Key fällt dies bewusst
auf die öffentliche Nominatim-Instanz zurück, aber NUR für die lokale
Entwicklung. In Produktion ohne gesetzten Key lieber gar nicht geocodieren
als die Nominatim-Policy zu verletzen.
"""
import math
import os
from typing import NamedTuple

import httpx

OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
UA = "OpenZirndorf-Flohmarkt/0.1 (kontakt@openzirndorf.de)"

# Benannte Ortsteile (Außenorte) von Zirndorf mit ungefährem Mittelpunkt
# (Koordinaten von Nominatim, dort als "village" getaggt). OpenCage/
# Nominatim taggen einzelne Straßenadressen dort NICHT mit dem
# Ortsteilnamen - live gegengeprüft: eine reine Namenssuche ("Weiherhof,
# Zirndorf") liefert components.village, dieselbe Adresse aber per
# Reverse-Geocoding (echte Hausnummer) nur "city": "Zirndorf", kein
# Ortsteil-Feld. Der Ortsteil wird deshalb hier selbst per Entfernung
# bestimmt statt vom Geocoder übernommen - diese Liste ist die einzige
# manuell zu pflegende Stelle, falls ein weiterer Ortsteil dazukommen
# soll, die Zuordnung zu einer konkreten Adresse läuft danach automatisch.
_ORTSTEILE = [
    ("Weiherhof", 49.4594327, 10.9283946),
    ("Banderbach", 49.4489498, 10.9264537),
    ("Bronnamberg", 49.4393792, 10.9107111),
    ("Wintersdorf", 49.4273908, 10.9128271),
    ("Lind", 49.4213619, 10.9365479),
    ("Anwanden", 49.4092141, 10.9319222),
    ("Weinzierlein", 49.4239318, 10.8972761),
]

# Die Zirndorfer Kernstadt liegt mindestens 2,1 km von jedem dieser
# Ortsteile entfernt, die Ortsteile selbst mindestens 1,17 km auseinander
# (mit echten Koordinaten geprüft) - 1 km Radius erfasst die Ortsteile
# selbst komfortabel, ohne Kernstadt-Adressen fälschlich einem Ortsteil
# zuzuordnen.
_ORTSTEIL_RADIUS_KM = 1.0


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _nearest_ortsteil(lat: float, lng: float) -> str | None:
    name, olat, olng = min(
        _ORTSTEILE, key=lambda o: _haversine_km(lat, lng, o[1], o[2])
    )
    if _haversine_km(lat, lng, olat, olng) <= _ORTSTEIL_RADIUS_KM:
        return name
    return None


class GeocodeResult(NamedTuple):
    lat: float
    lng: float
    # None, wenn das Geocoding keine PLZ geliefert hat - der Aufrufer prüft
    # damit u.a., ob eine Adresse tatsächlich in Zirndorf liegt (siehe
    # app/routes/stands.py _reject_if_outside_zirndorf).
    postcode: str | None
    # Aus denselben Bestandteilen zusammengesetzte, einheitlich formatierte
    # Adresse ("Straße Hausnummer, PLZ Ort") - ersetzt bei Erfolg die frei
    # getippte Nutzereingabe (siehe _format_adresse unten). Praktisch nie
    # None: geocode() gibt seit der Präzisions-Prüfung dort komplett None
    # zurück (statt eines GeocodeResult mit formatted_adresse=None), wenn
    # der Treffer nur grob auf Orts-/Straßenebene ohne Hausnummer passt -
    # sonst würde eine falsch geschriebene Straße (z.B. "Banterbach" statt
    # "Banderbach") zwar einen unformatierten Adresstext zeigen, aber
    # trotzdem einen (falschen, meist irgendwo in der Zirndorfer Ortsmitte
    # liegenden) Kartenpunkt bekommen.
    formatted_adresse: str | None


def _format_adresse(components: dict) -> str | None:
    # Ursprünglich zusätzlich postcode/city aus den Geocoding-Bestandteilen
    # verlangt - das schlug live in der großen Mehrheit der Fälle fehl
    # (21 von 24 bestehenden Ständen ohne PLZ in der Liste), weil OpenCage/
    # Nominatim bei vielen Treffern gar keine postcode-Komponente liefern
    # (_reject_if_outside_zirndorf in app/routes/stands.py lässt das
    # bewusst durch, statt die Anmeldung deswegen abzulehnen) oder city/
    # town/village für Außenorte anders klassifizieren. Da diese App
    # ohnehin ausschließlich Zirndorf-Adressen akzeptiert (Zirndorf hat nur
    # eine PLZ fürs ganze Gemeindegebiet inkl. Außenorte), braucht die
    # Formatierung selbst weder postcode noch city vom Geocoder - "PLZ Ort"
    # ist immer "90513 Zirndorf". Muss mit _ZIRNDORF_POSTCODE in
    # app/routes/stands.py übereinstimmen.
    road = components.get("road")
    house_number = components.get("house_number")
    if not (road and house_number):
        return None
    return f"{road} {house_number}, 90513 Zirndorf"


async def geocode(adresse: str) -> GeocodeResult | None:
    api_key = os.getenv("GEOCODE_API_KEY")
    query = f"{adresse}, Zirndorf, Bayern, Deutschland"

    async with httpx.AsyncClient() as client:
        try:
            if api_key:
                r = await client.get(
                    OPENCAGE_URL,
                    params={"key": api_key, "q": query, "limit": "1", "no_annotations": "1"},
                    timeout=5,
                )
                r.raise_for_status()
                results = r.json().get("results") or []
                if not results:
                    return None
                geo = results[0]["geometry"]
                components = results[0].get("components") or {}
                formatted_adresse = _format_adresse(components)
                if not formatted_adresse:
                    return None
                lat, lng = float(geo["lat"]), float(geo["lng"])
                ortsteil = _nearest_ortsteil(lat, lng)
                if ortsteil:
                    formatted_adresse = f"{formatted_adresse} ({ortsteil})"
                return GeocodeResult(
                    lat=lat,
                    lng=lng,
                    postcode=components.get("postcode"),
                    formatted_adresse=formatted_adresse,
                )

            # Nur für lokale Entwicklung ohne Key - siehe Modul-Docstring.
            # addressdetails=1 liefert dieselben strukturierten Bestandteile
            # wie OpenCages components, sonst nur einen freien display_name.
            r = await client.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": "1", "addressdetails": "1"},
                headers={"User-Agent": UA},
                timeout=5,
            )
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            components = data[0].get("address") or {}
            formatted_adresse = _format_adresse(components)
            if not formatted_adresse:
                return None
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            ortsteil = _nearest_ortsteil(lat, lng)
            if ortsteil:
                formatted_adresse = f"{formatted_adresse} ({ortsteil})"
            return GeocodeResult(
                lat=lat,
                lng=lng,
                postcode=components.get("postcode"),
                formatted_adresse=formatted_adresse,
            )
        except Exception:  # noqa: BLE001 - Geocoding-Fehler sollen nie die Anmeldung blockieren
            return None
