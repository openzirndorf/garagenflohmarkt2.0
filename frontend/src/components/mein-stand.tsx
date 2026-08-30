import { useCallback, useEffect, useState } from "react";
import {
  type OwnStand,
  cancelStand,
  exportMyStandData,
  fetchMyStand,
  redeemCode,
  requestLogin,
  sendLockReply,
  updateStand,
} from "../api";
import { standShareOptions } from "../lib/share";
import { ShareButton } from "./share-button";
import { KATEGORIEN, MAX_KATEGORIEN, ZAHLUNGSARTEN, ZAHLUNGSART_ICON } from "./stand-form";

const SESSION_TOKEN_KEY = "flohmarkt_session_token";

interface Props {
  onCancelled: () => void;
  onStandChange?: (stand: OwnStand | null) => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Warte auf Bestätigung",
  APPROVED: "Freigeschaltet ✓",
};

export function MeinStand({ onCancelled, onStandChange }: Props) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [stand, setStand] = useState<OwnStand | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    adresse: "",
    beschreibung: "",
    kategorien: [] as string[],
    zahlungsarten: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zugang-anfordern-Formular
  const [requestEmail, setRequestEmail] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  // Code eintippen statt Magic-Link-Klick - als installierte PWA öffnet ein
  // Mail-Link nicht zuverlässig das App-Fenster (v.a. iOS Safari).
  const [codeInput, setCodeInput] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Antwort auf eine Inhalts-Sperre - einzige Möglichkeit, den Admin von
  // hier aus zu erreichen (siehe app/routes/stands.py POST .../lock-reply).
  const [lockReplyInput, setLockReplyInput] = useState("");
  const [lockReplyStatus, setLockReplyStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [lockReplyMessage, setLockReplyMessage] = useState<string | null>(null);

  useEffect(() => {
    setSessionToken(sessionStorage.getItem(SESSION_TOKEN_KEY));
    setCheckedStorage(true);
  }, []);

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setStand(await fetchMyStand(sessionToken));
    } catch {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
    }
  }, [sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    onStandChange?.(stand);
  }, [stand, onStandChange]);

  const handleRequestLogin = async () => {
    if (!requestEmail) return;
    setRequestStatus("loading");
    try {
      const res = await requestLogin(requestEmail);
      setRequestMessage(res.message);
      setRequestStatus("sent");
    } catch (err) {
      setRequestMessage(err instanceof Error ? err.message : "Fehler");
      setRequestStatus("idle");
    }
  };

  const handleRedeemCode = async () => {
    if (!codeInput.trim()) return;
    setRedeemLoading(true);
    setRedeemError(null);
    try {
      const result = await redeemCode(codeInput);
      sessionStorage.setItem(SESSION_TOKEN_KEY, result.session_token);
      setSessionToken(result.session_token);
      setCodeInput("");
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleLockReply = async () => {
    if (!sessionToken || !lockReplyInput.trim()) return;
    setLockReplyStatus("loading");
    try {
      const res = await sendLockReply(sessionToken, lockReplyInput.trim());
      setLockReplyMessage(res.message);
      setLockReplyStatus("sent");
    } catch (err) {
      setLockReplyMessage(err instanceof Error ? err.message : "Fehler");
      setLockReplyStatus("idle");
    }
  };

  if (!checkedStorage) return null;

  if (!sessionToken || !stand) {
    // Diese Ansicht wird nur über den eigenen Menüpunkt "Mein Stand"
    // erreicht (eigene Seite, kein Scroll-Ziel mehr) - kein zusätzlicher
    // Zwischenklick nötig, das Formular steht direkt da.
    return (
      <section className="flex flex-col gap-6">
        <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="text-xl font-bold">
          Mein Stand
        </h1>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-code" className="text-sm font-medium text-gray-700">
            Zugangscode eingeben
          </label>
          <div className="flex gap-2">
            <input
              id="login-code"
              className="flex-1 rounded-md border border-input px-3 py-1.5 font-mono text-sm uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="z.B. AB3D9F2K"
              maxLength={8}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              disabled={redeemLoading}
            />
            <button
              type="button"
              onClick={handleRedeemCode}
              disabled={redeemLoading || !codeInput.trim()}
              className="rounded-md bg-[#009a00] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#008400] disabled:opacity-50"
            >
              {redeemLoading ? "…" : "Einloggen"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Den Code findest du in der Mail, die du bei der Anmeldung oder unter "Zugang anfordern"
            bekommen hast.
          </p>
          {redeemError && <p className="text-xs text-red-600">{redeemError}</p>}
        </div>

        <div className="border-t border-gray-100 pt-4">
          {requestStatus === "sent" ? (
            <p className="text-sm text-gray-700">{requestMessage}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <label htmlFor="request-login-email" className="text-sm font-medium text-gray-700">
                Noch keinen Code? Zugang anfordern
              </label>
              <div className="flex gap-2">
                <input
                  id="request-login-email"
                  type="email"
                  className="flex-1 rounded-md border border-input px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="deine@email.de"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  disabled={requestStatus === "loading"}
                />
                <button
                  type="button"
                  onClick={handleRequestLogin}
                  disabled={requestStatus === "loading" || !requestEmail}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {requestStatus === "loading" ? "…" : "Code anfordern"}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Wir schicken dir einen Code, mit dem du deinen Stand bearbeiten oder vollständig
                löschen kannst.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  const isApproved = stand.status === "APPROVED";

  const toggleKategorie = (k: string) => {
    setEditForm((f) => {
      if (!f.kategorien.includes(k) && f.kategorien.length >= MAX_KATEGORIEN) return f;
      return {
        ...f,
        kategorien: f.kategorien.includes(k)
          ? f.kategorien.filter((c) => c !== k)
          : [...f.kategorien, k],
      };
    });
  };

  const toggleZahlungsart = (z: string) => {
    setEditForm((f) => ({
      ...f,
      zahlungsarten: f.zahlungsarten.includes(z)
        ? f.zahlungsarten.filter((c) => c !== z)
        : [...f.zahlungsarten, z],
    }));
  };

  const handleEdit = () => {
    setEditForm({
      adresse: stand.adresse,
      beschreibung: stand.beschreibung ?? "",
      kategorien: stand.kategorien ?? [],
      zahlungsarten: stand.zahlungsarten ?? [],
    });
    setEditing(true);
    setError(null);
  };

  const handleExport = async () => {
    if (!sessionToken) return;
    setExporting(true);
    setError(null);
    try {
      const data = await exportMyStandData(sessionToken);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meine-daten.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (!sessionToken) return;
    setSaving(true);
    setError(null);
    try {
      // Bei Sperre adresse/beschreibung gar nicht erst mitschicken - sonst
      // würde selbst eine reine Kategorien-/Zahlungsarten-Änderung am
      // Server abgelehnt, weil die (unveränderten) gesperrten Felder im
      // Patch-Body stehen.
      const payload = stand.content_locked
        ? { kategorien: editForm.kategorien, zahlungsarten: editForm.zahlungsarten }
        : editForm;
      const updated = await updateStand(sessionToken, payload);
      setStand(updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionToken) return;
    if (
      !confirm(
        "Stand und alle Daten wirklich vollständig löschen? Das kann nicht rückgängig gemacht werden.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      await cancelStand(sessionToken);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      setSessionToken(null);
      setStand(null);
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section
      style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
      className="border border-green-100 bg-green-50 p-4"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-600">
        Dein angemeldeter Stand
      </p>

      {stand.content_locked && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <p>
            Adresse und Beschreibung wurden von einem Admin gesperrt
            {stand.content_lock_message ? `: ${stand.content_lock_message}` : "."}
          </p>
          {lockReplyStatus === "sent" ? (
            <p className="text-green-700">{lockReplyMessage}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lock-reply" className="font-medium">
                Antwort an das Team schicken
              </label>
              <textarea
                id="lock-reply"
                className="min-h-[50px] resize-y rounded-md border border-amber-300 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="z.B. wenn du die Sperre für ein Missverständnis hältst…"
                value={lockReplyInput}
                onChange={(e) => setLockReplyInput(e.target.value)}
                disabled={lockReplyStatus === "loading"}
              />
              <button
                type="button"
                onClick={handleLockReply}
                disabled={lockReplyStatus === "loading" || !lockReplyInput.trim()}
                className="self-start rounded-md bg-amber-600 px-3 py-1 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {lockReplyStatus === "loading" ? "…" : "Nachricht senden"}
              </button>
            </div>
          )}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="edit-adresse" className="text-xs font-medium text-gray-600">
              Adresse
            </label>
            <input
              id="edit-adresse"
              disabled={stand.content_locked}
              className="rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-gray-100 disabled:text-gray-400"
              value={editForm.adresse}
              onChange={(e) => setEditForm((f) => ({ ...f, adresse: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">
              Kategorien (max. {MAX_KATEGORIEN})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {KATEGORIEN.map((k) => {
                const active = editForm.kategorien.includes(k);
                const disabled = !active && editForm.kategorien.length >= MAX_KATEGORIEN;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKategorie(k)}
                    disabled={disabled}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                      active
                        ? "border-[#009a00] bg-[#009a00] text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-green-400"
                    }`}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Zahlungsarten</span>
            <div className="flex flex-wrap gap-1.5">
              {ZAHLUNGSARTEN.map((z) => {
                const active = editForm.zahlungsarten.includes(z);
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() => toggleZahlungsart(z)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-blue-600"
                    }`}
                  >
                    {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
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
              disabled={stand.content_locked}
              className="min-h-[60px] resize-y rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:bg-gray-100 disabled:text-gray-400"
              value={editForm.beschreibung}
              onChange={(e) => setEditForm((f) => ({ ...f, beschreibung: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-[#009a00] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#008400] disabled:opacity-50"
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {/* Kennung ist die Adresse selbst (siehe app/identifiers.py) -
                  keine separate Adresszeile mehr darunter, das wäre reine
                  Wiederholung. */}
              <p className="font-semibold text-gray-900">{stand.nickname}</p>
              {/* Erst ab Freigabe teilbar - vorher würde der Link bei
                  Freund*innen einfach ins Leere laufen (Stand ist noch nicht
                  öffentlich such-/sichtbar). */}
              {isApproved && (
                <ShareButton
                  options={standShareOptions(stand.nickname)}
                  label="↗ Meinen Stand teilen"
                />
              )}
            </div>
            {stand.kategorien && stand.kategorien.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {stand.kategorien.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-[#009a00]"
                  >
                    {k}
                  </span>
                ))}
              </div>
            )}
            {stand.zahlungsarten && stand.zahlungsarten.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {stand.zahlungsarten.map((z) => (
                  <span
                    key={z}
                    className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                  </span>
                ))}
              </div>
            )}
            <p
              className={`mt-1 text-xs font-medium ${isApproved ? "text-[#009a00]" : "text-amber-600"}`}
            >
              {STATUS_LABEL[stand.status] ?? stand.status}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleEdit}
              className="text-sm text-green-700 transition-colors hover:text-green-900"
            >
              Bearbeiten
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-sm text-red-500 transition-colors hover:text-red-700 disabled:opacity-50"
            >
              {cancelling ? "…" : "Stand und Daten löschen"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
            >
              {exporting ? "…" : "Meine Daten herunterladen"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
