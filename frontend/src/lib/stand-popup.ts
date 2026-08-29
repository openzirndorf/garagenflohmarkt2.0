import { navigationUrl } from "./navigation-url";
import { ZAHLUNGSART_ICON } from "./zahlungsarten";

export interface StandPopupProperties {
  id: number;
  nickname: string;
  adresse: string;
  beschreibung: string | null;
  kategorien?: string[];
  zahlungsarten?: string[];
}

export interface FavoriteControls {
  isFavorite: (id: number) => boolean;
  onToggle: (id: number) => void;
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
  const { id, nickname, adresse, beschreibung, kategorien, zahlungsarten } = properties;

  const popupNode = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = nickname;
  popupNode.appendChild(title);

  const addLine = (text: string) => {
    popupNode.appendChild(document.createElement("br"));
    popupNode.appendChild(document.createTextNode(text));
  };
  addLine(adresse);
  if (kategorien && kategorien.length > 0) addLine(kategorien.join(", "));
  if (beschreibung) addLine(beschreibung);
  if (zahlungsarten && zahlungsarten.length > 0) {
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
      fontWeight: "600",
      color: "#009a00",
    });
    actionsRow.appendChild(navLink);
  }

  if (favorite) {
    const favBtn = document.createElement("button");
    favBtn.type = "button";
    Object.assign(favBtn.style, {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: "0",
      font: "inherit",
      fontWeight: "600",
      color: "#b45309",
    });
    const updateFavBtn = () => {
      const active = favorite.isFavorite(id);
      favBtn.textContent = active ? "★ Favorit" : "☆ Zu Favoriten hinzufügen";
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
