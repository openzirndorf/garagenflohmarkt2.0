<p align="center">
  <img src="docs/logo.png" alt="Garagenflohmarkt Zirndorf" width="320">
</p>

# Garagenflohmarkt Zirndorf

Der **Garagenflohmarkt Zirndorf** ist ein jährliches Stadtteilfest, bei dem Anwohnerinnen und Anwohner ihre Garagen, Einfahrten und Vorgärten in kleine Verkaufsstände verwandeln. Die ganze Stadt wird zur Flohmarktmeile.

Diese App macht es einfach, mitzumachen und den Überblick zu behalten:

- **Stand anmelden** — Adresse, kurze Beschreibung und Kategorie eintragen, E-Mail bestätigen, fertig. Der Stand erscheint nach kurzer Freigabe auf der Karte, unter der eigenen Adresse statt des echten Namens.
- **Karte** — Alle freigegebenen Stände auf einer interaktiven Karte, filterbar nach Kategorien (Kleidung, Spielzeug, Bücher …)
- **Eigenen Stand verwalten** — Beschreibung ändern oder den Stand jederzeit vollständig löschen, ohne Konto/Passwort: ein eintippbarer Code aus der Mail loggt für eine Sitzung ein (bewusst kein Link, siehe unten); verloren gegangen ist er nicht schlimm, ein neuer lässt sich jederzeit anfordern.

Die App ist kostenlos, ohne Account und ohne Tracking nutzbar.

