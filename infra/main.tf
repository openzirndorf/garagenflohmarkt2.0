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
    use_lockfile                = true # OpenTofu 1.10+ native S3 locking ohne DynamoDB
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
# 7-Tage-Backup-Aufbewahrung - hier lässt sich backup_schedule_retention
# stattdessen explizit kurz halten, damit Backups nicht länger als nötig
# personenbezogene Daten vorhalten.
resource "scaleway_rdb_instance" "flohmarkt" {
  name          = "flohmarkt-db"
  node_type     = "DB-DEV-S"
  engine        = "PostgreSQL-16"
  is_ha_cluster = false

  disable_backup            = false
  backup_schedule_frequency = 24 # Stunden
  backup_schedule_retention = 3  # Tage - bewusst kurz gehalten

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

# Der über user_name/password auf der Instanz angelegte "flohmarkt"-Nutzer
# bekommt auf frisch angelegten Datenbanken KEIN automatisches CONNECT-Recht
# (anders als auf der von Scaleway mitgelieferten Default-Datenbank) - ohne
# diese explizite Grant-Ressource schlägt jede Verbindung mit
# "permission denied for database" fehl.
resource "scaleway_rdb_privilege" "flohmarkt" {
  instance_id   = scaleway_rdb_instance.flohmarkt.id
  database_name = scaleway_rdb_database.flohmarkt.name
  user_name     = scaleway_rdb_instance.flohmarkt.user_name
  permission    = "all"
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

# Die Bucket-ACL allein macht nur den Bucket selbst öffentlich lesbar, nicht
# einzelne Objekte - ohne eigenes ACL="public-read" bei jedem put_object()
# (siehe app/jobs/stands_artifact.py) bleiben hochgeladene Objekte privat und
# liefern 403 statt der Karten-Daten. Eine Bucket-Policy wirkt unabhängig
# davon, wie/von wem ein Objekt hochgeladen wurde - robuster als sich auf
# ACL-Parameter in jedem einzelnen Upload-Aufruf zu verlassen.
resource "scaleway_object_bucket_policy" "stands" {
  bucket = scaleway_object_bucket.stands.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadStands"
      Effect    = "Allow"
      Principal = "*"
      Action    = ["s3:GetObject"]
      Resource  = ["${scaleway_object_bucket.stands.name}/*"]
    }]
  })
}

# Eigener API-Key nur für den S3-Zugriff der Jobs: die org-weiten
# Terraform/Mailing-Zugangsdaten (var.scw_access_key/secret_key) haben
# default_project_id = OpenZirndorf-Projekt - Scaleways S3-kompatible API
# löst den Projekt-Kontext eines Requests über den Access Key auf, nicht
# über die Bucket-URL. Mit diesen Zugangsdaten schlägt PutObject auf einen
# Bucket im Garagenflohmarkt-Projekt deshalb mit AccessDenied fehl, obwohl
# Terraform selbst (das project_id explizit mitschickt) den Bucket anlegen
# konnte. Eigener, auf dieses Projekt beschränkter Key mit reinem
# Object-Storage-Recht behebt das und ist zugleich das kleinere Berechtigungs-
# Scope als der breite Ausgangs-Key.
resource "scaleway_iam_application" "stands_storage" {
  name        = "garagenflohmarkt-stands-storage"
  description = "S3-Zugriff für stands_artifact_cron auf den stands-Bucket"
}

resource "scaleway_iam_policy" "stands_storage" {
  name           = "garagenflohmarkt-stands-storage"
  application_id = scaleway_iam_application.stands_storage.id

  rule {
    project_ids          = [var.scw_project_id]
    permission_set_names = ["ObjectStorageFullAccess"]
  }
}

resource "scaleway_iam_api_key" "stands_storage" {
  application_id     = scaleway_iam_application.stands_storage.id
  default_project_id = var.scw_project_id
  description        = "S3-Zugriff stands-Bucket (garagenflohmarkt-Projekt)"
  # Die Organisation verlangt ein Ablaufdatum für API-Keys - bewusst kurz nach
  # der Löschfrist (07.10.2026) gesetzt statt eines fernen Standardwerts,
  # da der Key ohnehin nur für die Laufzeit des Events gebraucht wird.
  expires_at = "2026-10-31T00:00:00Z"
}

# Container Registry Namespace – speichert das Docker Image der API
resource "scaleway_registry_namespace" "flohmarkt" {
  name      = "openzirndorf-flohmarkt"
  region    = var.scw_region
  is_public = false
}

