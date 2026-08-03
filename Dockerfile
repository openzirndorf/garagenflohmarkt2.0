FROM python:3.12-slim AS builder
WORKDIR /app
COPY pyproject.toml .
# pip install . baut/prüft auch das lokale Package selbst (nicht nur die
# Abhängigkeiten) - seit [tool.setuptools] packages explizit app/scripts
# auflistet, müssen diese Verzeichnisse hier schon vorhanden sein, sonst
# bricht setuptools mit "package directory 'app' does not exist" ab.
COPY app/ ./app/
COPY scripts/ ./scripts/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

FROM python:3.12-slim AS runner
WORKDIR /app
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
EXPOSE 8080
# --no-access-log: Tokens reisen als URL-Pfadsegment (z.B. /stands/confirm/{token}) -
# Uvicorns Standard-Access-Log würde sie sonst im Klartext in die Container-Logs schreiben.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--no-access-log"]