**→ [openzirndorf.github.io/garagenflohmarkt2.0](https://openzirndorf.github.io/garagenflohmarkt2.0/)**

---

<details>
<summary><strong>Technische Dokumentation</strong> (für Entwicklerinnen und Entwickler)</summary>

---

## Architektur

```
Browser
  ├── GitHub Pages (React-SPA, statisch)
  │     └── Object Storage: stands.json / stands.geojson
  │           (öffentliche Karte liest direkt hier - kein DB-Zugriff,
  │            übersteht einen Ausfall von Backend/DB)
  └── https://api.openzirndorf.de  (nur Anmeldung, Login, Verwaltung, Admin)
        └── Scaleway Serverless Container (FastAPI, Docker)
              ├── Scaleway Datenbank-Instanz (PostgreSQL, RDB)
              └── Scaleway Object Storage (Artefakt-Upload)

Scaleway Serverless Jobs (Cron, kein Container-Dauerbetrieb):
  ├── alle 5 Min:  Karten-Artefakt neu erzeugen (Sicherheitsnetz)
  └── täglich 03:00: Löschjob (ab 07.10.2026 - siehe unten)
```

```
garagenflohmarkt2.0/
├── frontend/          React-App (Karte, Formular, Admin-UI)
│   └── src/
│       ├── api.ts                  API-Client (liest Karte primär vom Storage)
│       ├── types.ts                TypeScript-Typen
│       ├── lib/stand-popup.ts      Popup-Inhalt (XSS-sicher, DOM statt HTML-String)
│       └── components/
│           ├── flohmarkt-app.tsx   Hauptansicht, Hash-Routing
│           ├── flohmarkt-map.tsx   MapLibre-Karte
│           ├── map-or-list.tsx     Fällt bei Kartenfehler auf Listenansicht zurück
│           ├── stand-form.tsx      Anmeldeformular
│           ├── stand-liste.tsx     Standliste
│           ├── mein-stand.tsx      Eigener Stand (Login-Code → Session-Token)
│           ├── admin-panel.tsx     Admin-UI (#admin)
│           ├── footer.tsx          Unterstützer-Zeile, Social-Links
│           ├── impressum.tsx       #impressum
│           └── datenschutz.tsx     #datenschutz
├── app/               FastAPI-Backend
│   ├── main.py           App-Einstiegspunkt, CORS
│   ├── auth.py            Basic Auth (API) + Bearer Token (Admin)
│   ├── database.py        asyncpg-Connection-Pool
│   ├── email.py            Magic-Link-Mail via Scaleway TEM
│   ├── geocode.py          Adresse → GPS (OpenCage, Fallback: Nominatim)
│   ├── tokens.py           Login-/Session-Token: erzeugen, hashen, prüfen
│   ├── nicknames.py        Serverseitige Nickname-Generierung (fränkisch)
│   ├── rate_limit.py       DB-gestütztes Ratelimiting (überlebt Multi-Instance)
│   ├── public_fields.py    Positivliste öffentlicher Felder (eine Quelle der Wahrheit)
│   ├── jobs/
│   │   └── stands_artifact.py  Baut/lädt stands.json+geojson hoch, Cron + inline
│   └── routes/
│       └── stands.py       Alle Endpunkte
├── migrations/         Nummerierte SQL-Dateien, per scripts/migrate.py angewendet
├── scripts/
│   ├── migrate.py                  Wendet ausstehende Migrationen an (manuell)
│   ├── deletion_job.py              Löscht alles ab dem 07.10.2026 (Cron)
│   └── purge_scaleway_backups.sh    Räumt DB-Backups danach manuell weg
├── tiles/              Anleitung + Ablage für selbstgehostete Kartenkacheln (PMTiles)
├── infra/              OpenTofu (Scaleway-Infrastruktur)
│   ├── main.tf         Ressourcen (RDB, Object Storage, Container, Jobs) + S3-Backend
│   ├── variables.tf    Eingabevariablen
│   ├── outputs.tf      Ausgabewerte
│   ├── terraform.tfvars          Secrets (gitignored)
│   ├── terraform.tfvars.example  Vorlage
│   └── backend.hcl               State-Credentials (gitignored)
└── Dockerfile          Multi-Stage (builder + runner)
```

**Ablauf einer Stand-Anmeldung:**
1. Nutzer füllt Formular aus → `POST /stands` (Basic Auth) — kein Namensfeld, nur Adresse/Beschreibung/Kategorien/E-Mail
2. Backend geocodiert die Adresse via OpenCage (Fallback lokal: Nominatim), vergibt einen Nickname (intern, öffentlich auf Karte/Liste erscheint stattdessen die Adresse)
3. Stand landet als `PENDING` in der Datenbank, ein befristeter, einmaliger Login-Link geht per Mail raus
4. Klick auf den Link → Bestätigungsseite ("Bist du das?", verbraucht den Link noch nicht) → "Ja, einloggen" → Stand wird `APPROVED`, ein Session-Token für diese Sitzung wird ausgestellt
5. Das Karten-Artefakt wird im Hintergrund neu erzeugt (`app/jobs/stands_artifact.py`) und auf Object Storage hochgeladen — die Karte zeigt den Stand kurz danach
6. Verwalten/Zurückziehen später jederzeit über einen neu angeforderten Login-Link (`POST /stands/request-login`, kein Account nötig)

---

## Credentials

Das Projekt hat sechs Credential-Gruppen:

### 1. Scaleway Haupt-API-Key
**Zweck:** OpenTofu verwaltet damit alle Scaleway-Ressourcen (Datenbank, Container, IAM …). Dieselben Keys dienen dem Container auch als S3-Zugangsdaten für Object Storage (`S3_ACCESS_KEY`/`S3_SECRET_KEY`) — Scaleway nutzt dafür direkt die Projekt-API-Keys, kein eigenes IAM-Setup nötig.

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

### 3. Datenbank-Passwort
**Zweck:** Verbindung zwischen Serverless Container und der Datenbank-Instanz (`scaleway_rdb_instance`, kein Serverless SQL mehr — siehe unten)

| Wo | Variable |
|----|----------|
| `infra/terraform.tfvars` | `db_password` |
| Container-Env | `DATABASE_URL` (secret, von OpenTofu aus `db_password` zusammengebaut) |

**Rotieren:**
```bash
openssl rand -base64 32   # neues Passwort generieren
# in terraform.tfvars eintragen (db_password), dann:
cd infra && tofu apply
```

Bewusst eine reguläre Datenbank-Instanz statt Serverless SQL: Serverless SQL
hatte eine fixe, per Terraform nicht einstellbare 7-Tage-Backup-Aufbewahrung
— das kollidierte mit der Löschfrist zum 07.10.2026. Bei der regulären
Instanz ist `backup_schedule_retention` in `infra/main.tf` explizit gesetzt.

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

SMTP-Konfiguration live prüfen (verschickt eine Test-Mail):
```bash
curl -X POST -H "Authorization: Bearer TOKEN" "https://api.openzirndorf.de/stands/test-email?to=test@example.com"
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

# Lokale Postgres-Instanz, z.B. per Docker:
docker run -d --name flohmarkt-dev-pg -e POSTGRES_USER=flohmarkt \
  -e POSTGRES_PASSWORD=flohmarkt -e POSTGRES_DB=flohmarkt_dev \
  -p 5432:5432 postgres:16

# Lokale Konfiguration (gitignored)
cat > .env.local << 'EOF'
DATABASE_URL=postgresql://flohmarkt:flohmarkt@localhost:5432/flohmarkt_dev
API_USERNAME=flohmarkt
API_PASSWORD=lokales-testpasswort
ADMIN_TOKEN=lokaler-admintoken
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8080
EOF

# Migrationen anwenden (schema.sql gibt es nicht mehr, siehe migrations/)
set -a && source .env.local && set +a
python -m scripts.migrate

uvicorn app.main:app --reload --env-file .env.local --port 8080
# → http://localhost:8080/health  →  {"ok": true}
```

Ohne `STANDS_BUCKET`/`S3_*`-Variablen überspringt
`app/jobs/stands_artifact.py` die Artefakt-Regenerierung automatisch
(Log-Hinweis, kein Fehler) — lokal reicht das, die Live-Endpunkte
(`GET /stands`, `/stands/geojson`) funktionieren unabhängig davon.

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
# VITE_STATIC_BASE_URL bewusst leer lassen - ohne Bucket fällt api.ts
# automatisch auf die Live-API zurück (siehe Backend-Abschnitt oben)
EOF

npm run dev
# → http://localhost:5173/
```

### Tests

```bash
# Backend (braucht die lokale Postgres von oben, migriert)
TEST_DATABASE_URL=postgresql://flohmarkt:flohmarkt@localhost:5432/flohmarkt_dev \
  python -m pytest app/tests -v

# Frontend
cd frontend && npx vitest --run
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

### Pipeline-Stufen (bei Push auf `main`)

| Geänderte Pfade | Workflow | Stufen |
|-----------------|----------|--------|
| `frontend/**` | `deploy-frontend.yml` | Test (Lint+Typecheck+Vitest) → Build → **manuelle Freigabe** → GitHub Pages |
| `app/**`, `scripts/**`, `migrations/**`, `Dockerfile`, `pyproject.toml` | `deploy-backend.yml` | Test → Image bauen+pushen → Migrationen anwenden → **manuelle Freigabe** → Container-Deploy → Smoke-Test → automatischer Rollback bei Fehler |
| jeder Push/PR | `test.yml` | Lint, Typecheck, Backend-/Frontend-Tests, **Datenschutz-Tests als eigener Job** |
| jeder Push/PR | `security.yml` | Secret-Scan (Gitleaks), Dependency-Scan (pip-audit, npm audit, Trivy), IaC-Scan (Checkov) |

Kein Deploy ohne grüne Tests - beide Deploy-Workflows hängen am `test`-Job.
Die manuelle Freigabe läuft über ein GitHub Environment `production` mit
Required Reviewers; der Solo-Maintainer kann seine eigene Freigabe erteilen,
es ist kein zweiter Mensch nötig.

**Einmalige Einrichtung in GitHub** (Settings, nicht per Code):
1. Settings → Environments → `production` anlegen, **Required reviewers**
   aktivieren (dich selbst eintragen).
2. Settings → Branches → Branch-Schutzregel für `main`: Pull Request
   erzwingen, Required Status Checks: `lint`, `typecheck`, `backend-tests`,
   `privacy-tests`, `frontend-tests`, `gitleaks`, `pip-audit`, `npm-audit`,
   `trivy-fs`, `trivy-image` (Checkov bewusst nicht als Required Check -
   `soft_fail: true`, da Checkov kaum dedizierte Scaleway-Regeln hat und nur
   informativ mitläuft).
3. Settings → Secrets and variables → Actions → **Variables**:
   `VITE_STATIC_BASE_URL` (öffentliche Bucket-URL, kein Geheimnis) setzen,
   sobald `infra/main.tf` angewendet ist (`tofu output stands_bucket_url`).

Migrationen laufen automatisiert (`scripts/migrate.py` im `migrate`-Job),
aber ohne Downgrade-Mechanismus — reine Forward-Migrationen. Ein "Rollback"
im Smoke-Test-Schritt setzt das vorherige Container-Image zurück, macht aber
keine Schemaänderung rückgängig; bei einer inkompatiblen Schemaänderung
reicht ein reiner Image-Rollback allein nicht aus.

### Manuell triggern

GitHub → Actions → Workflow → **Run workflow**

---

## API-Referenz

Kein Namensfeld, keine permanenten Tokens: Zugriff auf den eigenen Stand
läuft über einen eintippbaren Login-Code (8 Zeichen, einmalig, befristet),
der gegen ein `session_token` (mehrfach nutzbar, befristet) eingetauscht
wird. Bewusst kein klickbarer Magic Link mehr - die App ist als PWA
installierbar, und ein Mail-Link öffnet dabei typischerweise nicht das
installierte PWA-Fenster (v.a. iOS Safari). Beide Geheimnisse werden nur
gehasht gespeichert.

| Methode | Pfad | Auth | Beschreibung |
|---------|------|------|--------------|
| `GET` | `/health` | – | Statuscheck |
| `GET` | `/stands` | – | Freigegebene Stände (Live-DB; primäre Quelle ist Object Storage, siehe `api.ts`) |
| `GET` | `/stands/geojson` | – | GeoJSON für die Karte (Live-DB, gleiches Prinzip) |
| `POST` | `/stands/` | Basic Auth | Stand einreichen, löst Code-Mail aus |
| `POST` | `/stands/request-login` | Basic Auth | Neuen Login-Code anfordern (E-Mail im Body) |
| `POST` | `/stands/redeem-code` | – | Code einlösen (einmalig), gibt `session_token` zurück |
| `GET` | `/stands/by-session/{session_token}` | – | Eigenen Stand abrufen |
| `GET` | `/stands/by-session/{session_token}/export` | – | Art. 15 DSGVO Selbstauskunft (inkl. E-Mail) |
| `PATCH` | `/stands/by-session/{session_token}` | – | Eigenen Stand bearbeiten (inkl. Standname wechseln) |
| `POST` | `/stands/by-session/{session_token}/nickname-suggestions` | – | 3 alternative Standnamen würfeln |
| `POST` | `/stands/by-session/{session_token}/lock-reply` | – | Antwort auf eine Inhalts-Sperre an den Admin schicken (nur bei `content_locked`) |
| `DELETE` | `/stands/by-session/{session_token}` | – | Eigenen Stand vollständig löschen |
| `POST` | `/stands/{id}/report` | – | Stand melden (Besucher, Grund per Mail an den Admin, nie gespeichert) |
| `GET` | `/stands/admin` | Bearer | Alle Stände inkl. PENDING (nie Tokens/Hashes) |
| `GET` | `/stands/admin/audit-log` | Bearer | Aktionsverlauf (Aktion + Stand-ID + Zeitstempel, kein Personenbezug) |
| `POST` | `/stands/{id}/approve` | Bearer | Stand manuell freigeben |
| `PATCH` | `/stands/{id}` | Bearer | Stand bearbeiten (Admin), inkl. `content_locked`/`content_lock_message` |
| `DELETE` | `/stands/{id}` | Bearer | Stand löschen (Admin) |
| `POST` | `/stands/test-email` | Bearer | SMTP-Konfiguration prüfen (Query-Param `to`) |

```bash
# Stand freigeben
curl -X POST -H "Authorization: Bearer TOKEN" https://api.openzirndorf.de/stands/1/approve

# Alle Stände ansehen (inkl. PENDING)
curl -H "Authorization: Bearer TOKEN" https://api.openzirndorf.de/stands/admin

# Direkte DB-Abfrage
cd infra && psql "$(tofu output -raw database_connection_string)"
```

```sql
-- Offene Anmeldungen
SELECT id, nickname, adresse, status, created_at FROM stands WHERE status != 'APPROVED';

-- Stand löschen
DELETE FROM stands WHERE id = 42;

-- Statistik
SELECT status, count(*) FROM stands GROUP BY status;
```

---

## Datenschutz-Automatisierung

- **Karten-Artefakt** (`app/jobs/stands_artifact.py`): wird inline nach
  jeder Änderung sowie per Cron alle 5 Minuten neu erzeugt und auf Object
  Storage hochgeladen (Sicherheitsnetz gegen verlorene Background-Tasks bei
  `min_scale = 0`).
- **Löschjob** (`scripts/deletion_job.py`, täglicher Cron): löscht ab dem
  **07.10.2026** alle Stände aus der Datenbank sowie alle zugehörigen
  Storage-Objekte. Kartenkacheln (`tiles/`) bleiben unangetastet.
- **Backup-Bereinigung** (`scripts/purge_scaleway_backups.sh`): manuell kurz
  nach dem Löschjob auszuführen, da automatische DB-Backups (Retention
  siehe `infra/main.tf`) den Löschtermin sonst knapp überschreiten könnten.
- **Tests**: `app/tests/test_stands_public_allowlist.py` prüft die
  öffentlichen Endpunkte gegen eine Positivliste erlaubter Felder;
  `app/tests/test_deletion_job.py` und `test_stands_artifact.py` decken die
  beiden Jobs ab.

</details>
