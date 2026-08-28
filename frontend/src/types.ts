export interface Stand {
  id: number;
  nickname: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  beschreibung: string | null;
  kategorien: string[];
  zahlungsarten: string[];
  created_at: string;
}

export interface StandFormData {
  adresse: string;
  beschreibung: string;
  email: string;
  kategorien: string[];
  zahlungsarten: string[];
  website?: string; // Honeypot – muss leer bleiben
}
