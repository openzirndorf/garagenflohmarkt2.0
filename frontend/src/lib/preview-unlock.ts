// Umgeht die Platzhalter-/Countdown-Seite (siehe coming-soon.tsx) für die
// Entwicklung/zum Testen vor dem offiziellen Start - kein echter
// Schutzmechanismus (keine schützenswerten Daten dahinter, nur ein "noch
// nicht fertig"-Vorhang für die Öffentlichkeit), daher reicht ein
// simpler, im Code änderbarer Parameter statt eines serverseitig
// geprüften Secrets.
const UNLOCK_PARAM = "vorschau";
const UNLOCK_VALUE = "zirndorf2026";
const STORAGE_KEY = "flohmarkt_preview_unlocked";

// Einmalig beim Laden aufrufen (siehe main.tsx): prüft die URL auf den
// Bypass-Parameter, merkt den Zustand dauerhaft im Browser (localStorage)
// und entfernt den Parameter wieder aus der sichtbaren Adresszeile
// (history.replaceState), damit er nicht versehentlich weitergegeben wird
// (Screenshot, geteilter Link o.Ä.).
export function checkPreviewUnlockFromUrl(): void {
  const url = new URL(window.location.href);
  if (url.searchParams.get(UNLOCK_PARAM) !== UNLOCK_VALUE) return;

  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    // z.B. Safari Private Mode - Freischaltung gilt dann nur für diesen
    // Tab/Aufruf, kein Absturz nötig.
  }

  url.searchParams.delete(UNLOCK_PARAM);
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

export function isPreviewUnlocked(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}
