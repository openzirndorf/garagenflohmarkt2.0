import { navigationUrl } from "./navigation-url";
import { ZAHLUNGSART_ICON } from "./zahlungsarten";

export interface StandPopupProperties {
  id: number;
  nickname: string;
  adresse: string;
  beschreibung: string | null;
  // string[] beim direkten Aufruf (Tests, roher GeoJSON-Fetch) - als
  // JSON-kodierter String, wenn die Werte von einem MapLibre-Klick-Event
  // kommen (siehe toStringArray()).
  kategorien?: string[] | string;
  zahlungsarten?: string[] | string;
}

export interface FavoriteControls {
  isFavorite: (id: number) => boolean;
  onToggle: (id: number) => void;
}

// Wie FavoriteControls injiziert statt hier direkt zu fetchen - dieses
// Modul bleibt bewusst frei von Netzwerk-Importen, damit es ohne
// Karten-/Netzwerk-Mock testbar bleibt (siehe Kommentar an
// buildStandPopupContent).
export interface ReportControls {
  onReport: (id: number, grund: string) => Promise<void>;
}

// Eigener, zum Rest der App passender Dialog statt eines nackten
// window.prompt() - der Grund ist Pflicht (siehe POST /stands/{id}/report),
// "Melden" bleibt bis zu einer Eingabe deaktiviert. Escape oder Klick auf
// den abgedunkelten Hintergrund bricht ab, ohne zu senden. Bewusst mit
// reinen DOM-APIs statt React aufgebaut, siehe Modul-Kommentar oben.
function openReportDialog(onSubmit: (grund: string) => void): void {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0, 0, 0, 0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: "10000",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    width: "min(320px, 90vw)",
    boxSizing: "border-box",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    fontFamily: "inherit",
  });

  const title = document.createElement("strong");
  title.textContent = "Stand melden";

  const hint = document.createElement("p");
  hint.textContent = "Warum meldest du diesen Stand?";
  Object.assign(hint.style, { margin: "0", fontSize: "0.85rem", color: "#4b5563" });

  const textarea = document.createElement("textarea");
  textarea.rows = 3;
  textarea.placeholder = "Grund (Pflichtfeld)";
  Object.assign(textarea.style, {
    width: "100%",
    resize: "vertical",
    fontFamily: "inherit",
    fontSize: "0.875rem",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  });

  const error = document.createElement("p");
  error.textContent = "Bitte einen Grund angeben.";
  Object.assign(error.style, { margin: "0", fontSize: "0.75rem", color: "#dc2626" });
  error.hidden = true;

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    marginTop: "4px",
  });

  const pillStyle = {
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.8rem",
    fontWeight: "600",
    padding: "6px 14px",
    borderRadius: "9999px",
    borderWidth: "1px",
    borderStyle: "solid",
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Abbrechen";
  Object.assign(cancelBtn.style, pillStyle, {
    borderColor: "#d1d5db",
    background: "#fff",
    color: "#4b5563",
  });

  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.textContent = "Melden";
  Object.assign(submitBtn.style, pillStyle, {
    borderColor: "#009a00",
    background: "#009a00",
    color: "#fff",
  });

  function close() {
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
  }
  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKeydown);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  cancelBtn.addEventListener("click", close);
  submitBtn.addEventListener("click", () => {
    const grund = textarea.value.trim();
    if (!grund) {
      error.hidden = false;
      textarea.focus();
      return;
    }
    close();
    onSubmit(grund);
  });

  actions.append(cancelBtn, submitBtn);
  card.append(title, hint, textarea, error, actions);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  textarea.focus();
}

// MapLibre GL kodiert GeoJSON-Feature-Properties intern wie Vector-Tiles
// (die kein Array/Objekt als Wert kennen): ein Array-Property wie
// kategorien/zahlungsarten kommt aus feature.properties eines
// Klick-Events als JSON-String zurück, nicht als Array - anders als beim
// direkten Aufruf dieser Funktion in Tests oder aus dem rohen
// GeoJSON-Fetch. Ohne dieses Abfangen wirft z.B. "kategorien.join" einen
// Fehler, der den kompletten Klick-Handler abbricht, bevor das Popup
// überhaupt erzeugt wird - Klicks auf einen Stand wirkten dann komplett
// wirkungslos.
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as string[];
    } catch {
      // kein valides JSON - als leere Liste behandeln statt zu werfen
    }
  }
  return [];
}

