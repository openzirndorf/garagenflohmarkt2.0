variable "scw_access_key" {
  description = "Scaleway Access Key"
  type        = string
  sensitive   = true
}

variable "scw_secret_key" {
  description = "Scaleway Secret Key"
  type        = string
  sensitive   = true
}

variable "scw_project_id" {
  description = "Scaleway Project ID für die App-Ressourcen (Container, Storage, Datenbank, Jobs) - eigenes 'Garagenflohmarkt'-Projekt, getrennt vom OpenZirndorf-Projekt"
  type        = string
}

variable "smtp_project_id" {
  description = "Scaleway Project ID, unter der Transactional Email/die Absenderdomain verifiziert ist (OpenZirndorf-Projekt, bewusst nicht dasselbe wie scw_project_id)"
  type        = string
}

variable "scw_region" {
  description = "Scaleway Region"
  type        = string
  default     = "fr-par"
}

variable "db_password" {
  description = "Passwort für den Datenbank-Benutzer 'flohmarkt' (starkes Zufallspasswort)"
  type        = string
  sensitive   = true
}

variable "admin_token" {
  description = "Bearer Token für Admin-Endpunkte (nie im Frontend)"
  type        = string
  sensitive   = true
}

variable "api_username" {
  description = "Basic-Auth Username für das Frontend"
  type        = string
  sensitive   = true
}

variable "api_password" {
  description = "Basic-Auth Passwort für das Frontend (starkes Zufallspasswort)"
  type        = string
  sensitive   = true
}

variable "container_image_tag" {
  description = "Docker Image Tag der API"
  type        = string
  default     = "latest"
}

variable "smtp_from" {
  description = "Absenderadresse für Transactional Email (z.B. noreply@automail.openzirndorf.de)"
  type        = string
  default     = ""
}

variable "backend_url" {
  description = "Öffentliche URL des Backends (für Bestätigungslinks in Mails)"
  type        = string
  default     = ""
}

variable "frontend_url" {
  description = "Öffentliche URL des Frontends (für Weiterleitungen nach Bestätigung) - läuft jetzt im selben Container wie das Backend (siehe scaleway_container_domain.flohmarkt_frontend), nicht mehr auf GitHub Pages"
  type        = string
  default     = "https://garagenflohmarkt.openzirndorf.de"
}

variable "launch_at" {
  description = "ISO-8601-Zeitpunkt, ab dem die App öffentlich (ohne Bypass) sichtbar ist - siehe GET /launch-config und frontend/src/components/coming-soon.tsx. Leer = Datum steht noch nicht fest, Platzhalterseite bleibt unbefristet aktiv. Spätere Änderung ist ein reiner 'tofu apply', kein Rebuild/Redeploy des Images nötig."
  type        = string
  default     = ""
}

variable "geocode_api_key" {
  description = "OpenCage API-Key (kostenloser Tarif von 2.500/Tag reicht) für app/geocode.py - ohne gesetzten Key fällt das Backend auf die öffentliche Nominatim-Instanz zurück, was gegen deren Nutzungsbedingungen für automatisierte/programmatische Nutzung verstößt und nur für lokale Entwicklung gedacht ist. Vor dem Produktivbetrieb unter https://opencagedata.com registrieren und hier setzen."
  type        = string
  sensitive   = true
  default     = ""
}
