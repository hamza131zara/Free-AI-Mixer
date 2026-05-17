export interface MigrationWorkflowCommandDescriptor {
  name: string;
  scope: "local" | "remote";
  executesMigrations: false;
  requiresExplicitManualExecution: true;
  requiresRealCredentials: false;
  allowedInTests: false;
  description: string;
  exampleCommand: string;
}

export interface MigrationWorkflowBoundary {
  kind: "migration_workflow_boundary";
  executesOnStartup: false;
  executesFromRoutes: false;
  executesFromClientFactory: false;
  requiresSupabaseCliSetup: true;
  requiresExplicitTargetSelection: true;
  commands: readonly MigrationWorkflowCommandDescriptor[];
}

export interface LocalMigrationPreflightBoundary {
  kind: "local_migration_preflight_boundary";
  localOnly: true;
  remoteOrProductionDeferred: true;
  manualInvocationOnly: true;
  executesMigrations: false;
  spawnsSupabaseCli: false;
  requiresCleanGitStatus: true;
  requiresExplicitMigrationFileSelection: true;
  requiresNoRemoteProjectLink: true;
  requiresNoProductionCredentials: true;
  resetOrRollbackScope: "local_dev_only";
  migrationFilePath: "backend/db/migrations/0001_initial_supabase_postgres_schema.sql";
  intendedValidationMode: "manual_local_supabase_only";
}

export interface LocalCliDockerReadinessCheckDescriptor {
  name:
    | "supabase_cli_version_check"
    | "supabase_status_check"
    | "supabase_start_local_stack"
    | "supabase_stop_local_stack"
    | "supabase_db_reset_local"
    | "docker_version_check"
    | "docker_info_check";
  tool: "supabase_cli" | "docker";
  manualOnly: true;
  readinessVerifiedByDefault: false;
  executesMigrations: false;
  spawnsProcessInCode: false;
  localOnly: true;
  description: string;
  exampleCommand: string;
}

export interface LocalCliDockerReadinessBoundary {
  kind: "local_cli_docker_readiness_boundary";
  localOnly: true;
  manualOnly: true;
  cliReadinessVerifiedByDefault: false;
  dockerReadinessVerifiedByDefault: false;
  executesMigrations: false;
  spawnsSupabaseCli: false;
  spawnsDocker: false;
  requiresCleanGitStatus: true;
  requiresNoRemoteProjectLink: true;
  requiresNoProductionCredentials: true;
  requiresExplicitMigrationFileSelection: true;
  requiresExplicitLocalResetWarning: true;
  executesOnStartup: false;
  executesFromRoutes: false;
  executesFromClientFactory: false;
  remoteOrProductionDeferred: true;
  migrationFilePath: "backend/db/migrations/0001_initial_supabase_postgres_schema.sql";
  checks: readonly LocalCliDockerReadinessCheckDescriptor[];
}

const migrationWorkflowCommands: readonly MigrationWorkflowCommandDescriptor[] = [
  {
    name: "db:migrate:local:manual",
    scope: "local",
    executesMigrations: false,
    requiresExplicitManualExecution: true,
    requiresRealCredentials: false,
    allowedInTests: false,
    description:
      "Reserved name for a future local-only migration command. This boundary does not execute it.",
    exampleCommand: "supabase migration up --local",
  },
  {
    name: "db:migrate:remote:manual",
    scope: "remote",
    executesMigrations: false,
    requiresExplicitManualExecution: true,
    requiresRealCredentials: false,
    allowedInTests: false,
    description:
      "Reserved name for a future remote migration command. This boundary does not execute it.",
    exampleCommand: "supabase db push --linked",
  },
] as const;

const localCliDockerReadinessChecks: readonly LocalCliDockerReadinessCheckDescriptor[] = [
  {
    name: "supabase_cli_version_check",
    tool: "supabase_cli",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only Supabase CLI version check for local readiness. This boundary does not execute it.",
    exampleCommand: "supabase --version",
  },
  {
    name: "supabase_status_check",
    tool: "supabase_cli",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only local stack status check. This boundary does not execute it.",
    exampleCommand: "supabase status",
  },
  {
    name: "supabase_start_local_stack",
    tool: "supabase_cli",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only local stack startup check. This boundary does not execute it.",
    exampleCommand: "supabase start",
  },
  {
    name: "supabase_stop_local_stack",
    tool: "supabase_cli",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only local stack shutdown check. This boundary does not execute it.",
    exampleCommand: "supabase stop",
  },
  {
    name: "supabase_db_reset_local",
    tool: "supabase_cli",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only local reset check with destructive local-dev warning. This boundary does not execute it.",
    exampleCommand: "supabase db reset",
  },
  {
    name: "docker_version_check",
    tool: "docker",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only Docker version check for local Supabase readiness. This boundary does not execute it.",
    exampleCommand: "docker --version",
  },
  {
    name: "docker_info_check",
    tool: "docker",
    manualOnly: true,
    readinessVerifiedByDefault: false,
    executesMigrations: false,
    spawnsProcessInCode: false,
    localOnly: true,
    description:
      "Future manual-only Docker info check for local daemon readiness. This boundary does not execute it.",
    exampleCommand: "docker info",
  },
] as const;

export const migrationWorkflowBoundary: MigrationWorkflowBoundary = {
  kind: "migration_workflow_boundary",
  executesOnStartup: false,
  executesFromRoutes: false,
  executesFromClientFactory: false,
  requiresSupabaseCliSetup: true,
  requiresExplicitTargetSelection: true,
  commands: migrationWorkflowCommands,
};

export const localMigrationPreflightBoundary: LocalMigrationPreflightBoundary = {
  kind: "local_migration_preflight_boundary",
  localOnly: true,
  remoteOrProductionDeferred: true,
  manualInvocationOnly: true,
  executesMigrations: false,
  spawnsSupabaseCli: false,
  requiresCleanGitStatus: true,
  requiresExplicitMigrationFileSelection: true,
  requiresNoRemoteProjectLink: true,
  requiresNoProductionCredentials: true,
  resetOrRollbackScope: "local_dev_only",
  migrationFilePath: "backend/db/migrations/0001_initial_supabase_postgres_schema.sql",
  intendedValidationMode: "manual_local_supabase_only",
};

export const localCliDockerReadinessBoundary: LocalCliDockerReadinessBoundary = {
  kind: "local_cli_docker_readiness_boundary",
  localOnly: true,
  manualOnly: true,
  cliReadinessVerifiedByDefault: false,
  dockerReadinessVerifiedByDefault: false,
  executesMigrations: false,
  spawnsSupabaseCli: false,
  spawnsDocker: false,
  requiresCleanGitStatus: true,
  requiresNoRemoteProjectLink: true,
  requiresNoProductionCredentials: true,
  requiresExplicitMigrationFileSelection: true,
  requiresExplicitLocalResetWarning: true,
  executesOnStartup: false,
  executesFromRoutes: false,
  executesFromClientFactory: false,
  remoteOrProductionDeferred: true,
  migrationFilePath: "backend/db/migrations/0001_initial_supabase_postgres_schema.sql",
  checks: localCliDockerReadinessChecks,
};

export const getMigrationWorkflowBoundary = (): MigrationWorkflowBoundary =>
  migrationWorkflowBoundary;

export const getLocalMigrationPreflightBoundary =
  (): LocalMigrationPreflightBoundary => localMigrationPreflightBoundary;

export const getLocalCliDockerReadinessBoundary =
  (): LocalCliDockerReadinessBoundary => localCliDockerReadinessBoundary;
