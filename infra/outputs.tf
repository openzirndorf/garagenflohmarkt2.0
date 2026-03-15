output "database_connection_string" {
  description = "Vollständiger PostgreSQL Connection String (IAM Credentials eingebettet)"
  value       = local.database_url
  sensitive   = true
}

output "registry_endpoint" {
  description = "Docker Registry Endpoint (für docker push)"
  value       = scaleway_registry_namespace.flohmarkt.endpoint
}

output "container_url" {
  description = "Automatisch generierte Container URL (vor Custom Domain)"
  value       = scaleway_container.flohmarkt_api.domain_name
}

output "api_url" {
  description = "Öffentliche API URL (direkte Scaleway URL)"
  value       = "https://${scaleway_container.flohmarkt_api.domain_name}"
}
