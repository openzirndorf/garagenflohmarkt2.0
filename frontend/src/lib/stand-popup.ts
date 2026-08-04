import { navigationUrl } from "./navigation-url";

export interface StandPopupProperties {
  id: number;
  nickname: string;
  adresse: string;
  beschreibung: string | null;
  uhrzeit: string | null;
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
  const { id, nickname, adresse, beschreibung, uhrzeit } = properties;

  const popupNode = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = nickname;
  popupNode.appendChild(title);

  if (favorite) {
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.setAttribute(
      "aria-label",
      favorite.isFavorite(id) ? "Von Favoriten entfernen" : "Als Favorit merken",
    );
    Object.assign(starBtn.style, {
      marginLeft: "6px",
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#fbbf24",
      fontSize: "1rem",
      verticalAlign: "middle",
    });
    const updateStar = () => {
      starBtn.textContent = favorite.isFavorite(id) ? "★" : "☆";
    };
    updateStar();
    starBtn.addEventListener("click", () => {
      favorite.onToggle(id);
      updateStar();
    });
    popupNode.appendChild(starBtn);
  }

  const addLine = (text: string) => {
    popupNode.appendChild(document.createElement("br"));
    popupNode.appendChild(document.createTextNode(text));
  };
  addLine(adresse);
  if (uhrzeit) addLine(`🕐 ${uhrzeit}`);
  if (beschreibung) addLine(beschreibung);

  if (coords) {
    popupNode.appendChild(document.createElement("br"));
    const navLink = document.createElement("a");
    navLink.href = navigationUrl(coords.lat, coords.lng, nickname);
    navLink.target = "_blank";
    navLink.rel = "noopener noreferrer";
    navLink.textContent = "Navigieren";
    navLink.style.display = "inline-block";
    navLink.style.marginTop = "6px";
    navLink.style.fontWeight = "600";
    navLink.style.color = "#009a00";
    popupNode.appendChild(navLink);
  }

  return popupNode;
}
