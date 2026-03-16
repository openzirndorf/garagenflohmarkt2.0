import { useCallback, useEffect, useState } from "react";
import { type CreatedStand, cancelStand, fetchMyStand, updateStand } from "../api";

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
  const [editForm, setEditForm] = useState({ name: "", adresse: "", beschreibung: "" });
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

  const handleEdit = () => {
    setEditForm({
      name: stand.name,
      adresse: stand.adresse,
      beschreibung: stand.beschreibung ?? "",
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
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-2">
        Dein angemeldeter Stand
      </p>

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Name</label>
            <input
              className="border border-input rounded-md px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white"
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Adresse</label>
            <input
              className="border border-input rounded-md px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white"
              value={editForm.adresse}
              onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Was gibt es zu kaufen?</label>
            <textarea
              className="border border-input rounded-md px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring bg-white min-h-[60px] resize-y"
              value={editForm.beschreibung}
              onChange={(e) => setEditForm((f) => ({ ...f, beschreibung: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
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
