<p align="center">
  <img src="docs/logo.png" alt="Garagenflohmarkt Zirndorf" width="320">
</p>

# Garagenflohmarkt Zirndorf

Der **Garagenflohmarkt Zirndorf** ist ein jährliches Stadtteilfest, bei dem Anwohnerinnen und Anwohner ihre Garagen, Einfahrten und Vorgärten in kleine Verkaufsstände verwandeln. Die ganze Stadt wird zur Flohmarktmeile.

Diese App macht es einfach, mitzumachen und den Überblick zu behalten:

- **Stand anmelden** — Adresse, kurze Beschreibung und Kategorie eintragen, E-Mail bestätigen, fertig. Der Stand erscheint nach kurzer Freigabe auf der Karte.
- **Karte** — Alle freigegebenen Stände auf einer interaktiven Karte, filterbar nach Kategorien (Kleidung, Spielzeug, Bücher …)
- **Eigenen Stand verwalten** — Beschreibung ändern oder den Stand jederzeit zurückziehen, ohne Anmeldung, nur mit dem persönlichen Link aus der Bestätigungsmail.

Die App ist kostenlos, ohne Account und ohne Tracking nutzbar.

**→ [openzirndorf.github.io/garagenflohmarkt2.0](https://openzirndorf.github.io/garagenflohmarkt2.0/)**

---

<details>
<summary><strong>Technische Dokumentation</strong> (für Entwicklerinnen und Entwickler)</summary>

---

## Architektur

```
Browser
  └── GitHub Pages (React-SPA, statisch)
        └── https://api.openzirndorf.de
              └── Scaleway Serverless Container (FastAPI, Docker)
                    └── Scaleway Serverless SQL (PostgreSQL)
```

```
garagenflohmarkt2.0/
├── frontend/          React-App (Karte, Formular, Admin-UI)
│   └── src/
│       ├── api.ts                  API-Client
│       ├── types.ts                TypeScript-Typen
│       └── components/
│           ├── flohmarkt-app.tsx   Hauptansicht
│           ├── flohmarkt-map.tsx   MapLibre-Karte
│           ├── stand-form.tsx      Anmeldeformular
│           ├── stand-liste.tsx     Standliste
│           ├── mein-stand.tsx      Eigener Stand (via edit_token)
│           └── admin-panel.tsx     Admin-UI (#admin)
├── app/               FastAPI-Backend
│   ├── main.py        App-Einstiegspunkt, CORS
│   ├── auth.py        Basic Auth (API) + Bearer Token (Admin)
│   ├── database.py    asyncpg-Connection-Pool
│   ├── email.py       Bestätigungsmail via Scaleway TEM
│   ├── geocode.py     Adresse → GPS (Nominatim/OSM)
│   └── routes/
│       └── stands.py  Alle Endpunkte, Rate-Limiter, Honeypot
├── infra/             OpenTofu (Scaleway-Infrastruktur)
│   ├── main.tf        Ressourcen + S3-Backend
│   ├── variables.tf   Eingabevariablen
│   ├── outputs.tf     Ausgabewerte
│   ├── terraform.tfvars          Secrets (gitignored)
│   ├── terraform.tfvars.example  Vorlage
│   └── backend.hcl               State-Credentials (gitignored)
├── schema.sql         Datenbankschema
└── Dockerfile         Multi-Stage (builder + runner)
```

**Ablauf einer Stand-Anmeldung:**
1. Nutzer füllt Formular aus → `POST /stands` (Basic Auth)
2. Backend geocodiert die Adresse via Nominatim/OSM
3. Stand landet als `PENDING` in der Datenbank
4. Bestätigungsmail geht raus (Scaleway TEM, Port 465/SSL)
5. Nutzer klickt Link → Stand wird `CONFIRMED`
6. Admin gibt ihn frei → `APPROVED`, erscheint auf der Karte

---

## Credentials

Das Projekt hat sechs Credential-Gruppen:

### 1. Scaleway Haupt-API-Key
**Zweck:** OpenTofu verwaltet damit alle Scaleway-Ressourcen (Datenbank, Container, IAM …)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `scw_access_key`, `scw_secret_key`, `scw_project_id` |
| GitHub Actions Secrets | `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`, `SCW_PROJECT_ID`, `SCW_ORGANIZATION_ID` |

**Rotieren:**
1. Scaleway Console → IAM → API Keys → neuen Key anlegen (bearer: eigener User)
2. `terraform.tfvars` aktualisieren
3. GitHub Secrets aktualisieren
4. `tofu apply` (aktualisiert `SMTP_PASSWORD` im Container automatisch)
5. Alten Key in Scaleway löschen

---

### 2. Terraform-State-Key
**Zweck:** Lese-/Schreibzugriff auf den OpenTofu-State im S3-Bucket `openzirndorf-tfstate`

| Wo | Variable |
|----|----------|
| `infra/backend.hcl` | `access_key`, `secret_key` |
| GitHub Actions Secrets | `TF_STATE_ACCESS_KEY`, `TF_STATE_SECRET_KEY` |

IAM-Application in Scaleway: `terraform-state` mit `ObjectStorageFullAccess`

**Rotieren:**
1. Scaleway Console → IAM → API Keys → neuen Key für Application `terraform-state`
2. `infra/backend.hcl` aktualisieren
3. GitHub Secrets aktualisieren
4. `tofu init -backend-config=backend.hcl` (kein `-migrate-state` nötig)
5. Alten Key löschen

---

### 3. Datenbank-IAM-Key
**Zweck:** Verbindung zwischen Serverless Container und Serverless SQL DB

| Wo | |
|----|-|
| Scaleway IAM | Application `flohmarkt-db` |
| Container-Env | `DATABASE_URL` (secret, von OpenTofu gesetzt) |

Dieser Key wird vollständig von OpenTofu verwaltet — nie manuell anfassen.

**Rotieren:**
```bash
cd infra
tofu destroy -target=scaleway_iam_api_key.flohmarkt_db
tofu apply
```
OpenTofu erstellt einen neuen Key und aktualisiert `DATABASE_URL` im Container automatisch.

---

### 4. Admin-Token
**Zweck:** Authentifizierung für Admin-API-Endpunkte. Wird im Admin-Panel eingegeben (`#admin`), nicht ins JS-Bundle gebaut.

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `admin_token` |
| Container-Env | `ADMIN_TOKEN` (secret, von OpenTofu) |

**Rotieren:**
```bash
openssl rand -base64 32   # neuen Token generieren
# in terraform.tfvars eintragen, dann:
cd infra && tofu apply
```

---

### 5. API-Credentials (Basic Auth)
**Zweck:** Schützt `POST /stands`. Wird beim Frontend-Build in das JS-Bundle eingebaut.

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `api_username`, `api_password` |
| Container-Env | `API_USERNAME`, `API_PASSWORD` (secret, von OpenTofu) |
| GitHub Actions Secrets | `VITE_API_USERNAME`, `VITE_API_PASSWORD` |

**Rotieren:**
```bash
openssl rand -base64 32   # neues Passwort generieren
```
1. `terraform.tfvars` aktualisieren → `tofu apply`
2. GitHub Secret `VITE_API_PASSWORD` aktualisieren
3. Frontend-Deploy neu triggern (Actions → Deploy Frontend → Run workflow)

---

### 6. SMTP / Transactional Email
**Zweck:** Bestätigungsmail-Versand via Scaleway TEM

| Einstellung | Wert | Herkunft |
|-------------|------|----------|
| `SMTP_HOST` | `smtp.tem.scaleway.com` | hardcoded in `main.tf` |
| `SMTP_PORT` | `465` (SSL) | hardcoded in `main.tf` |
| `SMTP_USER` | Project ID | automatisch aus Gruppe 1 |
| `SMTP_PASSWORD` | Secret Key | automatisch aus Gruppe 1 |
| `SMTP_FROM` | `noreply@automail.openzirndorf.de` | `terraform.tfvars` → `smtp_from` |

Rotiert automatisch mit Gruppe 1. Die Absenderdomain `automail.openzirndorf.de` muss in Scaleway Console → Transactional Email als verifizierte Domain eingetragen sein (SPF + DKIM im DNS).

SMTP-Konfiguration live prüfen:
```bash
curl -H "Authorization: Bearer TOKEN" https://api.openzirndorf.de/stands/debug/smtp
```

---

## Lokale Entwicklung

### Voraussetzungen

```bash
# OpenTofu
curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh | sh -s -- --install-method deb

# Python 3.12
sudo apt install python3.12-venv

# Node.js 22
curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22

# PostgreSQL-Client
sudo apt install postgresql-client

# pre-commit (Secret-Scanning vor jedem Commit)
pip install pre-commit && pre-commit install
```

### Backend

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Lokale Konfiguration (gitignored)
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://USER:PASS@HOST:5432/fastapi-db?sslmode=require
API_USERNAME=flohmarkt
API_PASSWORD=lokales-testpasswort
ADMIN_TOKEN=lokaler-admintoken
EOF

uvicorn app.main:app --reload --env-file .env.local --port 8080
# → http://localhost:8080/health  →  {"ok": true}
```

`DATABASE_URL` der Scaleway-Datenbank:
```bash
cd infra && tofu output -raw database_connection_string
```

### Frontend

```bash
cd frontend
npm install

cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:8080
VITE_API_USERNAME=flohmarkt
VITE_API_PASSWORD=lokales-testpasswort
EOF

npm run dev
# → http://localhost:5173/
```

---

## Infrastruktur-Änderungen (OpenTofu)

```bash
cd infra

# Beim ersten Checkout: backend.hcl anlegen (Werte aus GitHub Secrets TF_STATE_*)
cat > backend.hcl << 'EOF'
access_key = "..."
secret_key = "..."
EOF

tofu init -backend-config=backend.hcl
tofu plan
tofu apply
```

---

## Deployment

### Automatisch (bei Push auf `main`)

| Geänderte Pfade | Workflow | Aktion |
|-----------------|----------|--------|
| `frontend/**` | `deploy-frontend.yml` | Build + GitHub Pages |
| `app/**`, `Dockerfile`, `pyproject.toml` | `deploy-backend.yml` | Docker Build + Push + Container-Redeploy |

### Manuell triggern

GitHub → Actions → Workflow → **Run workflow**

---

## API-Referenz

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| `GET` | `/health` | – | Statuscheck |
| `GET` | `/stands` | – | Freigegebene Stände |
| `GET` | `/stands/geojson` | – | GeoJSON für die Karte |
| `POST` | `/stands/` | Basic Auth | Stand einreichen |
| `GET` | `/stands/confirm/{token}` | – | E-Mail bestätigen |
| `GET` | `/stands/by-token/{token}` | – | Eigenen Stand abrufen |
| `PATCH` | `/stands/by-token/{token}` | – | Eigenen Stand bearbeiten |
| `DELETE` | `/stands/by-token/{token}` | – | Eigenen Stand zurückziehen |
| `GET` | `/stands/admin` | Bearer | Alle Stände inkl. PENDING |
| `POST` | `/stands/{id}/approve` | Bearer | Stand freigeben |
| `PATCH` | `/stands/{id}` | Bearer | Stand bearbeiten (Admin) |
| `DELETE` | `/stands/{id}` | Bearer | Stand löschen (Admin) |
| `GET` | `/stands/debug/smtp` | Bearer | SMTP-Konfiguration prüfen |

```bash
# Stand freigeben
curl -X POST -H "Authorization: Bearer TOKEN" https://api.openzirndorf.de/stands/1/approve

# Alle Stände ansehen (inkl. PENDING/CONFIRMED)
curl -H "Authorization: Bearer TOKEN" https://api.openzirndorf.de/stands/admin

# Direkte DB-Abfrage
cd infra && psql "$(tofu output -raw database_connection_string)"
```

```sql
-- Offene Anmeldungen
SELECT id, name, adresse, status, created_at FROM stands WHERE status != 'APPROVED';

-- Stand löschen
DELETE FROM stands WHERE id = 42;

-- Statistik
SELECT status, count(*) FROM stands GROUP BY status;
```

</details>
