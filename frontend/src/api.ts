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
  content_locked: boolean;
  content_lock_message: string | null;
  lock_reply_message: string | null;
  lock_reply_created_at: string | null;
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

export interface AuditLogEntry {
  id: number;
  stand_id: number;
  action: "CREATED" | "APPROVED" | "EDITED" | "DELETED" | "REPLIED";
  actor: "owner" | "admin";
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
  content_locked: boolean;
  content_lock_message: string | null;
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
  const res = await fetch(`${API}/stands/by-session/${sessionToken}`);
  if (!res.ok) throw new Error("Sitzung abgelaufen oder ungültig");
  return res.json();
}

// Art. 15 DSGVO Selbstauskunft - enthält als einziger Endpunkt neben E-Mail
// auch wieder alle eigenen Daten im Klartext.
export interface StandExport extends OwnStand {
  email: string;
}

export async function exportMyStandData(sessionToken: string): Promise<StandExport> {
  const res = await fetch(`${API}/stands/by-session/${sessionToken}/export`);
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
  content_locked?: boolean;
  content_lock_message?: string;
}

// Würfelt 3 alternative Standnamen zur Auswahl - reserviert nichts, erst
// updateStand() mit dem gewählten Namen schreibt in die DB.
export async function suggestNicknames(sessionToken: string): Promise<string[]> {
  const res = await fetch(`${API}/stands/by-session/${sessionToken}/nickname-suggestions`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Vorschläge konnten nicht geladen werden");
  const data = await res.json();
  return data.suggestions;
}

// Einzige Möglichkeit für einen gesperrten Standinhaber, den Admin zu
// erreichen - wird nur per Mail weitergeleitet, nie gespeichert.
export async function sendLockReply(
  sessionToken: string,
  message: string,
): Promise<{ message: string }> {
  const res = await fetch(`${API}/stands/by-session/${sessionToken}/lock-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  const res = await fetch(`${API}/stands/by-session/${sessionToken}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.detail ?? "Speichern fehlgeschlagen");
  }
  return res.json();
}

export async function cancelStand(sessionToken: string): Promise<void> {
  const res = await fetch(`${API}/stands/by-session/${sessionToken}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Stand konnte nicht gelöscht werden");
}
