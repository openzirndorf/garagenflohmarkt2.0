import { useCallback, useEffect, useState } from "react";
import { type CreatedStand, cancelStand, fetchMyStand, updateStand } from "../api";
import { KATEGORIEN } from "./stand-form";

const EDIT_TOKEN_KEY = "flohmarkt_edit_token";

interface Props {
  onCancelled: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Warte auf E-Mail-Bestätigung",
  APPROVED: "Freigeschaltet ✓",
};

export function MeinStand({ onCancelled }: Props) {
  const [stand, setStand] = useState<CreatedStand | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    adresse: "",
    beschreibung: "",
    kategorien: [] as string[],
    uhrzeit: "",
  });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem(EDIT_TOKEN_KEY);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStand(await fetchMyStand(token));
    } catch {
      localStorage.removeItem(EDIT_TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token || !stand) return null;

  const isApproved = stand.status === "APPROVED";

  const toggleKategorie = (k: string) => {
    setEditForm((f) => ({
      ...f,
      kategorien: f.kategorien.includes(k)
        ? f.kategorien.filter((c) => c !== k)
        : [...f.kategorien, k],
    }));
  };

  const handleEdit = () => {
    setEditForm({
      name: stand.name,
      adresse: stand.adresse,
      beschreibung: stand.beschreibung ?? "",
      kategorien: stand.kategorien ?? [],
      uhrzeit: stand.uhrzeit ?? "",
    });
    setEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateStand(token, editForm);
      setStand(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Stand wirklich zurückziehen? Das kann nicht rückgängig gemacht werden.")) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelStand(token);
      localStorage.removeItem(EDIT_TOKEN_KEY);
      setStand(null);
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Zurückziehen");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section
      style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
      className="border border-blue-100 bg-blue-50 p-4"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-500">
        Dein angemeldeter Stand
      </p>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-name" className="text-xs font-medium text-gray-600">
              Name
            </label>
            <input
              id="edit-name"
              className="rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-adresse" className="text-xs font-medium text-gray-600">
              Adresse
            </label>
            <input
              id="edit-adresse"
              className="rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editForm.adresse}
              onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-uhrzeit" className="text-xs font-medium text-gray-600">
              Uhrzeit
            </label>
            <input
              id="edit-uhrzeit"
              className="rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="z.B. 9:00 – 14:00 Uhr"
              value={editForm.uhrzeit}
              onChange={(e) => setEditForm((f) => ({ ...f, uhrzeit: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Kategorien</span>
            <div className="flex flex-wrap gap-1.5">
              {KATEGORIEN.map((k) => {
                const active = editForm.kategorien.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKategorie(k)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-blue-400"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-beschreibung" className="text-xs font-medium text-gray-600">
              Was gibt es zu kaufen?
            </label>
            <textarea
              id="edit-beschreibung"
              className="min-h-[60px] resize-y rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={editForm.beschreibung}
              onChange={(e) => setEditForm((f) => ({ ...f, beschreibung: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-gray-900">{stand.name}</p>
            <p className="text-sm text-gray-500">{stand.adresse}</p>
            {stand.uhrzeit && <p className="mt-0.5 text-xs text-gray-500">🕐 {stand.uhrzeit}</p>}
            {stand.kategorien && stand.kategorien.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {stand.kategorien.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            <p
              className={`mt-1 text-xs font-medium ${isApproved ? "text-[--oz-green]" : "text-blue-600"}`}
            >
              {STATUS_LABEL[stand.status] ?? stand.status}
            </p>
            {stand.status === "PENDING" && (
              <p className="mt-1 text-xs text-blue-500">
                Bitte bestätige deine E-Mail-Adresse über den Link in der Bestätigungsmail.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleEdit}
              className="text-sm text-blue-600 transition-colors hover:text-blue-800"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
            >
              {cancelling ? "…" : "Zurückziehen"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
