export interface Stand {
  id: number;
  name: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  beschreibung: string | null;
  created_at: string;
}

export interface StandFormData {
  name: string;
  adresse: string;
  beschreibung: string;
  email: string;
  website?: string; // Honeypot – muss leer bleiben
}
