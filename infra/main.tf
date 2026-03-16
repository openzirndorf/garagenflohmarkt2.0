terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.49"
    }
  }
  required_version = ">= 1.6"
}

provider "scaleway" {
  access_key = var.scw_access_key
  secret_key = var.scw_secret_key
  project_id = var.scw_project_id
  region     = var.scw_region
}

# Serverless SQL Datenbank
resource "scaleway_sdb_sql_database" "flohmarkt" {
  name    = "fastapi-db"
  min_cpu = 0
  max_cpu = 4
  region  = var.scw_region
}

# IAM Application – dedizierter Datenbanknutzer für die API
resource "scaleway_iam_application" "flohmarkt_db" {
  name = "flohmarkt-db"
}

# IAM API Key für die Application – liefert access_key (Username) + secret_key (Passwort)
resource "scaleway_iam_api_key" "flohmarkt_db" {
  application_id = scaleway_iam_application.flohmarkt_db.id
  description    = "Flohmarkt DB credentials"
  # Scaleway erfordert ein Ablaufdatum – 10 Jahre ab erstem apply
  expires_at     = timeadd(timestamp(), "8760h") # 1 Jahr

  # Verhindert Neuanlage bei jedem apply (expires_at würde sich sonst ändern)
  lifecycle {
    ignore_changes = [expires_at]
  }
}

# IAM Policy – erlaubt der Application den Zugriff auf die Serverless SQL DB
resource "scaleway_iam_policy" "flohmarkt_db" {
  name           = "flohmarkt-db-policy"
  application_id = scaleway_iam_application.flohmarkt_db.id

  rule {
    project_ids          = [var.scw_project_id]
    permission_set_names = ["ServerlessSQLDatabaseReadWrite"]
  }
}

# Vollständige DATABASE_URL aus IAM-Credentials + DB-Endpoint zusammengebaut
locals {
  # Scaleway Serverless SQL: Username = Application ID (UUID), Passwort = API Key Secret
  # endpoint ist bereits eine vollständige URL: postgresql://host:5432/dbname?sslmode=require
  database_url = replace(
    scaleway_sdb_sql_database.flohmarkt.endpoint,
    "://",
    "://${scaleway_iam_application.flohmarkt_db.id}:${scaleway_iam_api_key.flohmarkt_db.secret_key}@"
  )
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
    DATABASE_URL   = local.database_url
    ADMIN_TOKEN    = var.admin_token
    API_USERNAME   = var.api_username
    API_PASSWORD   = var.api_password
    SCW_SECRET_KEY = var.scw_secret_key
    SCW_PROJECT_ID = var.scw_project_id
    SCW_TEM_REGION = var.scw_tem_region
    BREVO_API_KEY  = var.brevo_api_key
    SMTP_USER      = var.smtp_user
    SMTP_PASSWORD  = var.smtp_password
  }

  environment_variables = {
    SMTP_HOST    = var.smtp_host
    SMTP_PORT    = tostring(var.smtp_port)
    SMTP_FROM    = var.smtp_from
    BACKEND_URL  = var.backend_url
    FRONTEND_URL = var.frontend_url
  }

  privacy = "public"
}

# Custom Domain für den Container
resource "scaleway_container_domain" "flohmarkt_api" {
  container_id = scaleway_container.flohmarkt_api.id
  hostname     = "api.openzirndorf.de"
  region       = var.scw_region
}
