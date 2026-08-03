export interface StandPopupProperties {
  nickname: string;
  adresse: string;
  beschreibung: string | null;
  uhrzeit: string | null;
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
export function buildStandPopupContent(properties: StandPopupProperties): HTMLElement {
  const { nickname, adresse, beschreibung, uhrzeit } = properties;

  const popupNode = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = nickname;
  popupNode.appendChild(title);

  const addLine = (text: string) => {
    popupNode.appendChild(document.createElement("br"));
    popupNode.appendChild(document.createTextNode(text));
  };
  addLine(adresse);
  if (uhrzeit) addLine(`🕐 ${uhrzeit}`);
  if (beschreibung) addLine(beschreibung);

  return popupNode;
}
