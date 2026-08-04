import { useEffect, useState } from "react";

const DISMISSED_KEY = "flohmarkt_install_dismissed";

// Chrome/Android feuert dieses Event nur, wenn der Browser eigene
// Install-Heuristiken erfüllt sieht - wir können es nicht erzwingen, nur
// abfangen und selbst eine Schaltfläche zeigen statt der Browser-eigenen.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari kennt display-mode nicht, hat aber ein eigenes Flag.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(ua) && navigator.maxTouchPoints > 1);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS unterstützt beforeinstallprompt grundsätzlich nicht - dort zeigen
    // wir stattdessen eine Anleitung für "Zum Home-Bildschirm".
    if (isIOS()) setShowIOSHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed || (!deferredPrompt && !showIOSHint)) return null;

  return (
    <div
      style={{ borderRadius: "var(--oz-radius-lg)" }}
      className="mx-auto flex w-full max-w-2xl items-center gap-3 border-b border-green-100 bg-green-50 px-4 py-2.5 text-sm"
    >
      <span aria-hidden="true" className="text-lg">
        📲
      </span>
      {deferredPrompt ? (
        <>
          <p className="flex-1 text-gray-700">Als App installieren für schnellen Zugriff.</p>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-full bg-[#009a00] px-3 py-1 text-xs font-semibold text-white hover:bg-[#008400]"
          >
            Installieren
          </button>
        </>
      ) : (
        <p className="flex-1 text-gray-700">
          Als App installieren: Teilen-Symbol antippen, dann „Zum Home-Bildschirm".
        </p>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Schließen"
        className="shrink-0 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
