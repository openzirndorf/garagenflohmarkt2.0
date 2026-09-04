import type { Stand, StandFormData } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Basis-URL des statischen Karten-Artefakts (Object Storage) - Produktion
// setzt das über VITE_STATIC_BASE_URL; lokal ohne Bucket bleibt es leer und
// die Funktionen unten fallen auf die Live-API zurück.
const STATIC_BASE_URL = import.meta.env.VITE_STATIC_BASE_URL as string | undefined;

// Basic-Auth Header für POST /stands – Credentials kommen aus Vite-Env
const apiAuth = btoa(
  `${import.meta.env.VITE_API_USERNAME ?? ""}:${import.meta.env.VITE_API_PASSWORD ?? ""}`,
);

interface StandsManifest {
  list_url: string;
  geojson_url: string;
  generated_at: string;
}

async function fetchManifest(): Promise<StandsManifest | null> {
  if (!STATIC_BASE_URL) return null;
  try {
    const res = await fetch(`${STATIC_BASE_URL}/stands/manifest.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Liest primär vom statischen Artefakt (kein DB-Zugriff, übersteht einen
// DB-Ausfall); nur wenn das nicht konfiguriert oder nicht erreichbar ist,
// fällt es auf die Live-API zurück (lokale Entwicklung, Storage-Störung).
export async function fetchStands(): Promise<Stand[]> {
  const manifest = await fetchManifest();
  if (manifest) {
    const res = await fetch(`${STATIC_BASE_URL}/${manifest.list_url}`);
    if (res.ok) return res.json();
  }
  const res = await fetch(`${API}/stands`);
  if (!res.ok) throw new Error("Stände konnten nicht geladen werden");
  return res.json();
}

export async function fetchGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const manifest = await fetchManifest();
  if (manifest) {
    const res = await fetch(`${STATIC_BASE_URL}/${manifest.geojson_url}`);
    if (res.ok) return res.json();
  }
  const res = await fetch(`${API}/stands/geojson`);
  if (!res.ok) throw new Error("GeoJSON konnte nicht geladen werden");
  return res.json();
}

// Der Admin-Zugang sieht nie Tokens - nur Auskunfts-relevante Felder
// zusätzlich zum öffentlichen Datensatz.
export interface AdminStand extends Stand {
  email: string;
  status: string;
  login_token_expires_at: string | null;
  session_token_expires_at: string | null;
  deactivated: boolean;
  deactivation_message: string | null;
  deactivation_reply_message: string | null;
  deactivation_reply_created_at: string | null;
  address_consent_at: string;
}

export async function fetchAdminStands(token: string): Promise<AdminStand[]> {
  const res = await fetch(`${API}/stands/admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Ungültiger Token oder Serverfehler");
  return res.json();
}

export async function approveStand(id: number, token: string): Promise<void> {
  const res = await fetch(`${API}/stands/${id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Freigabe fehlgeschlagen");
}

// Quittiert offene 🚩-Meldungen zu einem Stand, ohne ihn zu löschen/
// bearbeiten - siehe POST /stands/{id}/report-ack in app/routes/stands.py.
export async function acknowledgeReport(id: number, token: string): Promise<void> {
  const res = await fetch(`${API}/stands/${id}/report-ack`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Meldung konnte nicht als erledigt markiert werden");
}

export interface AuditLogEntry {
  id: number;
  // null bei globalen Einstellungsänderungen (siehe app/routes/settings.py)
  // - die gehören zu keinem Stand.
  stand_id: number | null;
  action:
    | "CREATED"
    | "APPROVED"
    | "EDITED"
    | "DELETED"
    | "REPLIED"
    | "REPORTED"
    | "REPORT_ACKNOWLEDGED"
    | "DEACTIVATED"
    | "REACTIVATED"
    | "SETTINGS_MANUAL_APPROVAL_ON"
    | "SETTINGS_MANUAL_APPROVAL_OFF"
    | "SETTINGS_BESCHREIBUNG_ON"
    | "SETTINGS_BESCHREIBUNG_OFF";
  actor: "owner" | "admin" | "besucher";
  actor_email: string | null;
  // Nur bei action === "REPORTED" gesetzt: der (auf 80 Zeichen begrenzte)
  // Meldegrund, siehe app/audit.py.
  detail: string | null;
  created_at: string;
}

export async function fetchAuditLog(token: string): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API}/stands/admin/audit-log`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Audit-Log konnte nicht geladen werden");
  return res.json();
}

// Eigene Sicht (per session_token) - nie mit E-Mail oder einem Token.
export interface OwnStand extends Stand {
  status: string;
  deactivated: boolean;
  deactivation_message: string | null;
  address_consent_at: string;
}

export async function createStand(data: StandFormData): Promise<OwnStand> {
  const res = await fetch(`${API}/stands/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiAuth}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail ?? "Fehler beim Anmelden");
  }
  return res.json();
}

// Fordert einen frischen Login-Code an - Antwort ist immer gleich,
// unabhängig davon, ob die E-Mail-Adresse existiert (verhindert
// E-Mail-Enumeration).
export async function requestLogin(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/stands/request-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiAuth}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Anfrage fehlgeschlagen");
  return res.json();
}

export interface RedeemCodeResult {
  session_token: string;
  nickname: string;
  was_pending: boolean;
}

// Löst den per Mail verschickten Code gegen ein session_token ein - kein
// Link-Klick, kein Basic Auth nötig (der Code selbst ist das Geheimnis).
export async function redeemCode(code: string): Promise<RedeemCodeResult> {
  const res = await fetch(`${API}/stands/redeem-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Code konnte nicht eingelöst werden");
  }
  return res.json();
}

export async function fetchMyStand(sessionToken: string): Promise<OwnStand> {
  const res = await fetch(`${API}/stands/by-session`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error("Sitzung abgelaufen oder ungültig");
  return res.json();
}

// Art. 15 DSGVO Selbstauskunft - enthält als einziger Endpunkt neben E-Mail
// auch wieder alle eigenen Daten im Klartext.
export interface StandExport extends OwnStand {
  email: string;
}

export async function exportMyStandData(sessionToken: string): Promise<StandExport> {
  const res = await fetch(`${API}/stands/by-session/export`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error("Daten konnten nicht geladen werden");
  return res.json();
}

interface StandPatchData {
  adresse?: string;
  beschreibung?: string;
  kategorien?: string[];
  zahlungsarten?: string[];
  nickname?: string;
}

interface AdminStandPatchData extends StandPatchData {
  deactivated?: boolean;
  deactivation_message?: string;
}

// Würfelt 3 alternative Standnamen zur Auswahl - reserviert nichts, erst
// updateStand() mit dem gewählten Namen schreibt in die DB.
export async function suggestNicknames(sessionToken: string): Promise<string[]> {
  const res = await fetch(`${API}/stands/by-session/nickname-suggestions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error("Vorschläge konnten nicht geladen werden");
  const data = await res.json();
  return data.suggestions;
}

// Einzige Möglichkeit für einen deaktivierten Standinhaber, den Admin zu
// erreichen - wird per Mail weitergeleitet und im Admin-Panel angezeigt.
export async function sendDeactivationReply(
  sessionToken: string,
  message: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API}/stands/by-session/deactivation-reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Nachricht konnte nicht gesendet werden");
  }
  return res.json();
}

export async function updateStandAdmin(
  id: number,
  token: string,
  data: AdminStandPatchData,
): Promise<AdminStand> {
  const res = await fetch(`${API}/stands/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Bearbeitung fehlgeschlagen");
  return res.json();
}

export async function deleteStandAdmin(id: number, token: string): Promise<void> {
  const res = await fetch(`${API}/stands/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Löschen fehlgeschlagen");
}

export async function updateStand(sessionToken: string, data: StandPatchData): Promise<OwnStand> {
  const res = await fetch(`${API}/stands/by-session`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Speichern fehlgeschlagen");
  }
  return res.json();
}

export async function cancelStand(sessionToken: string): Promise<void> {
  const res = await fetch(`${API}/stands/by-session`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error("Stand konnte nicht gelöscht werden");
}

// Öffentliche Meldefunktion für Besucher (falsche/fremde Einträge) - kein
// Basic Auth nötig, jede*r soll melden können.
export async function reportStand(standId: number, grund: string): Promise<void> {
  const res = await fetch(`${API}/stands/${standId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grund }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Meldung fehlgeschlagen");
  }
}

// --- Admin-Login (E-Mail + Code, wie requestLogin/redeemCode für
// Standbetreiber oben) - ersetzt für die alltäglichen Admin-Endpunkte den
// bisher fest eingetippten Master-Token. ---

// Basic Auth wie requestLogin (Standbetreiber) - verhindert Spam von
// außerhalb der eigenen App, siehe app/routes/admins.py.
export async function requestAdminLogin(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API}/admins/request-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${apiAuth}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Anfrage fehlgeschlagen");
  return res.json();
}

export async function redeemAdminCode(code: string): Promise<{ session_token: string }> {
  const res = await fetch(`${API}/admins/redeem-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Code konnte nicht eingelöst werden");
  }
  return res.json();
}

// --- Admin-Roster-Verwaltung (wer zählt als Admin) - bewusst weiterhin
// hinter dem statischen Master-Token, nicht hinter einer Admin-Session
// (siehe app/routes/admins.py: löst das Henne-Ei-Problem beim
// allerersten Eintrag). "masterToken" ist bewusst ein anderer Parameter-
// name als die Session-Tokens oben, um Verwechslung zu vermeiden. ---

export interface AdminRosterEntry {
  id: number;
  email: string;
  created_at: string;
}

export async function listAdmins(masterToken: string): Promise<AdminRosterEntry[]> {
  const res = await fetch(`${API}/admins`, {
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  if (!res.ok) throw new Error("Admin-Liste konnte nicht geladen werden");
  return res.json();
}

export async function addAdmin(masterToken: string, email: string): Promise<AdminRosterEntry> {
  const res = await fetch(`${API}/admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${masterToken}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Admin konnte nicht hinzugefügt werden");
  }
  return res.json();
}

export async function removeAdmin(masterToken: string, id: number): Promise<void> {
  const res = await fetch(`${API}/admins/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${masterToken}` },
  });
  if (!res.ok) throw new Error("Admin konnte nicht entfernt werden");
}

// Zwei globale Schalter (siehe app/routes/settings.py) - GET ist bewusst
// öffentlich, das Anmeldeformular braucht beschreibung_enabled schon vor
// jedem Login.
export interface AppSettings {
  require_manual_approval: boolean;
  beschreibung_enabled: boolean;
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API}/settings`);
  if (!res.ok) throw new Error("Einstellungen konnten nicht geladen werden");
  return res.json();
}

export async function updateSettings(
  token: string,
  data: Partial<AppSettings>,
): Promise<AppSettings> {
  const res = await fetch(`${API}/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Einstellungen konnten nicht gespeichert werden");
  return res.json();
}
