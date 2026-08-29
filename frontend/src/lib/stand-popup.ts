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
): HTMLElement {
  const { id, nickname, adresse, beschreibung } = properties;
  const kategorien = toStringArray(properties.kategorien);
  const zahlungsarten = toStringArray(properties.zahlungsarten);

  const popupNode = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = nickname;
  popupNode.appendChild(title);

  const addLine = (text: string) => {
    popupNode.appendChild(document.createElement("br"));
    popupNode.appendChild(document.createTextNode(text));
  };
  addLine(adresse);
  if (kategorien.length > 0) addLine(kategorien.join(", "));
  if (beschreibung) addLine(beschreibung);
  if (zahlungsarten.length > 0) {
    addLine(zahlungsarten.map((z) => `${ZAHLUNGSART_ICON[z] ?? "💳"} ${z}`).join(", "));
  }

  // "Navigieren" und Favorit-Umschalter als gleichwertige Aktions-Buttons
  // in einer Zeile - der Stern allein (nur neben dem Namen) war zu
  // unauffällig, um als eigene Aktion erkannt zu werden.
  const actionsRow = document.createElement("div");
  Object.assign(actionsRow.style, {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginTop: "8px",
  });

  if (coords) {
    const navLink = document.createElement("a");
    navLink.href = navigationUrl(coords.lat, coords.lng, nickname);
    navLink.target = "_blank";
    navLink.rel = "noopener noreferrer";
    navLink.textContent = "Navigieren";
    Object.assign(navLink.style, {
      display: "inline-block",
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

  if (actionsRow.childElementCount > 0) {
    popupNode.appendChild(actionsRow);
  }

  return popupNode;
}
