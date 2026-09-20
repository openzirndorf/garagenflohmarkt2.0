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
import re
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
    # getippte Nutzereingabe (siehe _format_adresse unten). None, wenn der
    # Geocoder zwar die Straße, aber keine Hausnummer dafür kennt (z.B.
    # eine noch nicht in OpenStreetMap erfasste Adresse) - lat/lng liegen
    # dann trotzdem auf der richtigen Straße und werden übernommen, nur
    # der Text fällt auf die Roheingabe zurück, da sich die Hausnummer
    # nicht bestätigen lässt. geocode() selbst gibt None (statt eines
    # GeocodeResult) nur zurück, wenn nicht mal die Straße gefunden wurde
    # - sonst würde eine falsch geschriebene Straße (z.B. "Banterbach"
    # statt "Banderbach") einen (falschen, meist irgendwo in der
    # Zirndorfer Ortsmitte liegenden) Kartenpunkt auf Orts-/Stadt-Ebene
    # bekommen.
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


def _is_trustworthy(components: dict) -> bool:
    # Mindestbar für die Koordinaten selbst: die Straße muss stimmen -
    # bewusst NICHT zusätzlich die Hausnummer verlangt (das prüft schon
    # _format_adresse, aber nur für den Anzeigetext). Live beobachtet: für
    # etliche echte, existierende Adressen kennt OpenCage/Nominatim die
    # Straße korrekt, aber keine exakte Hausnummer-Position (Adresse noch
    # nicht bis auf Gebäudeebene in OpenStreetMap erfasst) - der
    # zurückgegebene Punkt liegt dann trotzdem sinnvoll auf der richtigen
    # Straße, nur eben nicht exakt am richtigen Gebäude. Fehlt dagegen
    # auch die Straße (nur noch Orts-/Stadt-Ebene), ist der Punkt
    # potenziell kilometerweit daneben (siehe "Banterbach"-Fall) - dann
    # gar keine Koordinaten übernehmen ist besser als falsche.
    return bool(components.get("road"))


# Ab welchem Abstand zwei gleichnamige Straßen-Treffer als zwei
# unterschiedliche, tatsächlich getrennte Orte gelten statt als
# Ungenauigkeit desselben Straßenabschnitts.
_AMBIGUOUS_ROAD_DISTANCE_KM = 0.3


def _is_ambiguous_road(candidates: list[tuple[float, float, dict]]) -> bool:
    # Manche Straßennamen existieren in Zirndorf gleich mehrfach als
    # eigene, weit auseinanderliegende OSM-Wege (live bestätigt: "Weiherhofer
    # Hauptstraße" liefert bei OpenCage zwei ca. 0,8 km auseinanderliegende
    # Treffer - einer bei Banderbach, einer tatsächlich bei Weiherhof).
    # Ohne bestätigte Hausnummer (siehe _format_adresse) lässt sich dann
    # nicht bestimmen, welcher Abschnitt gemeint ist - ein blind
    # übernommener erster Treffer setzt den Stand mit einiger
    # Wahrscheinlichkeit an eine falsche Stelle. Besser gar keine
    # Koordinaten übernehmen als eine geratene falsche.
    seen: dict[str, tuple[float, float]] = {}
    for lat, lng, components in candidates:
        road = components.get("road")
        if not road:
            continue
        key = road.strip().lower()
        if key in seen and _haversine_km(lat, lng, *seen[key]) > _AMBIGUOUS_ROAD_DISTANCE_KM:
            return True
        seen.setdefault(key, (lat, lng))
    return False


