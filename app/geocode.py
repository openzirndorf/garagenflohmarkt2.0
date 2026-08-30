"""Adresse -> Koordinaten.

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

import httpx

OPENCAGE_URL = "https://api.opencagedata.com/geocode/v1/json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
UA = "OpenZirndorf-Flohmarkt/0.1 (kontakt@openzirndorf.de)"


async def geocode(adresse: str) -> tuple[float, float] | None:
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
                return float(geo["lat"]), float(geo["lng"])

            # Nur für lokale Entwicklung ohne Key - siehe Modul-Docstring.
            r = await client.get(
                NOMINATIM_URL,
                params={"q": query, "format": "json", "limit": "1"},
                headers={"User-Agent": UA},
                timeout=5,
            )
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:  # noqa: BLE001 - Geocoding-Fehler sollen nie die Anmeldung blockieren
            return None
