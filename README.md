# @crisog/railway-mcp-server

> **⚠️ This is an unofficial MCP server for Railway**
>
> This project is not affiliated with, officially maintained by, or endorsed by Railway. It is a community-built integration.

An unofficial Model Context Protocol (MCP) server for exposing Railway resources and automation tools to MCP-compatible clients.

## Quick Start

### Add to Cursor

<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=railway-mcp-server&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBjcmlzb2cvcmFpbHdheS1tY3Atc2VydmVyIl19">
  <img src="https://img.shields.io/badge/Add_to-Cursor-black?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiAyMkwyMiAxMkwxMiAyWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+" alt="Add to Cursor">
</a>

This will add the following configuration to your Cursor settings:

```json
{
  "mcpServers": {
    "railway-mcp-server": {
      "command": "npx",
      "args": ["-y", "@crisog/railway-mcp-server"]
    }
  }
}
```

## Available Tools

This MCP server provides **47 tools** for managing Railway infrastructure, organized into the following categories:

### Connection & Verification

- `railway_verify_connection` - Verify Railway API authentication

### Projects

- `railway_projects_list` - List all projects for a user or workspace
- `railway_project_create` - Create a new Railway project
- `railway_project_get` - Get project details

### Services

- `railway_services_list` - List all services in a project
- `railway_service_get` - Get service details
- `railway_service_create` - Create a new service in a project
- `railway_service_update` - Update service metadata (name, icon)
- `railway_service_deploy_latest` - Deploy service using latest commit or specific commit

### Deployments

- `railway_deployment_list` - List deployments with filtering options
- `railway_deployment_get` - Get deployment details
- `railway_deployment_logs` - Fetch deployment logs
- `railway_deployment_events` - Fetch deployment events
- `railway_deployment_redeploy` - Redeploy a previous deployment
- `railway_deployment_restart` - Restart a deployment
- `railway_deployment_stop` - Stop a running deployment
- `railway_deployment_cancel` - Cancel a pending/in-progress deployment
- `railway_deployment_rollback` - Rollback to a previous deployment

### Environments

- `railway_environments_list` - List all environments for a project
- `railway_environment_create` - Create a new environment (optionally clone from existing)
- `railway_environment_rename` - Rename an environment
- `railway_environment_logs` - Fetch environment logs

### Variables

- `railway_variable_upsert` - Create or update a variable (project or service scope)
- `railway_variables_collection_upsert` - Bulk create/update multiple variables
- `railway_variables_render_for_deployment` - Resolve concrete variables for a deployment

### Templates

- `railway_templates_list` - List available templates with pagination and filtering
- `railway_template_get` - Get template details by code or GitHub owner/repo
- `railway_template_deploy` - Deploy a template into a project or workspace

### Domains

- `railway_domain_generate` - Generate a railway.app domain for a service
- `railway_domains_list` - List all domains for a service in an environment
- `railway_custom_domain_create` - Add a custom domain to a service
- `railway_custom_domain_available` - Check if a custom domain is available

### Volumes

- `railway_volume_create` - Create a new volume for persistent storage
- `railway_volume_instance_backup_create` - Create a volume backup
- `railway_volume_instance_backup_list` - List all backups for a volume
- `railway_volume_instance_backup_restore` - Restore a volume from backup

### Observability

- `railway_observability_http_logs` - Get HTTP request logs for a deployment
- `railway_observability_build_logs` - Get build logs for a deployment
- `railway_observability_events` - Get system events for a project

### Integrations

- `railway_github_repos_list` - List accessible GitHub repositories
- `railway_github_branches_list` - List branches for a GitHub repository
- `railway_github_repo_deploy` - Deploy a GitHub repository to Railway

### Networking

- `railway_private_network_create_or_get` - Create or retrieve a private network
- `railway_private_networks_list` - List all private networks for an environment
- `railway_tcp_proxies_list` - List TCP proxies for a service

### Workflows

- `railway_workflow_status` - Check status of asynchronous Railway workflows
