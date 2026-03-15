import { useCallback, useEffect, useState } from "react";
import { type CreatedStand, cancelStand, fetchMyStand } from "../api";

const EDIT_TOKEN_KEY = "flohmarkt_edit_token";

interface Props {
  onCancelled: () => void;
}

export function MeinStand({ onCancelled }: Props) {
  const [stand, setStand] = useState<CreatedStand | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = localStorage.getItem(EDIT_TOKEN_KEY);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setStand(await fetchMyStand(token));
    } catch {
      // Token ungültig oder Stand bereits gelöscht → aus localStorage entfernen
      localStorage.removeItem(EDIT_TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (!token || !stand) return null;

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

  const statusLabel: Record<string, string> = {
    PENDING: "Wartet auf Freigabe",
    APPROVED: "Freigeschaltet ✓",
  };

  return (
    <section className="border rounded-lg p-4 bg-blue-50 border-blue-200 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-blue-800">Dein angemeldeter Stand</p>
          <p className="font-medium mt-0.5">{stand.name}</p>
          <p className="text-sm text-gray-600">{stand.adresse}</p>
          <p className="text-xs mt-1 text-blue-700">{statusLabel[stand.status] ?? stand.status}</p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="shrink-0 text-sm text-red-600 hover:underline disabled:opacity-50"
        >
          {cancelling ? "…" : "Zurückziehen"}
        </button>
      </div>
      {error && <p className="text-red-600 text-xs">{error}</p>}
    </section>
  );
}
