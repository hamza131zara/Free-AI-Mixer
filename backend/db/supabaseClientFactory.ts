import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  EnabledValidSupabaseConfig,
  SupabaseConfig,
  SupabasePublicConfig,
} from "../config/supabaseConfig";
import { getPublicSupabaseConfig } from "../config/supabaseConfig";

export type SupabaseClientUnavailableReason =
  | "disabled"
  | "invalid_config";

export interface SupabaseClientUnavailable {
  kind: "supabase_client_unavailable";
  reason: SupabaseClientUnavailableReason;
  enabled: boolean;
  valid: boolean;
  errors: string[];
  publicConfig: SupabasePublicConfig;
}

export interface SupabaseAdminClientHandle {
  kind: "supabase_admin_client_handle";
  runtime: "sdk_installed";
  projectUrl: string;
  client: SupabaseClient;
}

export interface SupabaseClientFactory {
  kind: "supabase_client_factory";
  enabled: true;
  valid: true;
  runtime: "sdk_installed";
  createAdminClientHandle: () => SupabaseAdminClientHandle;
  publicConfig: SupabasePublicConfig;
}

export type SupabaseClientFactoryResult =
  | SupabaseClientUnavailable
  | SupabaseClientFactory;

const toUnavailableResult = (
  config: SupabaseConfig,
  reason: SupabaseClientUnavailableReason,
): SupabaseClientUnavailable => ({
  kind: "supabase_client_unavailable",
  reason,
  enabled: config.enabled,
  valid: config.valid,
  errors: [...config.errors],
  publicConfig: getPublicSupabaseConfig(config),
});

const createAdminClientHandle = (
  config: EnabledValidSupabaseConfig,
): SupabaseAdminClientHandle => ({
  kind: "supabase_admin_client_handle",
  runtime: "sdk_installed",
  projectUrl: config.projectUrl,
  client: createClient(config.projectUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }),
});

export const createSupabaseClientFactory = (
  config: SupabaseConfig,
): SupabaseClientFactoryResult => {
  if (!config.enabled) {
    return toUnavailableResult(config, "disabled");
  }

  if (!config.valid) {
    return toUnavailableResult(config, "invalid_config");
  }

  return {
    kind: "supabase_client_factory",
    enabled: true,
    valid: true,
    runtime: "sdk_installed",
    createAdminClientHandle: () => createAdminClientHandle(config),
    publicConfig: getPublicSupabaseConfig(config),
  };
};
