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
}

// Meldefunktion für Besucher (falsche/fremde Einträge) - bewusst kein
// Freitextformular, nur ein Bestätigungsdialog: hält die Hürde bewusst
// niedrig, der Admin bekommt ohnehin nur "gemeldet", nicht den Grund im
// Klartext gespeichert (siehe POST /stands/{id}/report).
function ReportButton({ standId }: { standId: number }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");

  if (state === "done") {
    return <p className="text-xs text-gray-400">Gemeldet, danke.</p>;
  }

  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Diesen Stand als falsch oder unangemessen melden?")) return;
        setState("sending");
        try {
          await reportStand(standId);
        } catch {
          // Fehlschlag hier bewusst nicht extra anzeigen - Melden soll
          // niedrigschwellig bleiben, ein zweiter Versuch kostet nichts.
        }
        setState("done");
      }}
      disabled={state === "sending"}
      className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline disabled:opacity-50"
    >
      🚩 Melden
    </button>
  );
}

export function StandListe({ stands, loading, favoriteIds, onToggleFavorite }: Props) {
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
        <p className="text-sm text-gray-400">Noch keine Stände angemeldet.</p>
        <p className="mt-1 text-xs text-gray-300">Sei der Erste!</p>
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
            <p className="font-semibold leading-tight text-gray-900">{s.nickname}</p>
            <p className="mt-0.5 text-sm text-gray-500">{s.adresse}</p>
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
              <p className="mt-1 text-sm leading-snug text-gray-600">{s.beschreibung}</p>
            )}
            <div className="mt-1.5">
              <ReportButton standId={s.id} />
            </div>
          </div>
          {(s.lat !== null && s.lng !== null) || onToggleFavorite ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5 self-center">
              {s.lat !== null && s.lng !== null && (
                <a
                  href={navigationUrl(s.lat, s.lng, s.nickname)}
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
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
