# Garagenflohmarkt Zirndorf

Dieses Repository enthält die gesamte Anwendung für den Garagenflohmarkt Zirndorf:

- **`frontend/`** – React-App (Karte, Anmeldeformular, Admin-UI)
- **`app/`** – FastAPI-Backend (REST-API, Datenbankzugriff)
- **`infra/`** – Cloud-Infrastruktur als Code (Scaleway via OpenTofu)

Live unter: `https://openzirndorf.github.io/garagenflohmarkt2.0/`

---

## Inhaltsverzeichnis

1. [Was ist was?](#was-ist-was)
2. [Voraussetzungen](#voraussetzungen)
3. [Lokale Entwicklung](#lokale-entwicklung)
4. [Infrastruktur aufbauen (einmalig)](#infrastruktur-aufbauen-einmalig)
5. [Deployen](#deployen)
6. [API-Übersicht](#api-übersicht)
7. [Wartung & Updates](#wartung--updates)

---

## Was ist was?

```
garagenflohmarkt2.0/
├── frontend/             ← React-App (wird auf GitHub Pages deployt)
│   ├── src/
│   │   ├── main.tsx      ← Einstiegspunkt (auch Admin-UI via #admin)
│   │   ├── api.ts        ← Alle Anfragen ans Backend
│   │   ├── ui.tsx        ← Einfache UI-Komponenten (Button, Card, …)
│   │   ├── types.ts      ← TypeScript-Typdefinitionen
│   │   └── components/
│   │       ├── flohmarkt-app.tsx   ← Hauptansicht (Karte + Liste + Formular + Header + Footer)
│   │       ├── flohmarkt-map.tsx   ← Interaktive Karte (MapLibre)
│   │       ├── stand-form.tsx      ← Formular zum Anmelden eines Stands
│   │       ├── stand-liste.tsx     ← Liste aller freigegebenen Stände
│   │       ├── mein-stand.tsx      ← "Dein Stand" (aus Browser-Speicher)
│   │       ├── faq.tsx             ← Regeln & FAQ (erreichbar via #faq)
│   │       ├── impressum.tsx       ← Impressum
│   │       └── admin-panel.tsx     ← Admin-UI (erreichbar via #admin)
│   └── README.md         ← Frontend-spezifische Dokumentation
│
├── app/                  ← Python-Code (FastAPI)
│   ├── main.py           ← App-Einstiegspunkt, CORS-Einstellungen
│   ├── auth.py           ← Authentifizierung (Basic Auth + Bearer Token)
│   ├── database.py       ← Datenbankverbindung (asyncpg)
│   ├── geocode.py        ← Adresse → GPS-Koordinaten (OpenStreetMap)
│   └── routes/
│       └── stands.py     ← Alle API-Endpunkte + Rate-Limiter + Honeypot
│
├── infra/                ← Infrastruktur als Code (OpenTofu/Terraform)
│   ├── main.tf           ← Alle Scaleway-Ressourcen
│   ├── variables.tf      ← Eingabevariablen
│   ├── outputs.tf        ← Ausgabewerte nach dem Anlegen
│   ├── terraform.tfvars.example  ← Vorlage für Zugangsdaten
│   └── terraform.tfvars  ← Deine geheimen Zugangsdaten (NICHT ins Git!)
│
├── schema.sql            ← Datenbankstruktur
├── Dockerfile            ← Bauanleitung für das Docker-Image
└── pyproject.toml        ← Python-Abhängigkeiten
```

**Wichtige Begriffe für Einsteiger:**
- **React** – JavaScript-Framework zum Bauen von Benutzeroberflächen
- **FastAPI** – Python-Framework zum Bauen von Web-APIs
- **Docker** – verpackt die App so, dass sie überall gleich läuft
- **OpenTofu** – legt Cloud-Ressourcen automatisch an (Datenbank, Container usw.)
- **Scaleway** – der Cloud-Anbieter (wie AWS, aber europäisch und DSGVO-konform)
- **Serverless** – die App läuft nur wenn jemand sie aufruft, kostet sonst nichts
- **GitHub Actions** – automatisiert das Bauen und Deployen bei jedem Git-Push

---

## Voraussetzungen

Alles einmalig installieren:

```bash
# 1. Docker (für Image bauen & pushen)
sudo apt install docker.io
sudo usermod -aG docker $USER
# → Terminal neu starten damit die Gruppe aktiv wird

# 2. OpenTofu (verwaltet die Cloud-Infrastruktur)
curl --proto '=https' --tlsv1.2 -fsSL https://get.opentofu.org/install-opentofu.sh \
  | sh -s -- --install-method deb

# 3. psql (PostgreSQL-Client, um die Datenbank einzurichten)
sudo apt install postgresql-client

# 4. Python venv (für lokale Backend-Entwicklung)
sudo apt install python3.12-venv

# 5. Node.js 22 (für lokale Frontend-Entwicklung)
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 22 && fnm use 22
```

---

## Lokale Entwicklung

### Backend

```bash
# 1. Python-Umgebung anlegen und aktivieren
python3 -m venv .venv
source .venv/bin/activate
# → Das Terminal zeigt jetzt (.venv) am Anfang

# 2. Abhängigkeiten installieren
pip install -e ".[dev]"

# 3. .env.local anlegen
cat > .env.local << EOF
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require
API_USERNAME=flohmarkt
API_PASSWORD=mein-lokales-testpasswort
ADMIN_TOKEN=mein-lokaler-admintoken
EOF

# 4. Server starten
uvicorn app.main:app --reload --env-file .env.local --port 8080
# → http://localhost:8080/health sollte {"ok":true} zurückgeben
```

### Frontend

```bash
cd frontend

# Abhängigkeiten installieren (einmalig)
npm install

# .env.local anlegen
cat > .env.local << EOF
VITE_API_URL=http://localhost:8080
VITE_API_USERNAME=flohmarkt
VITE_API_PASSWORD=mein-lokales-testpasswort
EOF

# Entwicklungsserver starten
npm run dev
# → http://localhost:5173/
```

→ Ausführlichere Frontend-Dokumentation: [frontend/README.md](frontend/README.md)

---

## Infrastruktur aufbauen (einmalig)

Dieser Schritt legt alles in Scaleway an: Datenbank, Container-Registry, Container.
**Nur einmal nötig** – danach nur noch [deployen](#deployen).

### Schritt 1 – Scaleway Zugangsdaten holen

> **Hinweis:** Hier erstellst du einen Key **für dich selbst** (damit OpenTofu in deinem
> Namen arbeiten darf). Den Key für die Datenbank-App (`flohmarkt-db`) legt OpenTofu
> automatisch an — den musst du nicht manuell erstellen.

1. Auf [console.scaleway.com](https://console.scaleway.com) einloggen
2. **IAM → API Keys → Generate API Key** klicken
3. **"Select API key bearer"** → **Myself (IAM user)** auswählen
4. Ablaufdatum setzen (max. 1 Jahr)
5. **"Will this API key be used for Object Storage?"** → **No, skip for now**
6. **Generate API Key** klicken
7. Auf der nächsten Seite (Credentials Usage) die Berechtigungen setzen:
   - `ContainerRegistryFullAccess`
   - `ServerlessContainersFullAccess`
   - `ServerlessSQLDatabaseFullAccess`
   - `IAMFullAccess`
8. **Access Key** und **Secret Key** notieren — der Secret Key wird nur einmal angezeigt!
9. **Project ID** finden: linke Seitenleiste → Projektname → Settings

### Schritt 2 – terraform.tfvars anlegen

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
```

Datei öffnen und ausfüllen:

```hcl
scw_access_key      = "SCWXXXXXXXXXXXXXXXXX"
scw_secret_key      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
scw_project_id      = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
admin_token         = "..."   # Ausgabe von: openssl rand -base64 32
api_username        = "flohmarkt"
api_password        = "..."   # Ausgabe von: openssl rand -base64 32
container_image_tag = "latest"
```

Starke Passwörter generieren:
```bash
openssl rand -base64 32
```

### Schritt 3 – Phase 1: Datenbank und Registry anlegen

```bash
cd infra
tofu init   # einmalig: lädt den Scaleway-Provider herunter

tofu apply \
  -target=scaleway_sdb_sql_database.flohmarkt \
  -target=scaleway_registry_namespace.flohmarkt \
  -target=scaleway_container_namespace.flohmarkt_ns \
  -target=scaleway_iam_application.flohmarkt_db \
  -target=scaleway_iam_api_key.flohmarkt_db \
  -target=scaleway_iam_policy.flohmarkt_db
```

Mit `yes` bestätigen. OpenTofu legt an:
- PostgreSQL-Datenbank
- Container-Registry (Speicher für Docker-Images)
- Container-Namespace
- Datenbank-Nutzer (IAM Application + API Key)

### Schritt 4 – Datenbankstruktur einspielen

```bash
# Verbindungsdaten aus OpenTofu lesen und Tabellen anlegen
psql "$(tofu output -raw database_connection_string)" -f ../schema.sql
```

Erwartete Ausgabe:
```
CREATE EXTENSION
CREATE TABLE
CREATE INDEX
```

### Schritt 5 – Docker Image bauen und hochladen

```bash
REGISTRY=$(tofu output -raw registry_endpoint)

# Bei der Scaleway Registry einloggen
docker login rg.fr-par.scw.cloud \
  -u nologin \
  -p $(grep scw_secret_key terraform.tfvars | cut -d'"' -f2)

# Image bauen (aus dem infra-Ordner heraus, daher "..")
docker build -t $REGISTRY/flohmarkt-api:latest ..

# Image hochladen
docker push $REGISTRY/flohmarkt-api:latest
```

### Schritt 6 – Phase 2: Container deployen

```bash
tofu apply
# Mit "yes" bestätigen
```

Die API-URL aus der Ausgabe notieren:
```
api_url = "https://openzirndorfcouyb8pc-flohmarkt-api.functions.fnc.fr-par.scw.cloud"
```

### Schritt 7 – GitHub Secrets anlegen

`https://github.com/openzirndorf/garagenflohmarkt2.0/settings/secrets/actions`
→ **New repository secret** für jedes der folgenden:

| Secret-Name | Wert |
|-------------|------|
| `VITE_API_USERNAME` | Wert von `api_username` aus `terraform.tfvars` |
| `VITE_API_PASSWORD` | Wert von `api_password` aus `terraform.tfvars` |
| `SCW_ACCESS_KEY` | Wert von `scw_access_key` aus `terraform.tfvars` |
| `SCW_SECRET_KEY` | Wert von `scw_secret_key` aus `terraform.tfvars` |
| `SCW_PROJECT_ID` | Wert von `scw_project_id` aus `terraform.tfvars` |

### Schritt 8 – GitHub Pages aktivieren

`https://github.com/openzirndorf/garagenflohmarkt2.0/settings/pages`
→ Source: **GitHub Actions** → Speichern

---

## Deployen

### Frontend (automatisch)

Das Frontend deployt **automatisch** bei jedem Push auf `main` wenn Dateien in `frontend/` geändert wurden.

Manuell triggern:
`https://github.com/openzirndorf/garagenflohmarkt2.0/actions/workflows/deploy-frontend.yml`
→ **Run workflow**

### Backend (automatisch)

Das Backend deployt **automatisch** bei jedem Push auf `main` wenn Dateien in `app/`, `Dockerfile`
oder `pyproject.toml` geändert wurden. Die Pipeline:

1. Baut das Docker Image
2. Pusht es nach `rg.fr-par.scw.cloud/openzirndorf-flohmarkt/flohmarkt-api:latest`
3. Deployt den Scaleway Serverless Container neu

Manuell triggern:
`https://github.com/openzirndorf/garagenflohmarkt2.0/actions/workflows/deploy-backend.yml`
→ **Run workflow**

---

## API-Übersicht

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/health` | – | Statuscheck |
| GET | `/stands` | – | Alle freigegebenen Stände |
| GET | `/stands/geojson` | – | Stände als GeoJSON für die Karte |
| POST | `/stands` | Basic Auth | Stand anmelden (landet als PENDING) |
| GET | `/stands/by-token/{token}` | – | Eigenen Stand abrufen (Token = Auth) |
| DELETE | `/stands/by-token/{token}` | – | Eigenen Stand zurückziehen |
| GET | `/stands/admin` | Bearer Token | Alle Stände inkl. PENDING |
| POST | `/stands/{id}/approve` | Bearer Token | Stand freigeben |

**Stand freigeben** (Admin-Token aus `terraform.tfvars`, Admin-UI unter `#admin`):
```bash
curl -X POST \
  -H "Authorization: Bearer DEIN_ADMIN_TOKEN" \
  https://openzirndorfcouyb8pc-flohmarkt-api.functions.fnc.fr-par.scw.cloud/stands/1/approve
```

**Alle eingereichten Stände ansehen:**
```bash
curl -H "Authorization: Bearer DEIN_ADMIN_TOKEN" \
  https://openzirndorfcouyb8pc-flohmarkt-api.functions.fnc.fr-par.scw.cloud/stands/admin
```

---

## Wartung & Updates

**Datenbank direkt abfragen:**
```bash
cd infra
psql "$(tofu output -raw database_connection_string)"
# Beispiele:
# SELECT * FROM stands WHERE status = 'PENDING';
# SELECT count(*) FROM stands;
# DELETE FROM stands WHERE id = 42;
```

**Logs ansehen:**
Scaleway Dashboard → Serverless Containers → `flohmarkt-api` → Logs

**API-Token rotieren** (z.B. bei Verdacht auf Missbrauch):
1. Neues Passwort generieren: `openssl rand -base64 32`
2. In `terraform.tfvars` eintragen
3. `tofu apply` ausführen
4. GitHub Secret `VITE_API_PASSWORD` aktualisieren
5. Frontend-Deploy neu triggern (manuell in GitHub Actions)
