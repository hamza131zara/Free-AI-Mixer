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

export const getMigrationWorkflowBoundary = (): MigrationWorkflowBoundary =>
  migrationWorkflowBoundary;

export const getLocalMigrationPreflightBoundary =
  (): LocalMigrationPreflightBoundary => localMigrationPreflightBoundary;
