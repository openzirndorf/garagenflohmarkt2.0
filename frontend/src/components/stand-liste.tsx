import { useState } from "react";
import { reportStand } from "../api";
import { navigationUrl } from "../lib/navigation-url";
import type { Stand } from "../types";
import { ZAHLUNGSART_ICON } from "./stand-form";

interface Props {
  stands: Stand[];
  loading: boolean;
  favoriteIds?: Set<number>;
  onToggleFavorite?: (id: number) => void;
  // Unterscheidet im leeren Zustand "wirklich noch keine Stände
  // angemeldet" von "Suche/Filter trifft gerade nichts" - ohne das zeigte
  // eine zu enge Suche fälschlich "Sei der Erste!", obwohl längst Stände
  // existieren.
  hasActiveFilter?: boolean;
  onResetFilters?: () => void;
}

// Eigener, zum Rest der App passender Dialog statt eines nackten
// window.prompt() - der Grund ist Pflicht (siehe POST /stands/{id}/report),
// "Melden" bleibt bis zu einer Eingabe deaktiviert. Klick auf den
// abgedunkelten Hintergrund bricht ab, ohne zu senden.
function ReportDialog({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (grund: string) => void;
}) {
  const [grund, setGrund] = useState("");
  const [showError, setShowError] = useState(false);

  const submit = () => {
    const trimmed = grund.trim();
    if (!trimmed) {
      setShowError(true);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        style={{ borderRadius: "var(--oz-radius-lg)" }}
        className="flex w-full max-w-sm flex-col gap-3 bg-white p-5 shadow-lg"
      >
        <p className="font-semibold text-gray-900">Stand melden</p>
        <p className="text-sm text-gray-500">Warum meldest du diesen Stand?</p>
        <textarea
          // biome-ignore lint/a11y/noAutofocus: Dialog öffnet sich erst per Klick, Fokus direkt aufs einzige Eingabefeld ist hier gewollt.
          autoFocus
          rows={3}
          value={grund}
          onChange={(e) => {
            setGrund(e.target.value);
            setShowError(false);
          }}
          placeholder="Grund (Pflichtfeld)"
          className="resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {showError && <p className="text-xs text-red-600">Bitte einen Grund angeben.</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-full bg-[#009a00] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#008400]"
          >
            Melden
          </button>
        </div>
      </div>
    </div>
  );
}

// Optisch wie "Navigieren"/"Favoriten" daneben - eine gleichwertige,
// gleich aussehende Aktion in derselben Button-Spalte statt eines
// unauffälligen Text-Links.
function ReportButton({ standId }: { standId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [dialogOpen, setDialogOpen] = useState(false);

  const submitReport = async (grund: string) => {
    setDialogOpen(false);
    setState("sending");
    try {
      await reportStand(standId, grund);
    } catch {
      // Fehlschlag hier bewusst nicht extra anzeigen - Melden soll
      // niedrigschwellig bleiben, ein zweiter Versuch kostet nichts.
    }
    setState("done");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={state !== "idle"}
        className="whitespace-nowrap rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
      >
        {state === "done" ? "Gemeldet" : "🚩 Melden"}
      </button>
      {dialogOpen && <ReportDialog onCancel={() => setDialogOpen(false)} onSubmit={submitReport} />}
    </>
  );
}

export function StandListe({
  stands,
  loading,
  favoriteIds,
  onToggleFavorite,
  hasActiveFilter,
  onResetFilters,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border bg-gray-50" />
        ))}
      </div>
    );
  }

  if (!stands.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
        {hasActiveFilter ? (
          <>
            <p className="text-sm text-gray-400">Keine Treffer für Suche/Filter.</p>
            {onResetFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="mt-1 text-xs text-[#009a00] underline-offset-2 hover:underline"
              >
                ✕ Alle Filter zurücksetzen
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400">Noch keine Stände angemeldet.</p>
            <p className="mt-1 text-xs text-gray-300">Sei der Erste!</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stands.map((s) => (
        <div
          key={s.id}
          style={{ boxShadow: "var(--oz-shadow-sm)", borderRadius: "var(--oz-radius-lg)" }}
          className="flex items-start gap-3 border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
        >
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#009a00]" />
          <div className="min-w-0 flex-1">
            {/* Öffentlich wird die Adresse gezeigt, nicht der intern
                vergebene Standname (s.nickname) - die Adresse ist das, was
                Besucher zum Wiederfinden auf der Karte/in der Liste
                brauchen. */}
            <p className="font-semibold leading-tight text-gray-900">{s.adresse}</p>
            {s.kategorien.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.kategorien.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-[#009a00]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            {s.zahlungsarten.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {s.zahlungsarten.map((z) => (
                  <span
                    key={z}
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                  </span>
                ))}
              </div>
            )}
            {s.beschreibung && (
              <p className="mt-1 break-words text-sm leading-snug text-gray-600">
                {s.beschreibung}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
            {s.lat !== null && s.lng !== null && (
              <a
                href={navigationUrl(s.lat, s.lng, s.adresse)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-[#009a00] px-3 py-1.5 text-xs font-semibold text-[#009a00] transition-colors hover:bg-green-50"
              >
                Navigieren
              </a>
            )}
            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(s.id)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  favoriteIds?.has(s.id)
                    ? "border-amber-400 bg-amber-400 text-white"
                    : "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                }`}
              >
                {favoriteIds?.has(s.id) ? "★ Favorit" : "+ Favoriten"}
              </button>
            )}
            <ReportButton standId={s.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
