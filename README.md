# Flohmarkt API – Backend

FastAPI-Backend für den Garagenflohmarkt Zirndorf.
Läuft als Serverless Container auf Scaleway und spricht mit einer Serverless SQL Datenbank (PostgreSQL).

---

## Inhaltsverzeichnis

1. [Was ist was?](#was-ist-was)
2. [Voraussetzungen](#voraussetzungen)
3. [Lokale Entwicklung](#lokale-entwicklung)
4. [Infrastruktur aufbauen (einmalig)](#infrastruktur-aufbauen-einmalig)
5. [Backend deployen](#backend-deployen)
6. [API-Übersicht](#api-übersicht)
7. [Wartung & Updates](#wartung--updates)

---

## Was ist was?

```
garage-backend/
├── app/                  ← Python-Code (FastAPI)
│   ├── main.py           ← App-Einstiegspunkt, CORS-Einstellungen
│   ├── auth.py           ← Authentifizierung (Basic Auth + Bearer Token)
│   ├── database.py       ← Datenbankverbindung (asyncpg)
│   ├── geocode.py        ← Adresse → GPS-Koordinaten (OpenStreetMap)
│   └── routes/
│       └── stands.py     ← Alle API-Endpunkte
├── infra/                ← Infrastruktur als Code (OpenTofu/Terraform)
│   ├── main.tf           ← Alle Scaleway-Ressourcen
│   ├── variables.tf      ← Eingabevariablen
│   ├── outputs.tf        ← Ausgabewerte nach dem Anlegen
│   └── terraform.tfvars  ← Deine geheimen Zugangsdaten (NICHT ins Git!)
├── schema.sql            ← Datenbankstruktur
├── Dockerfile            ← Bauanleitung für das Docker-Image
└── pyproject.toml        ← Python-Abhängigkeiten
```

**Wichtige Begriffe für Einsteiger:**
- **FastAPI** – Python-Framework zum Bauen von Web-APIs
- **Docker** – verpackt die App so, dass sie überall gleich läuft
- **OpenTofu** – legt Cloud-Ressourcen automatisch an (Datenbank, Container usw.)
- **Scaleway** – der Cloud-Anbieter (wie AWS, aber europäisch)
- **Serverless** – die App läuft nur wenn jemand sie aufruft, kostet sonst nichts

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

# 4. Python venv (für lokale Entwicklung)
sudo apt install python3.12-venv
```

---

## Lokale Entwicklung

```bash
# 1. In den Ordner wechseln
cd garage-backend

# 2. Python-Umgebung anlegen und aktivieren
python3 -m venv .venv
source .venv/bin/activate
# → Das Terminal zeigt jetzt (.venv) am Anfang

# 3. Abhängigkeiten installieren
pip install -e ".[dev]"

# 4. .env.local anlegen
cat > .env.local << EOF
DATABASE_URL=postgresql://USER:PASS@HOST:5432/DBNAME?sslmode=require
PORT=8080
API_USERNAME=flohmarkt
API_PASSWORD=mein-lokales-testpasswort
ADMIN_TOKEN=mein-lokaler-admintoken
EOF

# 5. Server starten
uvicorn app.main:app --reload --env-file .env.local --port 8080
# → http://localhost:8080/health sollte {"ok":true} zurückgeben
```

---

## Infrastruktur aufbauen (einmalig)

Dieser Schritt legt alles in Scaleway an: Datenbank, Container-Registry, Container.
**Nur einmal nötig** – danach nur noch [Backend deployen](#backend-deployen).

### Schritt 1 – Scaleway Zugangsdaten holen

1. Auf [console.scaleway.com](https://console.scaleway.com) einloggen
2. **IAM → API Keys → Generate API Key**
3. Berechtigungen auswählen:
   - `ContainerRegistryFullAccess`
   - `ServerlessContainersFullAccess`
   - `ServerlessSQLDatabaseFullAccess`
   - `IAMFullAccess`
4. Access Key und Secret Key notieren
5. **Project ID** finden: linke Seitenleiste → Projektname → Settings

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

Ausgabe notieren:
```
container_url = "openzirndorf...-flohmarkt-api.functions.fnc.fr-par.scw.cloud"
api_domain    = "https://api.openzirndorf.de"
```

### Schritt 7 – DNS-Eintrag setzen

Beim DNS-Anbieter einen CNAME-Eintrag anlegen:

| Typ | Name | Ziel |
|-----|------|------|
| CNAME | `api` | Wert aus `container_url` |

### Schritt 8 – Testen

```bash
curl https://api.openzirndorf.de/health
# → {"ok":true}
```

---

## Backend deployen

Nach jeder Codeänderung:

```bash
cd /home/fabian/garage-backend

REGISTRY=rg.fr-par.scw.cloud/openzirndorf-flohmarkt

# Image neu bauen
docker build -t $REGISTRY/flohmarkt-api:latest .

# Image hochladen
docker push $REGISTRY/flohmarkt-api:latest

# Scaleway anweisen das neue Image zu laden
cd infra && tofu apply
```

---

## API-Übersicht

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| GET | `/health` | – | Statuscheck |
| GET | `/stands` | – | Alle freigegebenen Stände |
| GET | `/stands/geojson` | – | Stände als GeoJSON für die Karte |
| POST | `/stands` | Basic Auth | Stand anmelden (landet als PENDING) |
| GET | `/stands/admin` | Bearer Token | Alle Stände inkl. PENDING |
| POST | `/stands/{id}/approve` | Bearer Token | Stand freigeben |

**Stand freigeben** (Admin-Token aus `terraform.tfvars`):
```bash
curl -X POST \
  -H "Authorization: Bearer DEIN_ADMIN_TOKEN" \
  https://api.openzirndorf.de/stands/1/approve
```

**Alle eingereichten Stände ansehen:**
```bash
curl -H "Authorization: Bearer DEIN_ADMIN_TOKEN" \
  https://api.openzirndorf.de/stands/admin
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
```

**Logs ansehen:**
Scaleway Dashboard → Serverless Containers → `flohmarkt-api` → Logs

**API-Token rotieren** (z.B. bei Verdacht auf Missbrauch):
1. Neues Passwort generieren: `openssl rand -base64 32`
2. In `terraform.tfvars` eintragen
3. `tofu apply` ausführen
4. GitHub Secret `VITE_API_PASSWORD` aktualisieren
5. Neuen Frontend-Deploy triggern (leerer Commit oder manuell in GitHub Actions)
