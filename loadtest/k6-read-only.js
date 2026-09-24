// Lesender Nutzer-Lasttest für den Garagenflohmarkt (k6). Es gibt keine
// Staging-Umgebung - dieser Test läuft gegen Produktion und schickt deshalb
// AUSSCHLIESSLICH GET-Requests. Er legt keine Stände an, löst keine Mails aus
// und verbraucht kein Geocoding-Kontingent (kein POST /stands, keine Logins).
// Nicht angefragt werden Drittanbieter (Kartenkacheln von OpenFreeMap, Logo/
// Maskottchen von openzirndorf.de) - die gehören nicht uns.
//
// Was ein Besucher tatsächlich lädt (siehe frontend/src/api.ts):
//   - Erstbesucher: index.html + JS/CSS/Worker/Schriften aus dem Container
//   - alle: /launch-config (Container), dann Standliste + GeoJSON. Vorgesehen
//     ist der Object-Storage-Bucket (Manifest -> Liste/GeoJSON). Erlaubt der
//     Bucket der Seite per CORS den Zugriff nicht, fällt die App still auf die
//     Live-API zurück (/stands, /stands/geojson - Container + Datenbank). Das
//     Skript erkennt in setup() selbst, welcher Weg echte Browser nehmen
//     (DATA_SOURCE=bucket|api überschreibt das).
//   - ein Teil öffnet das Anmeldeformular: /settings (kleine DB-Abfrage)
//
// Aufruf (ohne k6-Installation, per Docker):
//   Smoke (1 Nutzer, 30 s, unkritisch):
//     docker run --rm -i grafana/k6 run - < loadtest/k6-read-only.js
//   Last (300 gleichzeitige Nutzer, ~10 min) - braucht CONFIRM=yes:
//     docker run --rm -i grafana/k6 run -e PROFILE=load -e CONFIRM=yes - < loadtest/k6-read-only.js
//   Weitere Profile: PROFILE=spike (plötzlicher Ansturm). Optional:
//     -e BASE_URL=... -e STATIC_BASE_URL=... -e NEW_VISITOR_RATIO=0.4 -e MAX_VUS=300
//
// Der Test bricht selbst ab, wenn mehr als 1 % der Requests fehlschlagen.
// Während des Laufs in der Scaleway-Konsole beobachten: Anzahl Container-
// Instanzen, CPU/RAM, DB-Verbindungen. Hinweis zu Kosten: ein Erstbesucher
// lädt ~0,5 MB (Brotli), ein wiederkehrender ~0,2 MB Daten aus dem Bucket -
// das Lastprofil erzeugt einige GB Egress.

import { check, group, sleep } from "k6";
import http from "k6/http";

const BASE_URL = (__ENV.BASE_URL || "https://garagenflohmarkt.openzirndorf.de").replace(/\/$/, "");
const STATIC_BASE_URL = (
  __ENV.STATIC_BASE_URL || "https://garagenflohmarkt-stands.s3.fr-par.scw.cloud"
).replace(/\/$/, "");
const PROFILE = __ENV.PROFILE || "smoke";
const MAX_VUS = Number.parseInt(__ENV.MAX_VUS || "300", 10);
const NEW_VISITOR_RATIO = Number.parseFloat(__ENV.NEW_VISITOR_RATIO || "0.4");
const FORM_OPENER_RATIO = 0.15;
const DATA_SOURCE_OVERRIDE = __ENV.DATA_SOURCE || "";

const PROFILES = {
  smoke: {
    executor: "constant-vus",
    vus: 1,
    duration: "30s",
  },
  load: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "1m", target: Math.round(MAX_VUS / 6) },
      { duration: "2m", target: Math.round(MAX_VUS / 2) },
      { duration: "2m", target: MAX_VUS },
      { duration: "3m", target: MAX_VUS },
      { duration: "1m", target: 0 },
    ],
    gracefulRampDown: "20s",
  },
  spike: {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      { duration: "20s", target: MAX_VUS },
      { duration: "2m", target: MAX_VUS },
      { duration: "30s", target: 0 },
    ],
    gracefulRampDown: "20s",
  },
};

export const options = {
  scenarios: { besucher: PROFILES[PROFILE] || PROFILES.smoke },
  userAgent: "k6-loadtest (garagenflohmarkt, lesend)",
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "20s" }],
    "http_req_duration{kind:page}": ["p(95)<1500"],
    "http_req_duration{kind:asset}": ["p(95)<3000"],
    "http_req_duration{kind:api}": ["p(95)<1000"],
    "http_req_duration{kind:data}": ["p(95)<2000"],
  },
};

function allMatches(regex, text, group) {
  const found = [];
  let m = regex.exec(text);
  while (m !== null) {
    found.push(m[group]);
    m = regex.exec(text);
  }
  return found;
}

