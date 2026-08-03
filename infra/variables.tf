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
  description = "Öffentliche URL des Frontends (für Weiterleitungen nach Bestätigung)"
  type        = string
  default     = "https://openzirndorf.github.io/garagenflohmarkt2.0"
}
