import { useState } from "react";
import { buildShareFallbackLinks, canUseWebShare, shareApp } from "../lib/share";

// Teilen-Button für den Event-Info-Banner. Auf Geräten mit Web Share API
// (die meisten Mobilgeräte) reicht ein Klick - das Betriebssystem zeigt die
// eigene Teilen-Leiste inkl. WhatsApp/Instagram/Facebook. Ohne Web Share API
// (i.d.R. Desktop) klappen stattdessen zwei konkrete Links auf.
export function ShareButton() {
  const [showFallback, setShowFallback] = useState(false);

  const handleClick = async () => {
    if (canUseWebShare()) {
      try {
        await shareApp();
      } catch (err) {
        // AbortError = Nutzer hat den Teilen-Dialog nur geschlossen, kein Fehler.
        if (!(err instanceof Error) || err.name !== "AbortError") {
          setShowFallback(true);
        }
      }
      return;
    }
    setShowFallback((v) => !v);
  };

  if (showFallback) {
    const { whatsapp, facebook } = buildShareFallbackLinks();
    return (
      <span className="flex items-center gap-2 text-xs text-green-700">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          WhatsApp
        </a>
        <span className="text-green-300">·</span>
        <a
          href={facebook}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline"
        >
          Facebook
        </a>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-green-700 underline-offset-2 hover:underline"
    >
      ↗ Teilen
    </button>
  );
}
