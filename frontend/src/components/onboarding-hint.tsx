import { useState } from "react";

const DISMISSED_KEY = "flohmarkt_onboarding_dismissed";

// Kurzer, einmaliger Hinweis für Erstnutzer statt eines mehrstufigen
// Coachmark-Tours (Tooltips exakt über Filter-Button/Kartenpins zu
// positionieren wäre fragil, v.a. über einem MapLibre-Canvas). Eine simple
// dismissible Karte reicht, um die drei wichtigsten Konzepte zu erklären,
// bevor jemand sie selbst erraten muss.
export function OnboardingHint() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <div
      style={{ borderRadius: "var(--oz-radius-lg)" }}
      className="mx-auto mt-3 flex w-full max-w-2xl items-start gap-3 border border-green-100 bg-green-50 px-4 py-3 text-sm"
    >
      <span aria-hidden="true" className="text-lg leading-none">
        👋
      </span>
      <ul className="flex-1 list-disc pl-4 text-gray-700 [&>li]:mt-0.5">
        <li>
          <strong>Suche + Filter</strong> oben durchsuchen Karte und Liste gemeinsam.
        </li>
        <li>
          Auf einen <strong>Pin tippen</strong> zeigt Adresse, Kategorien und „Navigieren".
        </li>
        <li>
          <strong>★ Favoriten</strong> merken und später über den Filter wiederfinden.
        </li>
      </ul>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis schließen"
        className="shrink-0 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
