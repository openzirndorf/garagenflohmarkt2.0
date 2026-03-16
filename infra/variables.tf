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
  description = "Scaleway Project ID"
  type        = string
}

variable "scw_region" {
  description = "Scaleway Region"
  type        = string
  default     = "fr-par"
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

variable "smtp_host" {
  description = "SMTP-Server-Hostname"
  type        = string
  default     = ""
}

variable "smtp_port" {
  description = "SMTP-Port (Standard: 587)"
  type        = number
  default     = 587
}

variable "smtp_user" {
  description = "SMTP-Benutzername / Absenderadresse"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_password" {
  description = "SMTP-Passwort"
  type        = string
  sensitive   = true
  default     = ""
}

variable "smtp_from" {
  description = "Absenderadresse (optional, Standard = smtp_user)"
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
