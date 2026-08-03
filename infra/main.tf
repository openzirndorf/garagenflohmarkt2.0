terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.49"
    }
  }
  required_version = ">= 1.6"

  backend "s3" {
    bucket                      = "openzirndorf-tfstate"
    key                         = "garagenflohmarkt/terraform.tfstate"
    region                      = "fr-par"
    endpoint                    = "https://s3.fr-par.scw.cloud"
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    force_path_style            = true
    use_lockfile                = true  # OpenTofu 1.10+ native S3 locking ohne DynamoDB
  }
}

provider "scaleway" {
  access_key = var.scw_access_key
  secret_key = var.scw_secret_key
  project_id = var.scw_project_id
  region     = var.scw_region
}

# Standard-Datenbank-Instanz (kein Serverless) - kleinster Node-Typ, da nur
# ~100 Schreibzugriffe insgesamt anfallen. Bewusst keine Serverless SQL
# Database mehr: die hatte eine fixe, per Terraform nicht einstellbare
# 7-Tage-Backup-Aufbewahrung, was mit der Löschfrist am 07.10.2026
# kollidiert - hier lässt sich backup_schedule_retention explizit passend
# zur Löschfrist setzen.
resource "scaleway_rdb_instance" "flohmarkt" {
  name          = "flohmarkt-db"
  node_type     = "DB-DEV-S"
  engine        = "PostgreSQL-16"
  is_ha_cluster = false

  disable_backup             = false
  backup_schedule_frequency  = 24 # Stunden
  backup_schedule_retention  = 3  # Tage - bewusst kurz, damit Backups zeitnah nach dem 07.10. auslaufen

  user_name = "flohmarkt"
  password  = var.db_password

  region = var.scw_region

  # Ohne explizites private_network bekommt die Instanz einen öffentlichen
  # Load-Balancer-Endpoint - der Serverless Container hat keine feste IP
  # und kein Private Network, braucht also einen öffentlich erreichbaren
  # Endpoint (Absicherung über Passwort + sslmode=require, nicht über IP-Filter).
  load_balancer {}
}

resource "scaleway_rdb_database" "flohmarkt" {
  instance_id = scaleway_rdb_instance.flohmarkt.id
  name        = "flohmarkt"
}

# Ohne ACL-Regel blockiert Scaleway jeglichen Zugriff auf die Instanz.
resource "scaleway_rdb_acl" "flohmarkt" {
  instance_id = scaleway_rdb_instance.flohmarkt.id

  acl_rules {
    ip          = "0.0.0.0/0"
    description = "Serverless Container hat keine feste IP - Zugriff ist über Passwort/TLS abgesichert"
  }
}

locals {
  # urlencode() ist Pflicht: das Passwort kann Zeichen wie "/" oder "="
  # enthalten (z.B. aus einem base64-basierten Generator), die in einer
  # Connection-URI sonst die Parser-Struktur zerstören (asyncpg deutet
  # ein unkodiertes "/" dann fälschlich als Host/Port-Trenner).
  database_url = "postgresql://${scaleway_rdb_instance.flohmarkt.user_name}:${urlencode(var.db_password)}@${scaleway_rdb_instance.flohmarkt.load_balancer[0].ip}:${scaleway_rdb_instance.flohmarkt.load_balancer[0].port}/${scaleway_rdb_database.flohmarkt.name}?sslmode=require"
}

# Object Storage Bucket für die statischen Karten-Artefakte (stands.json,
# stands.geojson) - die öffentliche Karte liest direkt von hier, nicht vom
# Backend. Damit sieht die Datenbank am Veranstaltungstag praktisch keine
# Leselast, und die Karte funktioniert auch, wenn Backend/DB kurz ausfallen.
resource "scaleway_object_bucket" "stands" {
  name   = "garagenflohmarkt-stands"
  region = var.scw_region
}

resource "scaleway_object_bucket_acl" "stands" {
  bucket = scaleway_object_bucket.stands.id
  acl    = "public-read"
}

# Container Registry Namespace – speichert das Docker Image der API
resource "scaleway_registry_namespace" "flohmarkt" {
  name      = "openzirndorf-flohmarkt"
  region    = var.scw_region
  is_public = false
}

# Container Namespace (Serverless Containers)
resource "scaleway_container_namespace" "flohmarkt_ns" {
  name   = "openzirndorf"
  region = var.scw_region
}

