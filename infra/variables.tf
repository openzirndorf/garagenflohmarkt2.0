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
