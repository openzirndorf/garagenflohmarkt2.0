# Nominatim (OpenStreetMap) – kostenlos, kein API-Key
# Rate-Limit: max 1 Request/Sekunde laut OSM-Policy
import httpx

NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "OpenZirndorf-Flohmarkt/0.1 (kontakt@openzirndorf.de)"

async def geocode(adresse: str) -> tuple[float, float] | None:
    params = {
        "q": f"{adresse}, Zirndorf, Bayern, Deutschland",
        "format": "json",
        "limit": "1",
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(NOMINATIM, params=params, headers={"User-Agent": UA}, timeout=5)
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            return float(data[0]["lat"]), float(data[0]["lon"])
        except Exception:
            return None
