# Stage 1: Frontend bauen. Wird ins Backend-Image kopiert (siehe Runner-
# Stage) - ein Container, eine Domain, statt Frontend (GitHub Pages) und
# Backend (Scaleway) getrennt zu hosten. Muster aus dem Schwesterprojekt
# erfahre (erfahre/backend/Dockerfile).
FROM node:22-slim AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
# Leer = relative API-Pfade ("/stands/...") statt einer fest eingebrannten
# Domain - Frontend und Backend teilen sich ab jetzt dieselbe Origin. Nur
# der Docker-Build bekommt diesen Default; "npm run dev" außerhalb von
# Docker fällt weiterhin auf http://localhost:8080 zurück (siehe api.ts).
ARG VITE_API_URL=""
ARG VITE_API_USERNAME=""
ARG VITE_API_PASSWORD=""
ARG VITE_STATIC_BASE_URL=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_API_USERNAME=$VITE_API_USERNAME \
    VITE_API_PASSWORD=$VITE_API_PASSWORD \
    VITE_STATIC_BASE_URL=$VITE_STATIC_BASE_URL
RUN npm run build

FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
# pip install . baut/prüft auch das lokale Package selbst (nicht nur die
# Abhängigkeiten) - seit [tool.setuptools] packages explizit app/scripts
# auflistet, müssen diese Verzeichnisse hier schon vorhanden sein, sonst
# bricht setuptools mit "package directory 'app' does not exist" ab.
COPY app/ ./app/
COPY scripts/ ./scripts/
RUN pip install --no-cache-dir --upgrade pip setuptools \
    && pip install --no-cache-dir .

FROM python:3.12-slim AS runner
WORKDIR /app
# python:3.12-slim bringt bei jedem Build den OS-Paketstand von irgendwann
# mit, nicht zwingend die neuesten Debian-Sicherheitsupdates (z.B. einmal
# beobachtet: openssl/util-linux mit bereits verfügbarem, aber noch nicht
# eingespieltem Fix laut trivy-image-Scan). apt-get upgrade zieht die zum
# Build-Zeitpunkt aktuellen Patches, ohne auf ein neues Base-Image warten
# zu müssen.
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# Abhängigkeiten aus Builder-Stage übernehmen
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY app/ ./app/
# scripts/ wird zur Laufzeit gebraucht: der Löschjob (scaleway_job_definition
# "deletion_job", siehe infra/main.tf) läuft mit demselben Image und
# überschriebenem Befehl "python -m scripts.deletion_job".
COPY scripts/ ./scripts/
# Gebautes Frontend - app/main.py liefert es über eine Catch-all-Route nach
# den API-Routen aus (nur aktiv, wenn dieses Verzeichnis existiert - lokale
# Entwicklung ohne Docker bleibt davon unberührt).
COPY --from=frontend-builder /frontend/dist ./dist
EXPOSE 8080
# --no-access-log: Tokens reisen als URL-Pfadsegment (z.B. /stands/confirm/{token}) -
# Uvicorns Standard-Access-Log würde sie sonst im Klartext in die Container-Logs schreiben.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
