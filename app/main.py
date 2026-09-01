import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.database import close_pool
from app.routes.stands import router as stands_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_pool()

app = FastAPI(title="Flohmarkt API", lifespan=lifespan)

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


# Gebautes Frontend ausliefern (siehe Dockerfile: COPY --from=frontend-
# builder .../dist ./dist) - ein Container statt getrennt Backend
# (Scaleway) und Frontend (bisher GitHub Pages). Muster 1:1 aus dem
# Schwesterprojekt erfahre (erfahre/backend/main.py). Bewusst NACH
# app.include_router(): FastAPI matcht Routen in Registrierungsreihenfolge,
# echte API-Pfade wie /stands/geojson greifen also immer zuerst - diese
# Catch-all-Route sieht nur, was sonst nirgends passt. Nur aktiv, wenn
# dist/ existiert, damit lokale Entwicklung ohne Docker-Build unverändert
# funktioniert (kein Frontend-Build, kein 404-Sturz ins Leere).
_DIST_DIR = Path(__file__).parent.parent / "dist"
if _DIST_DIR.is_dir():

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str) -> FileResponse:
        candidate = _DIST_DIR / full_path
        return FileResponse(candidate if candidate.is_file() else _DIST_DIR / "index.html")
