import { useCallback, useEffect, useState } from "react";
import { type CreatedStand, cancelStand, fetchMyStand } from "../api";

const EDIT_TOKEN_KEY = "flohmarkt_edit_token";

interface Props {
  onCancelled: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Wartet auf Freigabe",
  APPROVED: "Freigeschaltet ✓",
};

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

  const isApproved = stand.status === "APPROVED";

  return (
    <section
      style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
      className="border border-blue-100 bg-blue-50 p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">
            Dein angemeldeter Stand
          </p>
          <p className="font-semibold text-gray-900">{stand.name}</p>
          <p className="text-sm text-gray-500">{stand.adresse}</p>
          <p
            className={`mt-1 text-xs font-medium ${isApproved ? "text-[--oz-green]" : "text-blue-600"}`}
          >
            {STATUS_LABEL[stand.status] ?? stand.status}
          </p>
        </div>
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="shrink-0 text-sm text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
        >
          {cancelling ? "…" : "Zurückziehen"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
