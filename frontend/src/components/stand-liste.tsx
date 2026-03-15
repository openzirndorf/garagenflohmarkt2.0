import type { Stand } from "../types";

interface Props {
  stands: Stand[];
  loading: boolean;
}

export function StandListe({ stands, loading }: Props) {
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
          <span
            aria-hidden="true"
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[--oz-green]"
          />
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-gray-900">{s.name}</p>
            <p className="mt-0.5 text-sm text-gray-500">{s.adresse}</p>
            {s.beschreibung && (
              <p className="mt-1 text-sm leading-snug text-gray-600">{s.beschreibung}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
