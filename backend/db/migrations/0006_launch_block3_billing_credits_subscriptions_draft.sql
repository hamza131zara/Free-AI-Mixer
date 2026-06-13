-- Launch Block 3 billing / credits / subscriptions draft migration.
-- Manual review/apply only. Do not auto-apply to remote production.
-- Public clients should not receive direct table access; backend service role
-- owns writes and must serialize safe metadata only.

create table if not exists billing_customers (
  billing_customer_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_id uuid not null references app_users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paddle')),
  provider_customer_ref text,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, provider)
);

create table if not exists billing_subscriptions (
  billing_subscription_id uuid primary key default gen_random_uuid(),
  billing_customer_id uuid references billing_customers(billing_customer_id) on delete set null,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'paddle')),
  provider_subscription_ref text,
  plan_id text not null,
  status text not null default 'not_configured'
    check (status in ('not_configured', 'trialing', 'active', 'past_due', 'canceled', 'paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_wallets (
  wallet_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade unique,
  balance integer not null default 0 check (balance >= 0),
  status text not null default 'not_configured'
    check (status in ('not_configured', 'active', 'disabled')),
  currency_code text not null default 'platform_credits',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger_entries (
  ledger_entry_id uuid primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  job_id text,
  reservation_id text,
  kind text not null
    check (kind in ('grant', 'purchase', 'reservation', 'settlement', 'release', 'refund', 'adjustment', 'expiry')),
  amount_delta integer not null,
  reason_code text not null,
  idempotency_key text not null unique,
  actor_source text not null
    check (actor_source in ('system', 'user', 'admin', 'billing_webhook', 'generation_runtime', 'export_runtime')),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists credit_reservations (
  reservation_id text primary key,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid references app_users(id) on delete set null,
  job_id text,
  requested_amount integer not null check (requested_amount > 0),
  state text not null
    check (state in ('planned', 'reserved', 'settled', 'released', 'refunded', 'expired')),
  idempotency_key text not null unique,
  reason_code text,
  settlement_reason_code text,
  settlement_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists usage_limits (
  usage_limit_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  surface text not null
    check (surface in ('image_generation', 'video_generation', 'artifact_storage', 'artifact_delivery')),
  limit_window text not null check (limit_window in ('daily', 'monthly')),
  limit_amount integer not null check (limit_amount >= 0),
  status text not null default 'not_configured'
    check (status in ('not_configured', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, surface, limit_window)
);

create table if not exists provider_cost_estimates (
  provider_cost_estimate_id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  surface text not null,
  unit text not null,
  estimate_state text not null default 'draft_only'
    check (estimate_state in ('draft_only', 'provider_billing_required', 'platform_credits_not_configured')),
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists billing_events (
  billing_event_id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete set null,
  provider text not null check (provider in ('stripe', 'paddle')),
  event_type text not null,
  event_state text not null default 'received'
    check (event_state in ('received', 'ignored', 'processed', 'failed')),
  provider_event_ref text,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table billing_customers enable row level security;
alter table billing_subscriptions enable row level security;
alter table credit_wallets enable row level security;
alter table credit_ledger_entries enable row level security;
alter table credit_reservations enable row level security;
alter table usage_limits enable row level security;
alter table provider_cost_estimates enable row level security;
alter table billing_events enable row level security;

-- Default-deny posture: no permissive RLS policy is included in this draft.
-- Production policies require separate review before public launch.