# Serverless Container – läuft das FastAPI-Backend
resource "scaleway_container" "flohmarkt_api" {
  name           = "flohmarkt-api"
  namespace_id   = scaleway_container_namespace.flohmarkt_ns.id
  registry_image = "${scaleway_registry_namespace.flohmarkt.endpoint}/flohmarkt-api:${var.container_image_tag}"

  port         = 8080
  cpu_limit    = 1000
  memory_limit = 1024
  min_scale    = 0
  max_scale    = 5

  secret_environment_variables = {
    DATABASE_URL  = local.database_url
    ADMIN_TOKEN   = var.admin_token
    API_USERNAME  = var.api_username
    API_PASSWORD  = var.api_password
    SMTP_PASSWORD = var.scw_secret_key
    # Scaleway Object Storage nutzt dieselben Projekt-API-Keys wie
    # OpenTofu selbst als S3-Zugangsdaten - kein eigenes IAM-Setup nötig.
    S3_ACCESS_KEY = var.scw_access_key
    S3_SECRET_KEY = var.scw_secret_key
  }

  environment_variables = {
    SMTP_HOST     = "smtp.tem.scaleway.com"
    SMTP_PORT     = "465"
    SMTP_USER     = var.smtp_project_id
    SMTP_FROM     = var.smtp_from
    BACKEND_URL   = var.backend_url
    FRONTEND_URL  = var.frontend_url
    STANDS_BUCKET = scaleway_object_bucket.stands.name
    S3_ENDPOINT   = "https://s3.${var.scw_region}.scw.cloud"
    S3_REGION     = var.scw_region
  }

  privacy = "public"
}

# Sicherheitsnetz: regeneriert das Karten-Artefakt alle 5 Minuten, falls ein
# inline BackgroundTask verloren geht (z.B. weil der Container zwischen
# Trigger und Upload wegen min_scale=0 herunterskaliert).
resource "scaleway_job_definition" "stands_artifact_cron" {
  name                   = "stands-artifact-regen"
  cpu_limit              = 280
  memory_limit           = 256
  local_storage_capacity = 1024
  image_uri              = "${scaleway_registry_namespace.flohmarkt.endpoint}/flohmarkt-api:${var.container_image_tag}"
  startup_command        = ["python"]
  args                   = ["-m", "app.jobs.stands_artifact"]
  timeout                = "5m"
  region                 = var.scw_region

  env = {
    DATABASE_URL  = local.database_url
    STANDS_BUCKET = scaleway_object_bucket.stands.name
    S3_ENDPOINT   = "https://s3.${var.scw_region}.scw.cloud"
    S3_REGION     = var.scw_region
    S3_ACCESS_KEY = var.scw_access_key
    S3_SECRET_KEY = var.scw_secret_key
  }

  cron {
    schedule = "*/5 * * * *"
    timezone = "Europe/Berlin"
  }
}

# Löscht alle Anmeldedaten nach dem Event-Cutoff (07.10.2026) - automatisiert,
# nicht als Kalendererinnerung. Täglicher statt einmaliger Trigger: ein
# Einmal-Trigger ist ein stiller Single Point of Failure; scripts/deletion_job.py
# ist idempotent, also ist ein täglicher Lauf gefahrlos und gibt Resilienz,
# falls ein Lauf fehlschlägt.
resource "scaleway_job_definition" "deletion_job" {
  name                   = "flohmarkt-deletion-job"
  cpu_limit              = 280
  memory_limit           = 256
  local_storage_capacity = 1024
  image_uri              = "${scaleway_registry_namespace.flohmarkt.endpoint}/flohmarkt-api:${var.container_image_tag}"
  startup_command        = ["python"]
  args                   = ["-m", "scripts.deletion_job"]
  timeout                = "5m"
  region                 = var.scw_region

  env = {
    DATABASE_URL  = local.database_url
    STANDS_BUCKET = scaleway_object_bucket.stands.name
    S3_ENDPOINT   = "https://s3.${var.scw_region}.scw.cloud"
    S3_REGION     = var.scw_region
    S3_ACCESS_KEY = var.scw_access_key
    S3_SECRET_KEY = var.scw_secret_key
  }

  cron {
    schedule = "0 3 * * *" # täglich 03:00 Europe/Berlin
    timezone = "Europe/Berlin"
  }
}

# Custom Domain für den Container
resource "scaleway_container_domain" "flohmarkt_api" {
  container_id = scaleway_container.flohmarkt_api.id
  hostname     = "api.openzirndorf.de"
  region       = var.scw_region
}