# Container Namespace (Serverless Containers). War ursprünglich (Name
# "openzirndorf") versehentlich im geteilten openzirndorf-Projekt angelegt,
# nicht im dedizierten garagenflohmarkt-Projekt - project_id war früher
# implizit (kein eigenes Scaleway-Projekt für dieses Repo, computed einmalig
# bei Erstellung, seither nie neu bewertet). Explizit gesetzt + umbenannt,
# damit der Namespace-Name zum tatsächlichen Projekt passt.
resource "scaleway_container_namespace" "flohmarkt_ns" {
  name       = "garagenflohmarkt"
  region     = var.scw_region
  project_id = var.scw_project_id
}

# Serverless Container – läuft das FastAPI-Backend
resource "scaleway_container" "flohmarkt_api" {
  name           = "flohmarkt-api"
  namespace_id   = scaleway_container_namespace.flohmarkt_ns.id
  registry_image = "${scaleway_registry_namespace.flohmarkt.endpoint}/flohmarkt-api:${var.container_image_tag}"

  port         = 8080
  cpu_limit    = 1000
  memory_limit = 1024
  # 0 spart Kosten außerhalb des Events, riskiert aber Kaltstarts (siehe
  # bekannte Falle zu memory_limit/timeout weiter oben in diesem Projekt).
  # Kurz vor dem 4. Oktober manuell auf 1 setzen (keine Kaltstarts mehr am
  # Veranstaltungstag selbst), danach wieder auf 0 zurück - bewusst kein
  # Dauerzustand (läuft sonst durchgehend und kostet entsprechend) und
  # keine automatische Zeitsteuerung für ein derart seltenes Ereignis.
  min_scale = 0
  max_scale = 5

  secret_environment_variables = {
    DATABASE_URL  = local.database_url
    ADMIN_TOKEN   = var.admin_token
    API_USERNAME  = var.api_username
    API_PASSWORD  = var.api_password
    SMTP_PASSWORD = var.scw_secret_key
    # Eigener, auf dieses Projekt beschränkter Key (siehe
    # scaleway_iam_api_key.stands_storage oben) - der breite
    # Terraform/Mailing-Key hat default_project_id = OpenZirndorf-Projekt und
    # bekäme beim S3-PutObject auf diesen Bucket AccessDenied.
    S3_ACCESS_KEY = scaleway_iam_api_key.stands_storage.access_key
    S3_SECRET_KEY = scaleway_iam_api_key.stands_storage.secret_key
    # Siehe variables.tf: ohne gesetzten Key fällt app/geocode.py auf die
    # öffentliche Nominatim-Instanz zurück - für die Produktion vor dem
    # ersten echten Betrieb bei opencagedata.com registrieren und setzen.
    GEOCODE_API_KEY = var.geocode_api_key
  }

  environment_variables = {
    SMTP_HOST     = "smtp.tem.scaleway.com"
    SMTP_PORT     = "465"
    SMTP_USER     = var.smtp_project_id
    SMTP_FROM     = var.smtp_from
    BACKEND_URL   = var.backend_url
    FRONTEND_URL  = var.frontend_url
    # Siehe variables.tf: steuert die Platzhalter-/Countdown-Seite
    # (GET /launch-config, frontend/src/components/coming-soon.tsx). Leer
    # ist ein gültiger Zustand ("Datum steht noch nicht fest").
    LAUNCH_AT     = var.launch_at
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
    S3_ACCESS_KEY = scaleway_iam_api_key.stands_storage.access_key
    S3_SECRET_KEY = scaleway_iam_api_key.stands_storage.secret_key
  }

  cron {
    schedule = "*/5 * * * *"
    timezone = "Europe/Berlin"
  }
}

# Custom Domain für den Container - bleibt bestehen, auch wenn das Frontend
# jetzt vom selben Container mitbeantwortet wird (siehe
# scaleway_container_domain.flohmarkt_frontend unten): kostet nichts extra,
# und nichts zwingt dazu, sie stillzulegen.
resource "scaleway_container_domain" "flohmarkt_api" {
  container_id = scaleway_container.flohmarkt_api.id
  hostname     = "api.openzirndorf.de"
  region       = var.scw_region
}

# Zweite Custom Domain für denselben Container - liefert ab jetzt sowohl
# die API als auch das mitgebaute Frontend aus (siehe Dockerfile,
# app/main.py Catch-all-Route). Ersetzt das bisherige Hosting auf GitHub
# Pages. Der Nutzer legt den DNS-Eintrag (CNAME auf den unten ausgegebenen
# Scaleway-Endpunkt) selbst um, sobald diese Ressource existiert.
resource "scaleway_container_domain" "flohmarkt_frontend" {
  container_id = scaleway_container.flohmarkt_api.id
  hostname     = "garagenflohmarkt.openzirndorf.de"
  region       = var.scw_region
}
