import { useCallback, useEffect, useState } from "react";
import {
  type AdminRosterEntry,
  type AdminStand,
  type AuditLogEntry,
  addAdmin,
  approveStand,
  deleteStandAdmin,
  fetchAdminStands,
  fetchAuditLog,
  listAdmins,
  redeemAdminCode,
  removeAdmin,
  requestAdminLogin,
  updateStandAdmin,
} from "../api";
import { KATEGORIEN, MAX_KATEGORIEN, ZAHLUNGSARTEN, ZAHLUNGSART_ICON } from "./stand-form";

// Wie SESSION_TOKEN_KEY in mein-stand.tsx - eigener Schlüssel, damit sich
// eine Admin- und eine Standbetreiber-Sitzung im selben Browser nicht
// überschreiben.
const ADMIN_SESSION_TOKEN_KEY = "flohmarkt_admin_session_token";

const ACTION_LABEL: Record<AuditLogEntry["action"], string> = {
  CREATED: "Angemeldet",
  APPROVED: "Freigegeben",
  EDITED: "Bearbeitet",
  DELETED: "Gelöscht",
  REPLIED: "Antwort erhalten",
  REPORTED: "Gemeldet",
  DEACTIVATED: "Deaktiviert",
  REACTIVATED: "Reaktiviert",
};

const ACTION_COLOR: Record<AuditLogEntry["action"], string> = {
  CREATED: "bg-gray-100 text-gray-600",
  APPROVED: "bg-green-100 text-green-700",
  EDITED: "bg-blue-100 text-blue-700",
  DELETED: "bg-red-100 text-red-700",
  REPLIED: "bg-amber-100 text-amber-700",
  DEACTIVATED: "bg-red-100 text-red-700",
  REACTIVATED: "bg-green-100 text-green-700",
  REPORTED: "bg-orange-100 text-orange-700",
};

