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
  // Beide müssen true sein - Server erzwingt das unabhängig vom Frontend
  // (siehe app/routes/stands.py create_stand).
  datenschutz_zustimmung: boolean;
  mindestalter_bestaetigt: boolean;
  website?: string; // Honeypot – muss leer bleiben
}
