# Garagenflohmarkt – Frontend

React-App für den Garagenflohmarkt Zirndorf.
Zeigt eine Karte mit allen angemeldeten Ständen, ein Formular zum Anmelden und eine Admin-UI.

Deployed auf GitHub Pages unter:
`https://openzirndorf.github.io/garagenflohmarkt2.0/`

---

## Inhaltsverzeichnis

1. [Was ist was?](#was-ist-was)
2. [Lokale Entwicklung](#lokale-entwicklung)
3. [Deployen](#deployen)
4. [Umgebungsvariablen](#umgebungsvariablen)
5. [Admin-UI](#admin-ui)
6. [Anti-Spam-Maßnahmen](#anti-spam-maßnahmen)

---

## Was ist was?

```
frontend/
├── src/
│   ├── main.tsx                  ← Einstiegspunkt (#admin → AdminPanel, sonst App)
│   ├── api.ts                    ← Alle Anfragen ans Backend
│   ├── ui.tsx                    ← Einfache UI-Komponenten (kein externes UI-Paket)
│   ├── types.ts                  ← TypeScript-Typdefinitionen
│   └── components/
│       ├── flohmarkt-app.tsx     ← Hauptkomponente (koordiniert alles)
│       ├── flohmarkt-map.tsx     ← Interaktive Karte (MapLibre + OpenFreeMap)
│       ├── stand-form.tsx        ← Formular zum Anmelden eines Stands
│       ├── stand-liste.tsx       ← Liste aller freigegebenen Stände
│       ├── mein-stand.tsx        ← Zeigt den eigenen Stand (aus localStorage)
│       └── admin-panel.tsx       ← Admin-UI zum Freigeben von Ständen
├── public/
│   ├── favicon.svg               ← Browser-Tab-Icon
│   └── icon.svg                  ← PWA-Icon
├── .env.local                    ← Lokale Einstellungen (NICHT ins Git!)
├── .env.production               ← Produktionseinstellungen
├── vite.config.ts                ← Build-Konfiguration (inkl. PWA)
└── package.json                  ← Abhängigkeiten & Skripte
```

**Wichtige Begriffe für Einsteiger:**
- **React** – JavaScript-Framework zum Bauen von Benutzeroberflächen
- **Vite** – Build-Tool, das den React-Code für den Browser vorbereitet
- **MapLibre** – Open-Source Karten-Bibliothek (wie Google Maps, aber kostenlos)
- **PWA** – Progressive Web App: die Seite lässt sich auf dem Handy wie eine App installieren
- **Tailwind CSS** – CSS-Framework zum schnellen Gestalten von Benutzeroberflächen
- **GitHub Pages** – kostenloser Hosting-Dienst von GitHub für statische Webseiten

---

## Lokale Entwicklung

```bash
# 1. In den frontend-Ordner wechseln
cd frontend

# 2. Abhängigkeiten installieren (einmalig oder nach package.json-Änderungen)
npm install

# 3. .env.local anlegen (einmalig)
cat > .env.local << EOF
VITE_API_URL=http://localhost:8080
VITE_API_USERNAME=flohmarkt
VITE_API_PASSWORD=GLEICHER_WERT_WIE_IN_BACKEND_.env.local
EOF

# 4. Frontend starten
npm run dev
# → http://localhost:5173/

# Das Backend muss separat laufen (siehe ../README.md)
```

---

## Deployen

Das Deployen passiert **automatisch** bei jedem Push auf `main`, wenn Dateien in `frontend/`
geändert wurden (gesteuert durch GitHub Actions).

### Einmalige Einrichtung (nur beim ersten Mal)

**1. GitHub Pages aktivieren:**

`https://github.com/openzirndorf/garagenflohmarkt2.0/settings/pages`
→ Source: **GitHub Actions** auswählen → Speichern

**2. GitHub Secrets anlegen:**

`https://github.com/openzirndorf/garagenflohmarkt2.0/settings/secrets/actions`
→ **New repository secret** für jedes der folgenden:

| Secret-Name | Wert |
|-------------|------|
| `VITE_API_USERNAME` | `flohmarkt` |
| `VITE_API_PASSWORD` | Gleiches Passwort wie `api_password` in `terraform.tfvars` |

> **Warum Secrets?** Das Passwort soll nicht im Git-Repository sichtbar sein.
> GitHub Actions injiziert es unsichtbar beim Bauen der App.

**3. Fertig!** Ab jetzt deployt jeder Push automatisch.

### Manuell deployen (ohne Code-Änderung)

`https://github.com/openzirndorf/garagenflohmarkt2.0/actions/workflows/deploy-frontend.yml`
→ **Run workflow** klicken

---

## Umgebungsvariablen

| Variable | Beschreibung | Wo gesetzt |
|----------|-------------|------------|
| `VITE_API_URL` | URL des Backends | `.env.local` / `.env.production` |
| `VITE_API_USERNAME` | Basic-Auth Benutzername | `.env.local` / GitHub Secret |
| `VITE_API_PASSWORD` | Basic-Auth Passwort | `.env.local` / GitHub Secret |
| `BASE_PATH` | URL-Pfad der App (z.B. `/garagenflohmarkt2.0/`) | GitHub Actions / `.env.production` |

> **Wichtig:** Variablen die mit `VITE_` beginnen werden ins JavaScript-Bundle eingebaut
> und sind damit im Browser sichtbar. Niemals echte Geheimnisse (Datenbankpasswörter,
> Admin-Token) als `VITE_`-Variable setzen.

---

## Admin-UI

Die Admin-UI ist erreichbar unter:
`https://openzirndorf.github.io/garagenflohmarkt2.0/#admin`

Dort kannst du:
- Ausstehende Stände (Status `PENDING`) einsehen
- Stände mit einem Klick freischalten

Als Login-Token den `ADMIN_TOKEN` aus `infra/terraform.tfvars` verwenden.
Dieser Token wird nur im Browser eingegeben – er ist **niemals** im Code oder Bundle.

---

## Anti-Spam-Maßnahmen

Das Formular enthält folgende Schutzmaßnahmen gegen automatisierte Einreichungen:

| Maßnahme | Wo | Beschreibung |
|----------|----|--------------|
| **Honeypot** | Frontend + Backend | Verstecktes `website`-Feld – Bots füllen es aus, Menschen nicht |
| **Zeitprüfung** | Frontend | Einreichung unter 3 Sekunden nach Laden wird abgelehnt |
| **Rate-Limiting** | Backend | Max. 3 Einreichungen pro IP pro Stunde |
| **Basic Auth** | Backend | POST /stands erfordert Credentials aus dem Build |