export function AdminPanel() {
  // Beim Laden vorhandene Sitzung übernehmen, statt bei jedem Öffnen neu
  // einzutippen (das war das eigentliche Problem am alten, fest
  // eingetippten Master-Token: keine Persistenz).
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY));
  const [stands, setStands] = useState<AdminStand[] | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    adresse: "",
    beschreibung: "",
    kategorien: [] as string[],
    zahlungsarten: [] as string[],
    deactivated: false,
    deactivation_message: "",
  });

  // Login per E-Mail + Code, genau wie Standbetreiber unter "Mein Stand" -
  // ersetzt das bisherige feste Eintippen des (geteilten) Master-Tokens.
  const [loginEmail, setLoginEmail] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [standsResult, auditResult] = await Promise.all([
        fetchAdminStands(t),
        fetchAuditLog(t).catch(() => []),
      ]);
      setStands(standsResult);
      setAuditLog(auditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setStands(null);
      // Sitzung war ungültig/abgelaufen - nicht als "eingeloggt" stehen
      // lassen, sonst zeigt der Screen dauerhaft nur die Fehlermeldung.
      sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      await requestAdminLogin(loginEmail.trim());
      setCodeRequested(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Anfrage fehlgeschlagen");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const { session_token } = await redeemAdminCode(loginCode.trim());
      sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, session_token);
      setToken(session_token);
      await load(session_token);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Code konnte nicht eingelöst werden");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
    setToken(null);
    setStands(null);
    setLoginEmail("");
    setLoginCode("");
    setCodeRequested(false);
  };

  // Wiederhergestellte Sitzung (siehe useState oben) automatisch laden,
  // statt trotz vorhandenem Token erst noch mal einloggen zu müssen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim Mount ausführen, load() selbst ist stabil (useCallback mit []-Deps)
  useEffect(() => {
    if (token) load(token);
  }, []);

  const handleApprove = async (id: number) => {
    if (!token) return;
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

  const handleDelete = async (id: number, nickname: string) => {
    if (!confirm(`„${nickname}" wirklich löschen?`)) return;
    if (!token) return;
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
      adresse: s.adresse,
      beschreibung: s.beschreibung ?? "",
      kategorien: s.kategorien ?? [],
      zahlungsarten: s.zahlungsarten ?? [],
      deactivated: s.deactivated,
      deactivation_message: s.deactivation_message ?? "",
    });
    setEditingId(s.id);
    setError(null);
  };

  const handleSave = async (id: number) => {
    if (!token) return;
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

  const toggleEditZahlungsart = (z: string) => {
    setEditForm((f) => ({
      ...f,
      zahlungsarten: f.zahlungsarten.includes(z)
        ? f.zahlungsarten.filter((c) => c !== z)
        : [...f.zahlungsarten, z],
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

  // Anmeldungen pro Tag - reine Auswertung der schon geladenen Standdaten,
  // kein Tracking: nutzt nur das ohnehin gespeicherte created_at.
  const dayCounts = new Map<string, number>();
  for (const s of all) {
    const day = s.created_at.slice(0, 10);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const dayStats = [...dayCounts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxDayCount = Math.max(...dayStats.map(([, count]) => count), 1);

  const nicknameForStand = (standId: number) =>
    all.find((s) => s.id === standId)?.nickname ?? `Stand #${standId}`;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <h1
        style={{ fontFamily: "var(--oz-font-heading)" }}
        className="text-3xl font-extrabold text-gray-900"
      >
        Admin <span className="text-[#009a00]">Garagenflohmarkt</span>
      </h1>

      {stands === null ? (
        <>
          <form
            onSubmit={codeRequested ? handleRedeemCode : handleRequestCode}
            style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
            className="flex max-w-sm flex-col gap-3 border border-gray-100 bg-white p-6"
          >
            {!codeRequested ? (
              <>
                <label htmlFor="admin-email" className="text-sm font-medium text-gray-700">
                  E-Mail
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="deine@email.de"
                  required
                />
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Falls diese E-Mail-Adresse als Admin hinterlegt ist, hast du gerade einen
                  Zugangscode bekommen.
                </p>
                <label htmlFor="admin-code" className="text-sm font-medium text-gray-700">
                  Zugangscode
                </label>
                <input
                  id="admin-code"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  className="rounded-md border border-input px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Code eingeben…"
                  required
                />
                <button
                  type="button"
                  onClick={() => setCodeRequested(false)}
                  className="self-start text-xs text-gray-400 hover:text-gray-600 hover:underline"
                >
                  Andere E-Mail-Adresse
                </button>
              </>
            )}
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loginLoading}
              className="rounded-md bg-[#009a00] px-4 py-2 font-medium text-white hover:bg-[#008400] disabled:opacity-50"
            >
              {loginLoading ? "Laden…" : codeRequested ? "Einloggen" : "Code anfordern"}
            </button>
          </form>
          <AdminRosterManager />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {pending.length} ausstehend · {approved.length} freigegeben
              {loading && " · lädt…"}
            </p>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:underline"
            >
              Abmelden
            </button>
          </div>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {/* Statistiken */}
          {all.length > 0 && (
            <section
              style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
              className="border border-gray-100 bg-white p-5"
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Statistiken
              </h2>
              <div className="mb-4 flex gap-6">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{all.length}</p>
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
                <div className="mb-4">
                  <p className="mb-1.5 text-xs font-medium text-gray-400">Nach Kategorie</p>
                  <div className="flex flex-col gap-1.5">
                    {catStats
                      .sort((a, b) => b.count - a.count)
                      .map(({ k, count }) => (
                        <div key={k} className="flex items-center gap-2 text-sm">
                          <span className="w-20 shrink-0 text-gray-600">{k}</span>
                          <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-2 rounded-full bg-[#009a00]"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="w-4 shrink-0 text-right text-gray-500">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {dayStats.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-gray-400">Anmeldungen pro Tag</p>
                  <div className="flex flex-col gap-1.5">
                    {dayStats.map(([day, count]) => (
                      <div key={day} className="flex items-center gap-2 text-sm">
                        <span className="w-20 shrink-0 text-gray-600">
                          {new Date(day).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                          })}
                        </span>
                        <div className="flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-blue-500"
                            style={{ width: `${(count / maxDayCount) * 100}%` }}
                          />
                        </div>
                        <span className="w-4 shrink-0 text-right text-gray-500">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Audit-Log */}
          {auditLog.length > 0 && (
            <section
              style={{ borderRadius: "var(--oz-radius-lg)", boxShadow: "var(--oz-shadow-sm)" }}
              className="border border-gray-100 bg-white p-5"
            >
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Verlauf
              </h2>
              <ul className="flex flex-col gap-1.5">
                {auditLog.slice(0, 30).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2 text-sm">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLOR[entry.action]}`}
                    >
                      {ACTION_LABEL[entry.action]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-gray-700">
                      {nicknameForStand(entry.stand_id)}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {entry.actor === "admin" ? "Admin" : "Inhaber"}
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2
              style={{ fontFamily: "var(--oz-font-heading)" }}
              className="mb-3 text-xl font-bold text-gray-900"
            >
              Ausstehend
            </h2>
            {pending.length === 0 ? (
              <p className="text-sm text-gray-500">Keine ausstehenden Stände.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      borderRadius: "var(--oz-radius-lg)",
                      boxShadow: "var(--oz-shadow-sm)",
                    }}
                    className="flex flex-col gap-2 border border-amber-100 bg-amber-50/40 p-4"
                  >
                    {editingId === s.id ? (
                      <EditForm
                        form={editForm}
                        setForm={setEditForm}
                        onToggleKat={toggleEditKat}
                        onToggleZahlungsart={toggleEditZahlungsart}
                        onSave={() => handleSave(s.id)}
                        onCancel={() => setEditingId(null)}
                        saving={savingId === s.id}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="flex items-center gap-1.5 font-semibold">
                            {s.nickname}
                            {s.deactivated && (
                              <span
                                title="Deaktiviert - nicht auf Karte/Liste sichtbar"
                                className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700"
                              >
                                🚫
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">{s.adresse}</p>
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
                          {s.zahlungsarten && s.zahlungsarten.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {s.zahlungsarten.map((z) => (
                                <span
                                  key={z}
                                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                                >
                                  {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                                </span>
                              ))}
                            </div>
                          )}
                          {s.beschreibung && <p className="mt-1 text-sm">{s.beschreibung}</p>}
                          {s.email && <p className="mt-1 text-sm text-gray-500">{s.email}</p>}
                          {s.deactivation_reply_message && (
                            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-900">
                              <p className="text-xs font-medium text-blue-700">
                                Antwort des Inhabers:
                              </p>
                              <p className="mt-0.5">{s.deactivation_reply_message}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(s.id)}
                            disabled={approvingId === s.id}
                            className="rounded-md bg-[#009a00] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#008400] disabled:opacity-50"
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
                            onClick={() => handleDelete(s.id, s.nickname)}
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
            <h2
              style={{ fontFamily: "var(--oz-font-heading)" }}
              className="mb-3 text-xl font-bold text-gray-900"
            >
              Freigegeben
            </h2>
            {approved.length === 0 ? (
              <p className="text-sm text-gray-500">Noch keine freigegebenen Stände.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {approved.map((s) => (
                  <li
                    key={s.id}
                    style={{ borderRadius: "var(--oz-radius-lg)" }}
                    className="border border-gray-100 bg-white"
                  >
                    {editingId === s.id ? (
                      <div className="p-4">
                        <EditForm
                          form={editForm}
                          setForm={setEditForm}
                          onToggleKat={toggleEditKat}
                          onToggleZahlungsart={toggleEditZahlungsart}
                          onSave={() => handleSave(s.id)}
                          onCancel={() => setEditingId(null)}
                          saving={savingId === s.id}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="text-green-600">✓</span>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{s.nickname}</span>
                          {s.deactivated && (
                            <span
                              title="Deaktiviert - nicht auf Karte/Liste sichtbar"
                              className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs text-red-700"
                            >
                              🚫
                            </span>
                          )}
                          <span className="ml-2 text-gray-500">{s.adresse}</span>
                          {s.email && <span className="ml-2 text-gray-400">· {s.email}</span>}
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
                          {s.zahlungsarten && s.zahlungsarten.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {s.zahlungsarten.map((z) => (
                                <span
                                  key={z}
                                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                                >
                                  {ZAHLUNGSART_ICON[z] ?? "💳"} {z}
                                </span>
                              ))}
                            </div>
                          )}
                          {s.deactivation_reply_message && (
                            <div className="mt-1 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
                              <p className="font-medium text-blue-700">Antwort des Inhabers:</p>
                              <p className="mt-0.5">{s.deactivation_reply_message}</p>
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
                            onClick={() => handleDelete(s.id, s.nickname)}
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

      {/* §5 DDG/Art. 13 DSGVO gelten für die ganze Seite, nicht nur für
          #main - die Admin-Ansicht ist eine eigene, von flohmarkt-app.tsx
          getrennte Komponente (siehe main.tsx) und hatte bisher gar keinen
          Footer/Impressum-Link. */}
      <footer className="mt-8 flex justify-center gap-4 border-t border-gray-100 pt-4 text-xs text-gray-400">
        <a href="#impressum" className="hover:text-gray-600 hover:underline">
          Impressum
        </a>
        <a href="#datenschutz" className="hover:text-gray-600 hover:underline">
          Datenschutz
        </a>
      </footer>
    </main>
  );
}

// Wer als Admin gilt, bleibt bewusst hinter dem Master-Token statt einer
// Admin-Session (siehe app/routes/admins.py) - löst das Henne-Ei-Problem
// beim allerersten Eintrag, ohne ein eigenes Bootstrap-Skript zu
// brauchen. Deshalb eingeklappt/zurückhaltend und mit eigener
// Token-Abfrage, statt Teil der normalen Login-Sitzung zu sein.
function AdminRosterManager() {
  const [expanded, setExpanded] = useState(false);
  const [masterToken, setMasterToken] = useState("");
  const [admins, setAdmins] = useState<AdminRosterEntry[] | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setAdmins(await listAdmins(masterToken));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
      setAdmins(null);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await addAdmin(masterToken, newEmail.trim());
      setNewEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await removeAdmin(masterToken, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    } finally {
      setBusy(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="max-w-sm self-start text-xs text-gray-400 hover:text-gray-600 hover:underline"
      >
        ⚙️ Admins verwalten (Master-Token)
      </button>
    );
  }

  return (
    <section
      style={{ borderRadius: "var(--oz-radius-lg)" }}
      className="flex max-w-sm flex-col gap-3 border border-gray-200 bg-gray-50 p-4"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Admins verwalten
      </p>
      <input
        type="password"
        value={masterToken}
        onChange={(e) => setMasterToken(e.target.value)}
        placeholder="Master-Token"
        className="rounded-md border border-input px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="button"
        onClick={load}
        disabled={busy || !masterToken}
        className="self-start rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
      >
        Liste laden
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {admins && (
        <ul className="flex flex-col gap-1.5">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{a.email}</span>
              <button
                type="button"
                onClick={() => handleRemove(a.id)}
                disabled={busy}
                className="shrink-0 text-xs text-red-500 hover:underline disabled:opacity-50"
              >
                Entfernen
              </button>
            </li>
          ))}
          {admins.length === 0 && <li className="text-xs text-gray-400">Noch keine Admins.</li>}
        </ul>
      )}
      {admins && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="neue@email.de"
            className="min-w-0 flex-1 rounded-md border border-input px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-full bg-[#009a00] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#008400] disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </form>
      )}
    </section>
  );
}

interface EditFormState {
  adresse: string;
  beschreibung: string;
  kategorien: string[];
  zahlungsarten: string[];
  deactivated: boolean;
  deactivation_message: string;
}

interface EditFormProps {
  form: EditFormState;
  setForm: React.Dispatch<React.SetStateAction<EditFormState>>;
  onToggleKat: (k: string) => void;
  onToggleZahlungsart: (z: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function EditForm({
  form,
  setForm,
  onToggleKat,
  onToggleZahlungsart,
  onSave,
  onCancel,
  saving,
}: EditFormProps) {
  return (
    <div className="flex flex-col gap-3">
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
        <span className="text-xs font-medium text-gray-600">
          Kategorien (max. {MAX_KATEGORIEN})
        </span>
        <div className="flex flex-wrap gap-1.5">
          {KATEGORIEN.map((k) => {
            const active = form.kategorien.includes(k);
            const disabled = !active && form.kategorien.length >= MAX_KATEGORIEN;
            return (
              <button
                key={k}
                type="button"
                onClick={() => onToggleKat(k)}
                disabled={disabled}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
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
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-600">Zahlungsarten</span>
        <div className="flex flex-wrap gap-1.5">
          {ZAHLUNGSARTEN.map((z) => {
            const active = form.zahlungsarten.includes(z);
            return (
              <button
                key={z}
                type="button"
                onClick={() => onToggleZahlungsart(z)}
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
      {/* Nimmt den Stand komplett von Karte/Liste (siehe
          PUBLIC_STANDS_FILTER in app/public_fields.py) - einzige
          Moderationsaktion dieser Art (die frühere separate "Sperre", die
          nur die Bearbeitung blockierte, wurde entfernt: fühlte sich neben
          der Deaktivierung redundant an). */}
      <div className="flex flex-col gap-1.5 rounded-md border border-red-200 bg-red-50 p-2.5">
        <label className="flex items-center gap-2 text-xs font-medium text-red-800">
          <input
            type="checkbox"
            checked={form.deactivated}
            onChange={(e) => setForm((f) => ({ ...f, deactivated: e.target.checked }))}
          />
          Stand deaktivieren (von der Karte nehmen)
        </label>
        {form.deactivated && (
          <textarea
            className="min-h-[40px] resize-y rounded border border-red-300 bg-white px-2 py-1 text-xs"
            placeholder="Nachricht an den Inhaber (z.B. Grund der Deaktivierung)…"
            value={form.deactivation_message}
            onChange={(e) => setForm((f) => ({ ...f, deactivation_message: e.target.value }))}
          />
        )}
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
