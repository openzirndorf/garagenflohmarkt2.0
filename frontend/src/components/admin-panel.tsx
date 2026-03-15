import { useCallback, useState } from "react";
import { type AdminStand, approveStand, fetchAdminStands } from "../api";

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [stands, setStands] = useState<AdminStand[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);

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

  const pending = stands?.filter((s) => s.status === "PENDING") ?? [];
  const approved = stands?.filter((s) => s.status === "APPROVED") ?? [];

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <h1 className="text-3xl font-bold">Admin – Garagenflohmarkt</h1>

      {stands === null ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-3 max-w-sm">
          <label htmlFor="token" className="font-medium">
            Admin-Token
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="border rounded px-3 py-2 font-mono text-sm"
            placeholder="Token eingeben…"
            required
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
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

          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded px-3 py-2">
              {error}
            </p>
          )}

          <section>
            <h2 className="text-xl font-semibold mb-3">Ausstehend</h2>
            {pending.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Keine ausstehenden Stände.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((s) => (
                  <li
                    key={s.id}
                    className="border rounded p-4 flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-gray-600">{s.adresse}</p>
                        {s.beschreibung && (
                          <p className="text-sm mt-1">{s.beschreibung}</p>
                        )}
                        {s.email && (
                          <p className="text-sm text-gray-500 mt-1">
                            {s.email}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApprove(s.id)}
                        disabled={approvingId === s.id}
                        className="shrink-0 bg-green-600 text-white rounded px-3 py-1.5 text-sm hover:bg-green-700 disabled:opacity-50"
                      >
                        {approvingId === s.id ? "…" : "Freigeben"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Freigegeben</h2>
            {approved.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Noch keine freigegebenen Stände.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {approved.map((s) => (
                  <li
                    key={s.id}
                    className="border rounded px-4 py-2 text-sm flex gap-3 items-center"
                  >
                    <span className="text-green-600">✓</span>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-500">{s.adresse}</span>
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
