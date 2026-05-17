export const supabaseEnvKeys = {
  projectUrl: "FREE_AI_MIXER_SUPABASE_URL",
  anonKey: "FREE_AI_MIXER_SUPABASE_ANON_KEY",
  serviceRoleKey: "FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
  databaseUrl: "FREE_AI_MIXER_DATABASE_URL",
  dbProvider: "FREE_AI_MIXER_DB_PROVIDER",
  enableSupabaseDb: "FREE_AI_MIXER_ENABLE_SUPABASE_DB",
  enableDbMigrations: "FREE_AI_MIXER_ENABLE_DB_MIGRATIONS",
  appMode: "FREE_AI_MIXER_APP_MODE",
  storageBucketArtifacts: "FREE_AI_MIXER_STORAGE_BUCKET_ARTIFACTS",
  storageBucketUploads: "FREE_AI_MIXER_STORAGE_BUCKET_UPLOADS",
  viteServiceRoleKey: "VITE_FREE_AI_MIXER_SUPABASE_SERVICE_ROLE_KEY",
} as const;

export type SupabaseEnvLike = Record<string, string | undefined>;

export type SupabaseDbProvider = "disabled" | "supabase";

export interface SupabasePublicConfig {
  enabled: boolean;
  valid: boolean;
  dbProvider: SupabaseDbProvider;
  appMode: string;
  projectUrl?: string;
  anonKey?: string;
  storageBucketArtifacts?: string;
  storageBucketUploads?: string;
}

interface SupabaseConfigBase {
  enabled: boolean;
  valid: boolean;
  dbProvider: SupabaseDbProvider;
  appMode: string;
  migrationExecutionRequested: boolean;
  projectUrl?: string;
  anonKey?: string;
  serviceRoleKey?: string;
  databaseUrl?: string;
  storageBucketArtifacts?: string;
  storageBucketUploads?: string;
  errors: string[];
}

export interface DisabledSupabaseConfig extends SupabaseConfigBase {
  enabled: false;
  valid: true;
  dbProvider: "disabled";
  migrationExecutionRequested: false;
}

export interface EnabledInvalidSupabaseConfig extends SupabaseConfigBase {
  enabled: true;
  valid: false;
  dbProvider: "supabase";
}

export interface EnabledValidSupabaseConfig extends SupabaseConfigBase {
  enabled: true;
  valid: true;
  dbProvider: "supabase";
  projectUrl: string;
  serviceRoleKey: string;
}

export type SupabaseConfig =
  | DisabledSupabaseConfig
  | EnabledInvalidSupabaseConfig
  | EnabledValidSupabaseConfig;

const readEnvValue = (env: SupabaseEnvLike, key: string): string | undefined => {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const isFlagEnabled = (value: string | undefined): boolean => value === "1";

export const parseSupabaseConfig = (env: SupabaseEnvLike): SupabaseConfig => {
  const enabled = isFlagEnabled(readEnvValue(env, supabaseEnvKeys.enableSupabaseDb));
  const appMode = readEnvValue(env, supabaseEnvKeys.appMode) ?? "local";

  if (!enabled) {
    return {
      enabled: false,
      valid: true,
      dbProvider: "disabled",
      appMode,
      migrationExecutionRequested: false,
      errors: [],
    };
  }

  const errors: string[] = [];
  const dbProvider = readEnvValue(env, supabaseEnvKeys.dbProvider);
  const projectUrl = readEnvValue(env, supabaseEnvKeys.projectUrl);
  const anonKey = readEnvValue(env, supabaseEnvKeys.anonKey);
  const serviceRoleKey = readEnvValue(env, supabaseEnvKeys.serviceRoleKey);
  const databaseUrl = readEnvValue(env, supabaseEnvKeys.databaseUrl);
  const storageBucketArtifacts = readEnvValue(
    env,
    supabaseEnvKeys.storageBucketArtifacts,
  );
  const storageBucketUploads = readEnvValue(
    env,
    supabaseEnvKeys.storageBucketUploads,
  );
  const viteServiceRoleKey = readEnvValue(env, supabaseEnvKeys.viteServiceRoleKey);
  const migrationExecutionRequested = isFlagEnabled(
    readEnvValue(env, supabaseEnvKeys.enableDbMigrations),
  );

  if (dbProvider !== "supabase") {
    errors.push(
      `${supabaseEnvKeys.dbProvider} must be "supabase" when ${supabaseEnvKeys.enableSupabaseDb}=1.`,
    );
  }

  if (!projectUrl) {
    errors.push(
      `${supabaseEnvKeys.projectUrl} is required when ${supabaseEnvKeys.enableSupabaseDb}=1.`,
    );
  }

  if (!serviceRoleKey) {
    errors.push(
      `${supabaseEnvKeys.serviceRoleKey} is required when ${supabaseEnvKeys.enableSupabaseDb}=1.`,
    );
  }

  if (viteServiceRoleKey) {
    errors.push(
      `${supabaseEnvKeys.viteServiceRoleKey} must not be used for backend Supabase configuration.`,
    );
  }

  if (errors.length > 0) {
    return {
      enabled: true,
      valid: false,
      dbProvider: "supabase",
      appMode,
      migrationExecutionRequested,
      projectUrl,
      anonKey,
      serviceRoleKey,
      databaseUrl,
      storageBucketArtifacts,
      storageBucketUploads,
      errors,
    };
  }

  if (!projectUrl || !serviceRoleKey) {
    return {
      enabled: true,
      valid: false,
      dbProvider: "supabase",
      appMode,
      migrationExecutionRequested,
      projectUrl,
      anonKey,
      serviceRoleKey,
      databaseUrl,
      storageBucketArtifacts,
      storageBucketUploads,
      errors: [
        `${supabaseEnvKeys.projectUrl} and ${supabaseEnvKeys.serviceRoleKey} are required when ${supabaseEnvKeys.enableSupabaseDb}=1.`,
      ],
    };
  }

  return {
    enabled: true,
    valid: true,
    dbProvider: "supabase",
    appMode,
    migrationExecutionRequested,
    projectUrl,
    anonKey,
    serviceRoleKey,
    databaseUrl,
    storageBucketArtifacts,
    storageBucketUploads,
    errors: [],
  };
};

export const getPublicSupabaseConfig = (
  config: SupabaseConfig,
): SupabasePublicConfig => ({
  enabled: config.enabled,
  valid: config.valid,
  dbProvider: config.dbProvider,
  appMode: config.appMode,
  ...(config.projectUrl ? { projectUrl: config.projectUrl } : {}),
  ...(config.anonKey ? { anonKey: config.anonKey } : {}),
  ...(config.storageBucketArtifacts
    ? { storageBucketArtifacts: config.storageBucketArtifacts }
    : {}),
  ...(config.storageBucketUploads
    ? { storageBucketUploads: config.storageBucketUploads }
    : {}),
});

export const readSupabaseConfigFromEnv = (
  env: SupabaseEnvLike = process.env,
): SupabaseConfig => parseSupabaseConfig(env);
