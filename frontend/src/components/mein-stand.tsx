import { useCallback, useEffect, useState } from "react";
import {
  type OwnStand,
  cancelStand,
  exportMyStandData,
  fetchMyStand,
  requestLogin,
  suggestNicknames,
  updateStand,
} from "../api";
import { KATEGORIEN } from "./stand-form";

const SESSION_TOKEN_KEY = "flohmarkt_session_token";

interface Props {
  onCancelled: () => void;
  onStandChange?: (stand: OwnStand | null) => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Warte auf Bestätigung",
  APPROVED: "Freigeschaltet ✓",
};

// Liest ein Session-Token aus der URL (#mein-stand/session/{token}), wie es
// aus dem Magic-Link in der E-Mail ankommt, und säubert danach die URL -
// das Token soll nicht dauerhaft sichtbar/bookmarkbar in der Adresszeile
// stehenbleiben.
function consumeSessionTokenFromHash(): string | null {
  const match = window.location.hash.match(/^#mein-stand\/session\/(.+)$/);
  if (!match) return null;
  window.location.hash = "mein-stand";
  return match[1];
}

export function MeinStand({ onCancelled, onStandChange }: Props) {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [stand, setStand] = useState<OwnStand | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    adresse: "",
    beschreibung: "",
    kategorien: [] as string[],
    uhrzeit: "",
  });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zugang-anfordern-Formular
  const [requestEmail, setRequestEmail] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  // Standname wählen/wechseln - immer eine Auswahl aus serverseitig
  // gewürfelten Namen, nie Freitext (siehe app/nicknames.py is_valid_nickname).
  const [showNicknamePicker, setShowNicknamePicker] = useState(false);
  const [nicknameSuggestions, setNicknameSuggestions] = useState<string[]>([]);
  const [selectedNickname, setSelectedNickname] = useState<string | null>(null);
  const [nicknameLoading, setNicknameLoading] = useState(false);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  useEffect(() => {
    const fromHash = consumeSessionTokenFromHash();
    if (fromHash) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, fromHash);
      setSessionToken(fromHash);
    } else {
      setSessionToken(sessionStorage.getItem(SESSION_TOKEN_KEY));
    }
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

  const rerollNicknames = useCallback(async () => {
    if (!sessionToken) return;
    setNicknameLoading(true);
    setNicknameError(null);
    try {
      const suggestions = await suggestNicknames(sessionToken);
      setNicknameSuggestions(suggestions);
      setSelectedNickname(null);
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : "Vorschläge fehlgeschlagen");
    } finally {
      setNicknameLoading(false);
    }
  }, [sessionToken]);

  const openNicknamePicker = () => {
    setShowNicknamePicker(true);
    rerollNicknames();
  };

  const applyNickname = async () => {
    if (!sessionToken || !selectedNickname) return;
    setNicknameSaving(true);
    setNicknameError(null);
    try {
      const updated = await updateStand(sessionToken, { nickname: selectedNickname });
      setStand(updated);
      setShowNicknamePicker(false);
    } catch (err) {
      setNicknameError(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    } finally {
      setNicknameSaving(false);
    }
  };

  if (!checkedStorage) return null;

  if (!sessionToken || !stand) {
    // Diese Ansicht wird nur über den eigenen Menüpunkt "Mein Stand"
    // erreicht (eigene Seite, kein Scroll-Ziel mehr) - kein zusätzlicher
    // Zwischenklick nötig, das Formular steht direkt da.
    return (
      <section>
        <h1 style={{ fontFamily: "var(--oz-font-heading)" }} className="mb-4 text-xl font-bold">
          Mein Stand
        </h1>
        {requestStatus === "sent" ? (
          <p className="text-sm text-gray-700">{requestMessage}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="request-login-email" className="text-sm font-medium text-gray-700">
              Zugang zu deinem Stand anfordern
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
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {requestStatus === "loading" ? "…" : "Link senden"}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Wir schicken dir einen Anmeldelink, mit dem du deinen Stand bearbeiten oder
              vollständig löschen kannst.
            </p>
          </div>
        )}
      </section>
    );
  }

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
      adresse: stand.adresse,
      beschreibung: stand.beschreibung ?? "",
      kategorien: stand.kategorien ?? [],
      uhrzeit: stand.uhrzeit ?? "",
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
      const updated = await updateStand(sessionToken, editForm);
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
      className="border border-blue-100 bg-blue-50 p-4"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-500">
        Dein angemeldeter Stand
      </p>

      {editing ? (
        <div className="flex flex-col gap-3">
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="font-semibold text-gray-900">{stand.nickname}</p>
              {!showNicknamePicker && (
                <button
                  type="button"
                  onClick={openNicknamePicker}
                  className="text-xs text-blue-500 transition-colors hover:text-blue-700 hover:underline"
                >
                  Namen ändern
                </button>
              )}
            </div>
            {showNicknamePicker && (
              <div className="mt-1 flex flex-col gap-2 rounded-lg border border-blue-100 bg-white p-2.5">
                {nicknameLoading ? (
                  <p className="text-xs text-gray-400">Würfelt…</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {nicknameSuggestions.map((n) => (
                      <label
                        key={n}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-gray-50"
                      >
                        <input
                          type="radio"
                          name="nickname-suggestion"
                          checked={selectedNickname === n}
                          onChange={() => setSelectedNickname(n)}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={rerollNicknames}
                    disabled={nicknameLoading || nicknameSaving}
                    className="text-xs text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
                  >
                    🎲 Neue Vorschläge
                  </button>
                  <button
                    type="button"
                    onClick={applyNickname}
                    disabled={!selectedNickname || nicknameSaving}
                    className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {nicknameSaving ? "Speichern…" : "Übernehmen"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNicknamePicker(false)}
                    disabled={nicknameSaving}
                    className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                </div>
                {nicknameError && <p className="text-xs text-red-600">{nicknameError}</p>}
              </div>
            )}
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
              className={`mt-1 text-xs font-medium ${isApproved ? "text-[#009a00]" : "text-blue-600"}`}
            >
              {STATUS_LABEL[stand.status] ?? stand.status}
            </p>
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
