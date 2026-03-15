import type { Stand, StandFormData } from "./types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// Basic-Auth Header für POST /stands – Credentials kommen aus Vite-Env
const apiAuth = btoa(
  `${import.meta.env.VITE_API_USERNAME ?? ""}:${import.meta.env.VITE_API_PASSWORD ?? ""}`,
);

export async function fetchStands(): Promise<Stand[]> {
  const res = await fetch(`${API}/stands`);
  if (!res.ok) throw new Error("Stände konnten nicht geladen werden");
  return res.json();
}

export async function fetchGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  const res = await fetch(`${API}/stands/geojson`);
  if (!res.ok) throw new Error("GeoJSON konnte nicht geladen werden");
  return res.json();
}

export interface AdminStand extends Stand {
  email: string | null;
  status: string;
  edit_token: string;
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

export interface CreatedStand extends Stand {
  edit_token: string;
  status: string;
}

export async function createStand(data: StandFormData): Promise<CreatedStand> {
  const res = await fetch(`${API}/stands`, {
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

export async function fetchMyStand(editToken: string): Promise<CreatedStand> {
  const res = await fetch(`${API}/stands/by-token/${editToken}`);
  if (!res.ok) throw new Error("Stand nicht gefunden");
  return res.json();
}

export async function cancelStand(editToken: string): Promise<void> {
  const res = await fetch(`${API}/stands/by-token/${editToken}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Stand konnte nicht zurückgezogen werden");
}
