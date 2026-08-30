// Teilen-Funktion: bevorzugt die native Web Share API. Die deckt auf
// Mobilgeräten automatisch auch Instagram/WhatsApp/Facebook über die
// Betriebssystem-eigene Teilen-Leiste ab, ohne dass wir für jede App eine
// eigene Integration bauen müssten - für Instagram gibt es ohnehin keinen
// funktionierenden Web-Share-Link, nur die App selbst kennt einen Weg, an
// eine Story zu teilen. Auf Desktop (kein Web Share API) fallen wir auf
// explizite WhatsApp-/Facebook-Links zurück; für Instagram gibt es dort
// bewusst keinen Fallback-Button, da er ins Leere liefe.
const SHARE_TITLE = "Garagenflohmarkt Zirndorf";
const SHARE_TEXT =
  "Schau dir die Stände beim Garagenflohmarkt Zirndorf an - powered by OpenZirndorf:";

export interface ShareOptions {
  title: string;
  text: string;
  url: string;
}

function shareUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

// Muss direkt aus einem Nutzer-Klick heraus aufgerufen werden (Browser-
// Vorgabe der Web Share API). Wirft AbortError, wenn der Nutzer den
// Teilen-Dialog nur geschlossen hat - das ist kein Fehlerfall.
export async function share(options: ShareOptions): Promise<void> {
  await navigator.share(options);
}

export function buildShareFallbackLinks(options: ShareOptions) {
  const text = `${options.text} ${options.url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(options.url)}`,
  };
}

export function appShareOptions(): ShareOptions {
  return { title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl() };
}

// #suche=<nickname> nutzt bewusst die schon vorhandene Freitextsuche statt
// einer eigenen Deep-Link-Logik (Karte zentrieren, Popup automatisch öffnen)
// - beim Öffnen filtert die App Karte und Liste direkt auf den einen Stand,
// ganz ohne zusätzlichen Code (siehe FlohmarktApp-Mount-Effekt).
export function standShareOptions(nickname: string): ShareOptions {
  return {
    title: SHARE_TITLE,
    text: `Schau dir meinen Stand „${nickname}“ beim Garagenflohmarkt Zirndorf an:`,
    url: `${shareUrl()}#suche=${encodeURIComponent(nickname)}`,
  };
}