// Baut den Popup-Inhalt als DOM statt als HTML-String: Nutzer-Eingaben
// (adresse, beschreibung) landen so immer als reiner Text, nie als
// interpretierbares HTML - verhindert Stored-XSS über Standdaten, die nur
// einmalig durch die Admin-Freigabe geprüft werden, nicht bei jeder Anzeige.
//
// Bewusst in einem eigenen, von maplibre-gl unabhängigen Modul: maplibre-gl
// löst beim Import Seiteneffekte aus (Web-Worker-Setup via
// window.URL.createObjectURL), die in jsdom-Tests nicht funktionieren -
// diese reine Funktion lässt sich so ohne Karten-Mock testen.
//
// coords kommt separat aus feature.geometry (nicht aus properties) - so wie
// es das GeoJSON von rows_to_geojson() im Backend auch trennt.
export function buildStandPopupContent(
  properties: StandPopupProperties,
  coords: { lat: number; lng: number } | null = null,
  favorite: FavoriteControls | null = null,
  report: ReportControls | null = null,
): HTMLElement {
  const { id, adresse, beschreibung } = properties;
  const kategorien = toStringArray(properties.kategorien);
  const zahlungsarten = toStringArray(properties.zahlungsarten);

  const popupNode = document.createElement("div");
  const title = document.createElement("strong");
  // Öffentlich wird die Adresse gezeigt, nicht der intern vergebene
  // Standname (properties.nickname) - die Adresse ist das, was Besucher
  // zum Wiederfinden auf der Karte brauchen.
  title.textContent = adresse;
  popupNode.appendChild(title);

  const addLine = (text: string) => {
    popupNode.appendChild(document.createElement("br"));
    popupNode.appendChild(document.createTextNode(text));
  };
  if (kategorien.length > 0) addLine(kategorien.join(", "));
  if (beschreibung) addLine(beschreibung);
  if (zahlungsarten.length > 0) {
    addLine(zahlungsarten.map((z) => `${ZAHLUNGSART_ICON[z] ?? "💳"} ${z}`).join(", "));
  }

  // "Navigieren", Favorit-Umschalter und Melden als gleichwertige
  // Aktions-Buttons in einer Zeile - der Stern allein (nur neben dem Namen)
  // war zu unauffällig, um als eigene Aktion erkannt zu werden. flexWrap
  // statt eines festen Nebeneinanders: drei Pillen passen nicht immer in
  // die Popup-Breite, quetschten sich davor ineinander statt sauber in
  // eine zweite Zeile umzubrechen.
  const actionsRow = document.createElement("div");
  Object.assign(actionsRow.style, {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: "6px",
    columnGap: "8px",
    marginTop: "8px",
  });

  if (coords) {
    const navLink = document.createElement("a");
    navLink.href = navigationUrl(coords.lat, coords.lng, adresse);
    navLink.target = "_blank";
    navLink.rel = "noopener noreferrer";
    navLink.textContent = "Navigieren";
    Object.assign(navLink.style, {
      display: "inline-block",
      whiteSpace: "nowrap",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "0.75rem",
      fontWeight: "600",
      padding: "3px 10px",
      borderRadius: "9999px",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#009a00",
      background: "#eef7e6",
      color: "#009a00",
      textDecoration: "none",
    });
    actionsRow.appendChild(navLink);
  }

  if (favorite) {
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    Object.assign(favBtn.style, {
      whiteSpace: "nowrap",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "0.75rem",
      fontWeight: "600",
      padding: "3px 10px",
      borderRadius: "9999px",
      borderWidth: "1px",
      borderStyle: "solid",
    });
    const updateFavBtn = () => {
      const active = favorite.isFavorite(id);
      favBtn.textContent = active ? "★ Favorit" : "+ Favoriten";
      Object.assign(favBtn.style, {
        borderColor: active ? "#fbbf24" : "#fcd34d",
        background: active ? "#fbbf24" : "#fffbeb",
        color: active ? "#ffffff" : "#b45309",
      });
      favBtn.setAttribute("aria-label", active ? "Von Favoriten entfernen" : "Als Favorit merken");
    };
    updateFavBtn();
    favBtn.addEventListener("click", () => {
      favorite.onToggle(id);
      updateFavBtn();
    });
    actionsRow.appendChild(favBtn);
  }

  if (report) {
    const reportBtn = document.createElement("button");
    reportBtn.type = "button";
    Object.assign(reportBtn.style, {
      whiteSpace: "nowrap",
      cursor: "pointer",
      fontFamily: "inherit",
      fontSize: "0.75rem",
      fontWeight: "600",
      padding: "3px 10px",
      borderRadius: "9999px",
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: "#d1d5db",
      background: "#fff",
      color: "#4b5563",
    });
    reportBtn.textContent = "🚩 Melden";
    reportBtn.addEventListener("click", () => {
      openReportDialog((grund) => {
        reportBtn.disabled = true;
        report.onReport(id, grund).finally(() => {
          reportBtn.textContent = "Gemeldet";
        });
      });
    });
    actionsRow.appendChild(reportBtn);
  }

  if (actionsRow.childElementCount > 0) {
    popupNode.appendChild(actionsRow);
  }

  return popupNode;
}
