import { navigationUrl } from "../lib/navigation-url";
import type { Stand } from "../types";
import { ZAHLUNGSART_ICON } from "./stand-form";

interface Props {
  stands: Stand[];
  loading: boolean;
  favoriteIds?: Set<number>;
  onToggleFavorite?: (id: number) => void;
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
                  className="whitespace-nowrap text-xs font-semibold text-amber-700 transition-colors hover:text-amber-900"
                >
                  {favoriteIds?.has(s.id) ? "★ Favorit" : "☆ Zu Favoriten hinzufügen"}
                </button>
              )}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
