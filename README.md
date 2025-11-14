# @crisog/railway-mcp-server

> **⚠️ This is an unofficial MCP server for Railway**
>
> This project is not affiliated with, officially maintained by, or endorsed by Railway. It is a community-built integration.

An unofficial Model Context Protocol (MCP) server for exposing Railway resources and automation tools to MCP-compatible clients.

## Quick Start

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=railway-mcp-server&config=eyJjb21tYW5kIjoibnB4IC15IEBjcmlzb2cvcmFpbHdheS1tY3Atc2VydmVyIn0%3D)

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

## Token Types & Scope

Railway supports three types of API tokens, each with different access levels:

- **Account Token**: Global access to everything, multiple workspaces
- **Workspace Token**: Single workspace access, multiple projects
- **Project Token**: Scoped to specific environment within a project

### Token Scope Matrix

| Tool Category           | Account Token  | Workspace Token   | Project Token     |
| ----------------------- | -------------- | ----------------- | ----------------- |
| **Projects**            | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Services**            | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Environments**        | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Deployments**         | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Variables**           | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Domains**             | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Templates**           | ✅ Full Access | ✅ Full Access    | ✅ Full Access    |
| **Networking**          | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Observability**       | ✅ Full Access | ✅ Full Access    | ❌ Not Authorized |
| **Workflows**           | ⚠️ Limited     | ⚠️ Limited        | ❌ Not Authorized |
| **GitHub Integrations** | ✅ Full Access | ❌ Not Authorized | ❌ Not Authorized |
| **Volumes**             | ✅ Full Access | ✅ Full Access    | ✅ Backups Only   |

**Legend:**

- ✅ Full Access - All operations work
- ⚠️ Limited - Some operations may be restricted
- ❌ Not Authorized - Token scope doesn't allow access

**Key Differences:**

- **Account Token**: Required for GitHub integrations. All other operations work identically to Workspace Token.
- **Workspace Token**: Best for most operations. Workflow status works for template deployments but volume backup workflows return "Not Authorized". All other operations work correctly.
- **Project Token**: Environment-scoped access. Only templates work fully. Volume backup operations (create, list) work with valid volume instance IDs in the token's scoped environment. Volume creation is not authorized. Deployment and observability operations return "Not Authorized" even for deployments in the token's scoped environment.

## Available Tools

This MCP server provides **51 tools** for managing Railway infrastructure, organized into the following categories:

### Projects

- `railway_projects_list` - List all projects for a user or workspace
- `railway_project_create` - Create a new Railway project
- `railway_project_get` - Get project details
- `railway_workspaces_list` - List all workspaces the user is a member of

### Services

- `railway_services_list` - List all services in a project
- `railway_service_get` - Get service details
- `railway_service_create` - Create a new service in a project
- `railway_service_update` - Update service metadata (name, icon)
- `railway_service_deploy_latest` - Deploy service using latest commit or specific commit
- `railway_service_instance_build_command_update` - Update the build command for a service instance (advanced; can change how your service builds)
- `railway_service_instance_start_command_update` - Update the start command for a service instance (advanced; can change how your service runs)
- `railway_service_instance_predeploy_commands_update` - Update pre-deploy commands for a service instance (advanced; runs before each deployment)

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
- `railway_environment_get_by_name` - Get an environment by its name (useful when environments_list returns empty results)

### Variables

- `railway_variable_upsert` - Create or update a variable (project or service scope)
- `railway_variables_collection_upsert` - Bulk create/update multiple variables
- `railway_variables_render_for_deployment` - Resolve concrete variables for a service deployment

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
- `railway_volume_instances_list` - List all volume instances for an environment
- `railway_volume_instance_backup_create` - Create a volume backup
- `railway_volume_instance_backup_list` - List all backups for a volume
- `railway_volume_instance_backup_restore` - Restore a volume instance from a backup

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