def _resolve_by_ortsteil_hint(
    road: str, candidates: list[tuple[float, float, dict]]
) -> tuple[float, float] | None:
    # Manche mehrdeutigen Straßen tragen den Namen des gemeinten Ortsteils
    # bereits im eigenen Namen (live bestätigt: "Weiherhofer Hauptstraße"
    # existiert doppelt, aber nur EINER der beiden ca. 0,8 km entfernten
    # Treffer liegt tatsächlich innerhalb des Weiherhof-Radius - lieber
    # diesen naheliegenden Treffer nehmen, statt bei einem so eindeutigen
    # Hinweis im Straßennamen komplett auf Koordinaten zu verzichten).
    # Findet sich kein solcher Hinweis oder bleibt es auch dann mehrdeutig
    # (z.B. zwei Treffer beide "bei Weiherhof"), None zurückgeben - dann
    # greift weiterhin "lieber keine Koordinaten als geratene falsche".
    lower_road = road.lower()
    hint = next((name for name, _, _ in _ORTSTEILE if name.lower() in lower_road), None)
    if hint is None:
        return None
    matches = {
        (lat, lng)
        for lat, lng, components in candidates
        if (components.get("road") or "").strip().lower() == road.strip().lower()
        and _nearest_ortsteil(lat, lng) == hint
    }
    if len(matches) == 1:
        return next(iter(matches))
    return None


# Straße/Hausnummer-Formular (siehe frontend composeAdresse in
# lib/adresse.ts) übergibt hier bereits "Straße Hausnummer, 90513
# Zirndorf" - ohne diesen Schnitt würde die Anfrage unten ein zweites Mal
# ", Zirndorf, Bayern, Deutschland" anhängen. Live beobachtet (Weiherhofer
# Hauptstraße 65): diese Dopplung ändert OpenCages Trefferliste spürbar -
# der zur Erkennung einer mehrdeutigen gleichnamigen Straße nötige zweite
# Treffer fiel dadurch aus den Top-Treffern raus, _is_ambiguous_road griff
# nicht mehr und die falschen Koordinaten wurden wieder übernommen.
_TRAILING_ZIRNDORF_SUFFIX = re.compile(r",?\s*90513\s+Zirndorf\s*$", re.IGNORECASE)


async def geocode(adresse: str) -> GeocodeResult | None:
    api_key = os.getenv("GEOCODE_API_KEY")
    street_part = _TRAILING_ZIRNDORF_SUFFIX.sub("", adresse).strip()
    query = f"{street_part}, Zirndorf, Bayern, Deutschland"

    async with httpx.AsyncClient() as client:
        try:
            if api_key:
                r = await client.get(
                    OPENCAGE_URL,
                    params={"key": api_key, "q": query, "limit": "5", "no_annotations": "1"},
                    timeout=5,
                )
                r.raise_for_status()
                results = r.json().get("results") or []
                if not results:
                    return None
                geo = results[0]["geometry"]
                components = results[0].get("components") or {}
                if not _is_trustworthy(components):
                    return None
                formatted_adresse = _format_adresse(components)
                lat, lng = float(geo["lat"]), float(geo["lng"])
                if formatted_adresse is None:
                    candidates = [
                        (float(res["geometry"]["lat"]), float(res["geometry"]["lng"]), res.get("components") or {})
                        for res in results
                        if res.get("geometry")
                    ]
                    if _is_ambiguous_road(candidates):
                        resolved = _resolve_by_ortsteil_hint(components.get("road") or "", candidates)
                        if resolved is None:
                            return None
                        lat, lng = resolved
                ortsteil = _nearest_ortsteil(lat, lng)
                if formatted_adresse and ortsteil:
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
                params={"q": query, "format": "json", "limit": "5", "addressdetails": "1"},
                headers={"User-Agent": UA},
                timeout=5,
            )
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            components = data[0].get("address") or {}
            if not _is_trustworthy(components):
                return None
            formatted_adresse = _format_adresse(components)
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            if formatted_adresse is None:
                candidates = [
                    (float(entry["lat"]), float(entry["lon"]), entry.get("address") or {})
                    for entry in data
                    if entry.get("lat") and entry.get("lon")
                ]
                if _is_ambiguous_road(candidates):
                    resolved = _resolve_by_ortsteil_hint(components.get("road") or "", candidates)
                    if resolved is None:
                        return None
                    lat, lng = resolved
            ortsteil = _nearest_ortsteil(lat, lng)
            if formatted_adresse and ortsteil:
                formatted_adresse = f"{formatted_adresse} ({ortsteil})"
            return GeocodeResult(
                lat=lat,
                lng=lng,
                postcode=components.get("postcode"),
                formatted_adresse=formatted_adresse,
            )
        except Exception:  # noqa: BLE001 - Geocoding-Fehler sollen nie die Anmeldung blockieren
            return None
