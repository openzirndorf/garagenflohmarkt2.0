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

function shareUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

export function canUseWebShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

// Muss direkt aus einem Nutzer-Klick heraus aufgerufen werden (Browser-
// Vorgabe der Web Share API). Wirft AbortError, wenn der Nutzer den
// Teilen-Dialog nur geschlossen hat - das ist kein Fehlerfall.
export async function shareApp(): Promise<void> {
  await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: shareUrl() });
}

export function buildShareFallbackLinks() {
  const url = shareUrl();
  const text = `${SHARE_TEXT} ${url}`;
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}
