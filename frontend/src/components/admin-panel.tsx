import { useCallback, useState } from "react";
import {
  type AdminStand,
  approveStand,
  deleteStandAdmin,
  fetchAdminStands,
  updateStandAdmin,
} from "../api";
import { KATEGORIEN } from "./stand-form";

export function AdminPanel() {
  const [token, setToken] = useState("");
  const [stands, setStands] = useState<AdminStand[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    adresse: "",
    beschreibung: "",
    kategorien: [] as string[],
    uhrzeit: "",
  });

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

  const startEdit = (s: AdminStand) => {
    setEditForm({
      name: s.name,
      adresse: s.adresse,
      beschreibung: s.beschreibung ?? "",
      kategorien: s.kategorien ?? [],
      uhrzeit: s.uhrzeit ?? "",
    });
    setEditingId(s.id);
    setError(null);
  };

  const handleSave = async (id: number) => {
    setSavingId(id);
    setError(null);
    try {
      await updateStandAdmin(id, token, editForm);
      setEditingId(null);
      await load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setSavingId(null);
    }
  };

  const toggleEditKat = (k: string) => {
    setEditForm((f) => ({
      ...f,
      kategorien: f.kategorien.includes(k)
        ? f.kategorien.filter((c) => c !== k)
        : [...f.kategorien, k],
    }));
  };

  const pending = stands?.filter((s) => s.status === "PENDING") ?? [];
  const approved = stands?.filter((s) => s.status === "APPROVED") ?? [];
  const all = stands ?? [];

  // Statistiken
  const catStats = KATEGORIEN.map((k) => ({
    k,
    count: all.filter((s) => s.kategorien?.includes(k)).length,
  })).filter((x) => x.count > 0);
  const maxCount = Math.max(...catStats.map((x) => x.count), 1);

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

          {/* Statistiken */}
          {all.length > 0 && (
            <section className="rounded-xl border bg-gray-50 p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Statistiken
              </h2>
              <div className="mb-4 flex gap-6">
                <div>
                  <p className="text-2xl font-bold">{all.length}</p>
                  <p className="text-xs text-gray-500">Gesamt</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
                  <p className="text-xs text-gray-500">Ausstehend</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-700">{approved.length}</p>
                  <p className="text-xs text-gray-500">Freigegeben</p>
                </div>
              </div>
              {catStats.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {catStats
                    .sort((a, b) => b.count - a.count)
                    .map(({ k, count }) => (
                      <div key={k} className="flex items-center gap-2 text-sm">
                        <span className="w-20 shrink-0 text-gray-600">{k}</span>
                        <div className="flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-2 rounded-full bg-[#009a00]"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-4 shrink-0 text-right text-gray-500">{count}</span>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-xl font-semibold">Ausstehend</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">Keine ausstehenden Stände.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((s) => (
                  <li key={s.id} className="flex flex-col gap-2 rounded border p-4">
                    {editingId === s.id ? (
                      <EditForm
                        form={editForm}
                        setForm={setEditForm}
                        onToggleKat={toggleEditKat}
                        onSave={() => handleSave(s.id)}
                        onCancel={() => setEditingId(null)}
                        saving={savingId === s.id}
                      />
                    ) : (
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
                            onClick={() => startEdit(s)}
                            className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                          >
                            Bearbeiten
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
                    )}
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
                  <li key={s.id} className="rounded border">
                    {editingId === s.id ? (
                      <div className="p-4">
                        <EditForm
                          form={editForm}
                          setForm={setEditForm}
                          onToggleKat={toggleEditKat}
                          onSave={() => handleSave(s.id)}
                          onCancel={() => setEditingId(null)}
                          saving={savingId === s.id}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="text-green-600">✓</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{s.name}</span>
                          <span className="ml-2 text-gray-500">{s.adresse}</span>
                          {s.uhrzeit && (
                            <span className="ml-2 text-xs text-gray-400">🕐 {s.uhrzeit}</span>
                          )}
                          {s.kategorien && s.kategorien.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
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
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="text-xs text-blue-500 hover:text-blue-700"
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, s.name)}
                            disabled={deletingId === s.id}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            {deletingId === s.id ? "…" : "Löschen"}
                          </button>
                        </div>
                      </div>
                    )}
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

interface EditFormProps {
  form: {
    name: string;
    adresse: string;
    beschreibung: string;
    kategorien: string[];
    uhrzeit: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      adresse: string;
      beschreibung: string;
      kategorien: string[];
      uhrzeit: string;
    }>
  >;
  onToggleKat: (k: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function EditForm({ form, setForm, onToggleKat, onSave, onCancel, saving }: EditFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-admin-name" className="text-xs font-medium text-gray-600">
            Name
          </label>
          <input
            id="edit-admin-name"
            className="rounded border px-2 py-1.5 text-sm"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="edit-admin-uhrzeit" className="text-xs font-medium text-gray-600">
            Uhrzeit
          </label>
          <input
            id="edit-admin-uhrzeit"
            className="rounded border px-2 py-1.5 text-sm"
            placeholder="z.B. 9:00 – 14:00 Uhr"
            value={form.uhrzeit}
            onChange={(e) => setForm((f) => ({ ...f, uhrzeit: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-admin-adresse" className="text-xs font-medium text-gray-600">
          Adresse
        </label>
        <input
          id="edit-admin-adresse"
          className="rounded border px-2 py-1.5 text-sm"
          value={form.adresse}
          onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="edit-admin-beschreibung" className="text-xs font-medium text-gray-600">
          Beschreibung
        </label>
        <textarea
          id="edit-admin-beschreibung"
          className="min-h-[60px] resize-y rounded border px-2 py-1.5 text-sm"
          value={form.beschreibung}
          onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Kategorien</span>
        <div className="flex flex-wrap gap-1.5">
          {KATEGORIEN.map((k) => {
            const active = form.kategorien.includes(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => onToggleKat(k)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#009a00] bg-[#009a00] text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-[#009a00]"
                }`}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
