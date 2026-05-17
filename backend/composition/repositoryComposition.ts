import type { SupabaseConfig, SupabasePublicConfig } from "../config/supabaseConfig";
import { getPublicSupabaseConfig } from "../config/supabaseConfig";
import type {
  SupabaseClientFactory,
  SupabaseClientFactoryResult,
} from "../db/supabaseClientFactory";
import { createSupabaseClientFactory } from "../db/supabaseClientFactory";
import {
  createSupabaseExportJobsRepository,
  type ExportJobRow,
  type SupabaseExportJobsClient,
} from "../repositories/supabaseExportJobsRepository";
import {
  createSupabaseAccountWorkspaceRepository,
  type SupabaseAccountWorkspaceClient,
} from "../repositories/supabaseAccountWorkspaceRepository";
import type {
  BackendExportJobsRepository,
  BackendUserAccountRepository,
  BackendWorkspaceMembershipRepository,
  BackendWorkspaceRepository,
} from "../repositories/repositoryContracts";

export interface BackendDatabaseRepositories {
  exportJobsRepository: BackendExportJobsRepository;
  userAccountRepository: BackendUserAccountRepository;
  workspaceRepository: BackendWorkspaceRepository;
  workspaceMembershipRepository: BackendWorkspaceMembershipRepository;
}

export interface DisabledRepositoryComposition {
  kind: "repository_composition_disabled";
  dbBacked: false;
  enabled: boolean;
  valid: boolean;
  reason: "disabled" | "invalid_config";
  publicConfig: SupabasePublicConfig;
}

export interface AvailableRepositoryComposition {
  kind: "repository_composition_available";
  dbBacked: true;
  enabled: true;
  valid: true;
  publicConfig: SupabasePublicConfig;
  createRepositories: () => BackendDatabaseRepositories;
}

export type BackendRepositoryComposition =
  | DisabledRepositoryComposition
  | AvailableRepositoryComposition;

const toDisabledRepositoryComposition = (
  config: SupabaseConfig,
  reason: DisabledRepositoryComposition["reason"],
): DisabledRepositoryComposition => ({
  kind: "repository_composition_disabled",
  dbBacked: false,
  enabled: config.enabled,
  valid: config.valid,
  reason,
  publicConfig: getPublicSupabaseConfig(config),
});

const createRepositoriesFromClientFactory = (
  clientFactory: SupabaseClientFactory,
): BackendDatabaseRepositories => {
  const adminHandle = clientFactory.createAdminClientHandle();
  const exportJobsRepository = createSupabaseExportJobsRepository(
    adminHandle.client as unknown as SupabaseExportJobsClient<ExportJobRow>,
  );
  const accountWorkspaceRepository = createSupabaseAccountWorkspaceRepository(
    adminHandle.client as unknown as SupabaseAccountWorkspaceClient,
  );

  return {
    exportJobsRepository,
    userAccountRepository: accountWorkspaceRepository,
    workspaceRepository: accountWorkspaceRepository,
    workspaceMembershipRepository: accountWorkspaceRepository,
  };
};

export const createRepositoryComposition = (
  config: SupabaseConfig,
  clientFactoryResult: SupabaseClientFactoryResult = createSupabaseClientFactory(config),
): BackendRepositoryComposition => {
  if (!config.enabled) {
    return toDisabledRepositoryComposition(config, "disabled");
  }

  if (!config.valid || clientFactoryResult.kind !== "supabase_client_factory") {
    return toDisabledRepositoryComposition(config, "invalid_config");
  }

  return {
    kind: "repository_composition_available",
    dbBacked: true,
    enabled: true,
    valid: true,
    publicConfig: clientFactoryResult.publicConfig,
    createRepositories: () => createRepositoriesFromClientFactory(clientFactoryResult),
  };
};
