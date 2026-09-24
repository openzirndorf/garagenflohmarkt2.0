import mimetypes
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import close_pool
from app.routes.admins import router as admins_router
from app.routes.settings import router as settings_router
from app.routes.stands import router as stands_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()

# Interaktive API-Doku (/docs, /redoc, /openapi.json) ist in Produktion
# bewusst aus: sie listet alle Endpunkte samt Admin-Routen für jeden
# einsehbar auf und erleichtert Angreifern das Erkunden. Nicht angewiesen
# darauf ist die App selbst (das Frontend nutzt die Endpunkte direkt).
app = FastAPI(
    title="Flohmarkt API",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://openzirndorf.de",
        "https://garagenflohmarkt.openzirndorf.de",
        "https://f-hrtmnn.github.io",
        "https://openzirndorf.github.io",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Reduziert die XSS-Angriffsfläche fürs SPA (relevant u.a. für die Admin-
# Session, die in localStorage liegt, siehe frontend/src/components/admin-
# panel.tsx) - ohne dangerouslySetInnerHTML im Code ist das Risiko gering,
# aber nicht null (z.B. über eine verwundbare Abhängigkeit). Domains sind
# bewusst auf das beschränkt, was die App tatsächlich lädt:
# - tiles.openfreemap.org: Kartenkacheln/Glyphen/Sprites (siehe
#   flohmarkt-map.tsx)
# - garagenflohmarkt-stands.s3.fr-par.scw.cloud: Stands-Artefakt (siehe
#   infra/outputs.tf, VITE_STATIC_BASE_URL)
# - openzirndorf.de: Logo/Maskottchen-Bilder, Favicon
# 'unsafe-inline' bei style-src ist nötig, weil sowohl Tailwind als auch
# etliche Komponenten style={{...}} (echte inline style-Attribute) nutzen
# - eine Umstellung auf CSS-Klassen dafür wäre ein eigener, großer Umbau.
# worker-src blob: ist für maplibre-gl nötig (Standard-Build erzeugt seinen
# Worker per Blob-URL statt einer eigenen Datei, siehe maplibre-gl-csp.js
# als CSP-fähige Alternative, die hier nicht verwendet wird).
_CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https://openzirndorf.de https://tiles.openfreemap.org; "
    "font-src 'self'; "
    "connect-src 'self' https://tiles.openfreemap.org "
    "https://garagenflohmarkt-stands.s3.fr-par.scw.cloud; "
    "worker-src 'self' blob:; "
    "child-src 'self' blob:; "
    "manifest-src 'self'; "
    "object-src 'none'; "
    "base-uri 'self'; "
    "frame-ancestors 'none'"
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = _CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Redundant zu frame-ancestors 'none' oben, aber ältere Browser ohne
    # CSP3-Unterstützung kennen nur diesen Header gegen Clickjacking.
    response.headers["X-Frame-Options"] = "DENY"
    # Bewusst OHNE includeSubDomains: api.openzirndorf.de und
    # garagenflohmarkt.openzirndorf.de sind nur zwei von mehreren
    # Subdomains unter openzirndorf.de (andere Projekte laufen auf
    # eigenen Subdomains) - includeSubDomains würde HSTS im Browser für
    # die GESAMTE Domain erzwingen, auch für Subdomains, die dieser
    # Container gar nicht kontrolliert und deren HTTPS-Konfiguration hier
    # nicht geprüft wurde. Auch bewusst ohne "preload": das landet in
    # einer von Browsern ausgelieferten Liste und lässt sich praktisch
    # nicht mehr zurücknehmen.
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


@app.get("/health")
def health():
    return {"ok": True}


# GET /launch-config - öffentlich, kein Auth (wie /health). Liefert das
# Startdatum für die Platzhalter-/Countdown-Seite (src/components/coming-
# soon.tsx) aus einer einfachen Env-Var statt hartkodiert im Frontend - ein
# späteres Verschieben des Datums ist damit ein reiner `tofu apply` mit
# neuem Var-Wert, kein Rebuild/Redeploy des Images nötig. Leer/nicht
# gesetzt = "Datum steht noch nicht fest", Frontend zeigt dann einen
# allgemeinen Hinweis statt eines Countdowns.
@app.get("/launch-config")
def launch_config():
    return {"launch_at": os.getenv("LAUNCH_AT") or None}


app.include_router(stands_router, prefix="/stands")
app.include_router(admins_router, prefix="/admins")
app.include_router(settings_router, prefix="/settings")


# Gebautes Frontend ausliefern (siehe Dockerfile: COPY --from=frontend-
# builder .../dist ./dist) - ein Container statt getrennt Backend
# (Scaleway) und Frontend (bisher GitHub Pages). Muster 1:1 aus dem
# Schwesterprojekt erfahre (erfahre/backend/main.py). Bewusst NACH
# app.include_router(): FastAPI matcht Routen in Registrierungsreihenfolge,
# echte API-Pfade wie /stands/geojson greifen also immer zuerst - diese
# Catch-all-Route sieht nur, was sonst nirgends passt.
#
# Die Route selbst ist IMMER registriert (nicht nur wenn dist/ existiert) -
# war anfangs bedingt und hat dadurch genau den Bug verschleiert, den sie
# selbst verursacht hat: ohne lokal gebautes dist/ lief in Tests nie die
# Routing-Topologie, die in Produktion tatsächlich aktiv ist. So bricht
# eine kaputte Route (siehe list_stands oben, "" zusätzlich zu "/") auch
# ohne echten Docker-Build in den Tests sichtbar, statt erst live
# aufzufallen (ist einmal live passiert: GET /stands ohne Slash landete
# hier statt beim echten Endpunkt, lieferte index.html statt der
# Standliste - die öffentliche Liste war leer, obwohl Stände existierten).
_DIST_DIR = Path(__file__).parent.parent / "dist"


# Reihenfolge = Präferenz (Brotli ist kleiner als gzip).
_PRECOMPRESSED_ENCODINGS = (("br", ".br"), ("gzip", ".gz"))


def _accepted_encodings(header: str) -> set[str]:
    accepted: set[str] = set()
    for part in header.split(","):
        name, _, params = part.strip().partition(";")
        quality = 1.0
        params = params.strip()
        if params.startswith("q="):
            try:
                quality = float(params[2:])
            except ValueError:
                quality = 0.0
        if quality > 0:
            accepted.add(name.strip().lower())
    return accepted


# methods=["GET", "HEAD"] statt @app.get(): FastAPI/Starlette fügt HEAD
# einem GET-Endpunkt NICHT automatisch hinzu (live geprüft, auch lokal mit
# einer minimalen Route reproduziert - 405 mit Allow: GET). Live
# aufgefallen, weil die Google Search Console beim Einreichen der Sitemap
# "Vorübergehender Verarbeitungsfehler" meldete - viele Crawler/Tools
# schicken vor einem GET erst ein HEAD, das über diese Route auch
# sitemap.xml/robots.txt/das restliche gebaute Frontend ausliefert.
@app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def spa(full_path: str, request: Request) -> FileResponse:
    if not _DIST_DIR.is_dir():
        # Lokale Entwicklung ohne Docker-Build: kein Frontend zum
        # Ausliefern vorhanden, sauberer 404 statt eines FileNotFoundError.
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    # Pfad muss innerhalb von dist/ bleiben: ohne diese Prüfung lieferte
    # z.B. /%2e%2e/app/main.py (live bestätigt) beliebige Dateien außerhalb
    # aus - inkl. /proc/self/environ mit allen Secrets des Containers.
    dist = _DIST_DIR.resolve()
    try:
        candidate = (dist / full_path).resolve()
        served = candidate if candidate.is_file() and candidate.is_relative_to(dist) else dist / "index.html"
    except (OSError, ValueError):
        served = dist / "index.html"
    # Beim Docker-Build vorkomprimierte Varianten (frontend/scripts/
    # precompress.mjs) ausliefern, sofern der Client sie akzeptiert - der
    # Container komprimiert so nichts pro Request (1 vCPU; das JS-Bundle ist
    # ~1,4 MB, mit Brotli ~310 KB).
    media_type = mimetypes.guess_type(served.name)[0] or "application/octet-stream"
    variants = [
        (encoding, served.with_name(served.name + suffix))
        for encoding, suffix in _PRECOMPRESSED_ENCODINGS
    ]
    variants = [(encoding, path) for encoding, path in variants if path.is_file()]
    headers = {"Vary": "Accept-Encoding"} if variants else {}
    accepted = _accepted_encodings(request.headers.get("accept-encoding", ""))
    for encoding, path in variants:
        if encoding in accepted:
            return FileResponse(
                path, media_type=media_type, headers={**headers, "Content-Encoding": encoding}
            )
    return FileResponse(served, headers=headers)
