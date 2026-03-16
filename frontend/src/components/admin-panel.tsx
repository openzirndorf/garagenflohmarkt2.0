import { useCallback, useState } from "react";
import { type AdminStand, approveStand, deleteStandAdmin, fetchAdminStands } from "../api";

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [stands, setStands] = useState<AdminStand[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      setStands(await fetchAdminStands(t));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setStands(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    load(token);
  };

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      await approveStand(id, token);
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Freigabe fehlgeschlagen");
    } finally {
      setApprovingId(null);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`„${name}" wirklich löschen?`)) return;
    setDeletingId(id);
    try {
      await deleteStandAdmin(id, token);
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
    } finally {
      setDeletingId(null);
    }
  };

  const pending = stands?.filter((s) => s.status === "PENDING") ?? [];
  const approved = stands?.filter((s) => s.status === "APPROVED") ?? [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1 className="text-3xl font-bold">Admin – Garagenflohmarkt</h1>

      {stands === null ? (
        <form onSubmit={handleLogin} className="flex max-w-sm flex-col gap-3">
          <label htmlFor="token" className="font-medium">
            Admin-Token
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded border px-3 py-2 font-mono text-sm"
            placeholder="Token eingeben…"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Laden…" : "Anmelden"}
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {pending.length} ausstehend · {approved.length} freigegeben
            </p>
            <button
              type="button"
              onClick={() => setStands(null)}
              className="text-sm text-gray-500 hover:underline"
            >
              Abmelden
            </button>
          </div>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <section>
            <h2 className="mb-3 text-xl font-semibold">Ausstehend</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">Keine ausstehenden Stände.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((s) => (
                  <li key={s.id} className="flex flex-col gap-1 rounded border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-gray-600">{s.adresse}</p>
                        {s.uhrzeit && <p className="text-xs text-gray-500">🕐 {s.uhrzeit}</p>}
                        {s.kategorien && s.kategorien.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.kategorien.map((k) => (
                              <span
                                key={k}
                                className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700"
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                        {s.beschreibung && <p className="mt-1 text-sm">{s.beschreibung}</p>}
                        {s.email && <p className="mt-1 text-sm text-gray-500">{s.email}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleApprove(s.id)}
                          disabled={approvingId === s.id}
                          className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {approvingId === s.id ? "…" : "Freigeben"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id, s.name)}
                          disabled={deletingId === s.id}
                          className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === s.id ? "…" : "Löschen"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">Freigegeben</h2>
            {approved.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine freigegebenen Stände.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {approved.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded border px-4 py-2 text-sm"
                  >
                    <span className="text-green-600">✓</span>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-500">{s.adresse}</span>
                    {s.uhrzeit && <span className="text-xs text-gray-400">🕐 {s.uhrzeit}</span>}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deletingId === s.id}
                      className="ml-auto text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                    >
                      {deletingId === s.id ? "…" : "Löschen"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
