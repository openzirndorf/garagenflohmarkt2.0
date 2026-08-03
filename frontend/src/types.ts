export interface Stand {
  id: number;
  nickname: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  beschreibung: string | null;
  kategorien: string[];
  uhrzeit: string | null;
  created_at: string;
}

export interface StandFormData {
  adresse: string;
  beschreibung: string;
  email: string;
  kategorien: string[];
  uhrzeit: string;
  website?: string; // Honeypot – muss leer bleiben
}