export function setup() {
  if (PROFILE !== "smoke" && __ENV.CONFIRM !== "yes") {
    throw new Error(
      `Profil "${PROFILE}" erzeugt echte Last auf ${BASE_URL}. Zum Starten -e CONFIRM=yes setzen.`,
    );
  }

  // Assets aus dem echten Build ermitteln (Dateinamen enthalten Hashes).
  const html = http.get(`${BASE_URL}/`).body;
  const assets = new Set(allMatches(/(?:src|href)="(\/assets\/[^"]+)"/g, html, 1));
  for (const path of ["/manifest.webmanifest", "/registerSW.js"]) assets.add(path);

  for (const path of [...assets]) {
    if (path.endsWith(".js")) {
      const js = http.get(`${BASE_URL}${path}`).body;
      for (const worker of allMatches(/(assets\/maplibre-gl-worker-[\w-]+\.js)/g, js, 1)) {
        assets.add(`/${worker}`);
      }
    } else if (path.endsWith(".css")) {
      const css = http.get(`${BASE_URL}${path}`).body;
      for (const font of allMatches(/url\(["']?([^)"']+\.woff2)["']?\)/g, css, 1)) {
        assets.add(font.startsWith("/") ? font : `/assets/${font.replace(/^\.\//, "")}`);
      }
    }
  }
  // Wie laden echte Browser die Daten? Der Bucket muss der Seiten-Origin per
  // CORS erlauben, sonst verwirft der Browser die Antwort (fetchManifest in
  // frontend/src/api.ts) und die App nutzt die Live-API.
  const probe = http.get(`${STATIC_BASE_URL}/stands/manifest.json`, {
    headers: { Origin: BASE_URL },
  });
  const corsOk = Boolean(probe.headers["Access-Control-Allow-Origin"]);
  const dataSource = DATA_SOURCE_OVERRIDE || (corsOk ? "bucket" : "api");
  console.warn(
    `Datenquelle der Besucher: ${dataSource} (Bucket-CORS ${corsOk ? "vorhanden" : "FEHLT - Browser fallen auf die API zurück"})`,
  );
  return { assets: [...assets], dataSource };
}

function loadData(dataSource) {
  group("Karten- und Listendaten", () => {
    // Die App fragt immer zuerst das Manifest im Bucket (auch wenn der
    // Browser die Antwort wegen fehlendem CORS verwirft).
    const manifestRes = http.get(`${STATIC_BASE_URL}/stands/manifest.json`, {
      tags: { kind: "data", name: "manifest" },
    });
    check(manifestRes, { "manifest 200": (r) => r.status === 200 });

    if (dataSource === "bucket") {
      if (manifestRes.status !== 200) return;
      const manifest = manifestRes.json();
      const responses = http.batch([
        ["GET", `${STATIC_BASE_URL}/${manifest.list_url}`, null, { tags: { kind: "data", name: "liste" } }],
        ["GET", `${STATIC_BASE_URL}/${manifest.geojson_url}`, null, { tags: { kind: "data", name: "geojson" } }],
      ]);
      check(responses[0], { "liste 200": (r) => r.status === 200 });
      check(responses[1], { "geojson 200": (r) => r.status === 200 });
    } else {
      // Live-API-Fallback: läuft über Container und Datenbank.
      const responses = http.batch([
        ["GET", `${BASE_URL}/stands`, null, { tags: { kind: "api", name: "stands" } }],
        ["GET", `${BASE_URL}/stands/geojson`, null, { tags: { kind: "api", name: "stands-geojson" } }],
      ]);
      check(responses[0], { "GET /stands 200": (r) => r.status === 200 });
      check(responses[1], { "GET /stands/geojson 200": (r) => r.status === 200 });
    }
  });
}

export default function (data) {
  const newVisitor = Math.random() < NEW_VISITOR_RATIO;

  if (newVisitor) {
    group("Erstbesuch: Seite und Assets", () => {
      const page = http.get(`${BASE_URL}/`, { tags: { kind: "page", name: "index" } });
      check(page, { "index 200": (r) => r.status === 200 });
      sleep(0.3);
      const responses = http.batch(
        data.assets.map((path) => [
          "GET",
          `${BASE_URL}${path}`,
          null,
          { tags: { kind: "asset", name: "asset" }, responseType: "none" },
        ]),
      );
      check(responses, { "alle Assets 200": (rs) => rs.every((r) => r.status === 200) });
    });
  }

  const launch = http.get(`${BASE_URL}/launch-config`, { tags: { kind: "api", name: "launch-config" } });
  check(launch, { "launch-config 200": (r) => r.status === 200 });
  sleep(0.5 + Math.random());

  loadData(data.dataSource);
  sleep(2 + Math.random() * 4);

  if (Math.random() < FORM_OPENER_RATIO) {
    const settings = http.get(`${BASE_URL}/settings`, { tags: { kind: "api", name: "settings" } });
    check(settings, { "settings 200": (r) => r.status === 200 });
  }

  // Denkzeit: Besucher schauen sich Karte/Liste an, bevor sie weitermachen.
  sleep(5 + Math.random() * 10);
}
