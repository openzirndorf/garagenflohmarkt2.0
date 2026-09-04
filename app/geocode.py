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
import os
from typing import NamedTuple

import httpx

OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
UA = "OpenZirndorf-Flohmarkt/0.1 (kontakt@openzirndorf.de)"


class GeocodeResult(NamedTuple):
    lat: float
    lng: float
    # None, wenn das Geocoding keine PLZ geliefert hat - der Aufrufer prüft
    # damit u.a., ob eine Adresse tatsächlich in Zirndorf liegt (siehe
    # app/routes/stands.py _reject_if_outside_zirndorf).
    postcode: str | None
    # Aus denselben Bestandteilen zusammengesetzte, einheitlich formatierte
    # Adresse ("Straße Hausnummer, PLZ Ort") - ersetzt bei Erfolg die frei
    # getippte Nutzereingabe (siehe _format_adresse unten). None, wenn dafür
    # ein Bestandteil fehlt.
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
                return GeocodeResult(
                    lat=float(geo["lat"]),
                    lng=float(geo["lng"]),
                    postcode=components.get("postcode"),
                    formatted_adresse=_format_adresse(components),
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
            return GeocodeResult(
                lat=float(data[0]["lat"]),
                lng=float(data[0]["lon"]),
                postcode=components.get("postcode"),
                formatted_adresse=_format_adresse(components),
            )
        except Exception:  # noqa: BLE001 - Geocoding-Fehler sollen nie die Anmeldung blockieren
            return None
