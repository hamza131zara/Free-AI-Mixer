import { createHash } from "node:crypto";
import type { SupabaseClientFactoryResult } from "../db/supabaseClientFactory";
import type {
  CreditLedgerEntry,
  CreditLedgerEntryKind,
} from "./creditLedgerTypes";
import type {
  CreditReservationRequest,
  CreditReservationState,
  CreditSettlementRequest,
} from "./creditReservationTypes";

export type CreditWalletRepositoryReadiness =
  | {
      kind: "ready";
      status: "available";
    }
  | {
      kind: "unavailable";
      status: "platform_credits_not_configured" | "credit_tables_unavailable";
      message: string;
    };

export interface CreditWalletStatus {
  state: "platform_credits_not_configured" | "wallet_unavailable" | "available";
  scope: "workspace";
  liveBalanceAvailable: boolean;
  message: string;
  activeWorkspaceId?: string;
  balance?: number;
  currencyCode?: "platform_credits";
}

export type CreditRepositoryMutationResult =
  | {
      kind: "ok";
      status: "recorded" | "idempotent_replay";
    }
  | {
      kind: "unavailable";
      status:
        | "platform_credits_not_configured"
        | "credit_tables_unavailable"
        | "insufficient_credits"
        | "credit_mutation_failed";
      message: string;
    };

export interface CreditReservationRecord {
  reservationId: string;
  state: CreditReservationState;
  requestedAmount: number;
  workspaceId: string;
  userId?: string;
  jobId?: string;
  idempotencyKey: string;
}

export interface UsageLimitLookupResult {
  kind: "available" | "unavailable";
  status: "available" | "usage_limits_not_configured";
  message: string;
}

export interface CreditWalletRepository {
  getReadiness(): CreditWalletRepositoryReadiness;
  getWalletStatus(workspaceId: string): Promise<CreditWalletStatus>;
  createLedgerEntry(
    input: CreditLedgerEntry,
  ): Promise<CreditRepositoryMutationResult>;
  reserveCredits(
    input: CreditReservationRequest,
  ): Promise<CreditRepositoryMutationResult>;
  settleReservation(
    input: CreditSettlementRequest,
  ): Promise<CreditRepositoryMutationResult>;
  getReservation(
    reservationId: string,
  ): Promise<CreditReservationRecord | undefined>;
  getUsageLimit(workspaceId: string): Promise<UsageLimitLookupResult>;
}

export interface SupabaseCreditQueryResult<Row = Record<string, unknown>> {
  data?: Row[] | Row | null;
  error: { code?: string | null; message: string } | null;
}

export interface SupabaseCreditTableQuery<Row = Record<string, unknown>> {
  select(columns?: string): SupabaseCreditTableQuery<Row>;
  eq(column: string, value: string | number | boolean): SupabaseCreditTableQuery<Row>;
  maybeSingle(): Promise<SupabaseCreditQueryResult<Row>>;
  insert(values: Record<string, unknown>): SupabaseCreditTableQuery<Row>;
  upsert(
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ): SupabaseCreditTableQuery<Row>;
  update(values: Record<string, unknown>): SupabaseCreditTableQuery<Row>;
  then<TResult1 = SupabaseCreditQueryResult<Row>, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseCreditQueryResult<Row>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
}

export interface SupabaseCreditRepositoryClient {
  from(
    table:
      | "credit_wallets"
      | "credit_ledger_entries"
      | "credit_reservations"
      | "usage_limits",
  ): SupabaseCreditTableQuery;
}

const notConfiguredMessage =
  "Platform credits are not configured yet; no live balance, reservation, purchase, or subscription is available.";

export const createNotConfiguredCreditWalletRepository =
  (): CreditWalletRepository => ({
    getReadiness: () => ({
      kind: "unavailable",
      status: "platform_credits_not_configured",
      message: notConfiguredMessage,
    }),
    getWalletStatus: async (workspaceId) => ({
      state: "platform_credits_not_configured",
      scope: "workspace",
      liveBalanceAvailable: false,
      message: notConfiguredMessage,
      activeWorkspaceId: workspaceId,
    }),
    createLedgerEntry: async () => ({
      kind: "unavailable",
      status: "platform_credits_not_configured",
      message: notConfiguredMessage,
    }),
    reserveCredits: async () => ({
      kind: "unavailable",
      status: "platform_credits_not_configured",
      message: notConfiguredMessage,
    }),
    settleReservation: async () => ({
      kind: "unavailable",
      status: "platform_credits_not_configured",
      message: notConfiguredMessage,
    }),
    getReservation: async () => undefined,
    getUsageLimit: async () => ({
      kind: "unavailable",
      status: "usage_limits_not_configured",
      message:
        "Usage limits are not configured yet; paid provider generation must remain blocked.",
    }),
  });

const toStableUuid = (value: string): string => {
  const bytes = Buffer.from(createHash("sha256").update(value).digest("hex"), "hex");

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex").slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

const toMutationFailed = (): CreditRepositoryMutationResult => ({
  kind: "unavailable",
  status: "credit_mutation_failed",
  message:
    "Credit mutation failed or credit tables are unavailable; no paid generation should proceed.",
});

const toIdempotentOrRecorded = (
  result: SupabaseCreditQueryResult,
): CreditRepositoryMutationResult =>
  result.error
    ? toMutationFailed()
    : {
        kind: "ok",
        status: "recorded",
      };

const normalizeLedgerKind = (kind: CreditLedgerEntryKind): string => kind;

export const createSupabaseCreditWalletRepository = (
  client: SupabaseCreditRepositoryClient,
): CreditWalletRepository => ({
  getReadiness: () => ({
    kind: "ready",
    status: "available",
  }),

  getWalletStatus: async (workspaceId) => {
    try {
      const result = await client
        .from("credit_wallets")
        .select("balance,status")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (result.error || !result.data || Array.isArray(result.data)) {
        return {
          state: "wallet_unavailable",
          scope: "workspace",
          liveBalanceAvailable: false,
          message:
            "A platform credit wallet was not found for this workspace. Paid generation remains unavailable.",
          activeWorkspaceId: workspaceId,
        };
      }

      const balance =
        typeof result.data.balance === "number" ? result.data.balance : undefined;

      return {
        state: typeof balance === "number" ? "available" : "wallet_unavailable",
        scope: "workspace",
        liveBalanceAvailable: typeof balance === "number",
        message:
          typeof balance === "number"
            ? "Platform credit wallet metadata is available."
            : "Platform credit wallet metadata is incomplete; paid generation remains unavailable.",
        activeWorkspaceId: workspaceId,
        ...(typeof balance === "number" ? { balance } : {}),
        currencyCode: "platform_credits",
      };
    } catch {
      return {
        state: "wallet_unavailable",
        scope: "workspace",
        liveBalanceAvailable: false,
        message:
          "Platform credit wallet lookup failed; paid generation remains unavailable.",
        activeWorkspaceId: workspaceId,
      };
    }
  },

  createLedgerEntry: async (input) => {
    try {
      const result = await client.from("credit_ledger_entries").upsert(
        {
          actor_source: input.actorSource,
          amount_delta: input.amountDelta,
          created_at: input.createdAt,
          idempotency_key: input.idempotencyKey,
          job_id: input.jobId,
          kind: normalizeLedgerKind(input.kind),
          ledger_entry_id: input.ledgerEntryId,
          reason_code: input.reasonCode,
          reservation_id: input.reservationId,
          user_id: input.userId,
          workspace_id: input.workspaceId,
        },
        { onConflict: "idempotency_key" },
      );

      return toIdempotentOrRecorded(result);
    } catch {
      return toMutationFailed();
    }
  },

  reserveCredits: async (input) => {
    if (input.requestedAmount <= 0) {
      return {
        kind: "unavailable",
        status: "credit_mutation_failed",
        message: "Credit reservation amount must be positive.",
      };
    }

    try {
      const result = await client.from("credit_reservations").upsert(
        {
          idempotency_key: input.idempotencyKey,
          job_id: input.jobId,
          requested_amount: input.requestedAmount,
          reservation_id: input.reservationId,
          state: "reserved",
          user_id: input.userId,
          workspace_id: input.workspaceId,
        },
        { onConflict: "idempotency_key" },
      );

      return toIdempotentOrRecorded(result);
    } catch {
      return toMutationFailed();
    }
  },

  settleReservation: async (input) => {
    try {
      const state =
        input.settlementKind === "settlement"
          ? "settled"
          : input.settlementKind === "refund"
            ? "refunded"
            : "released";
      const result = await client
        .from("credit_reservations")
        .update({
          state,
          settlement_reason_code: input.reasonCode,
          settlement_idempotency_key: input.idempotencyKey,
        })
        .eq("reservation_id", input.reservationId);

      return toIdempotentOrRecorded(result);
    } catch {
      return toMutationFailed();
    }
  },

  getReservation: async (reservationId) => {
    try {
      const result = await client
        .from("credit_reservations")
        .select("reservation_id,state,requested_amount,workspace_id,user_id,job_id,idempotency_key")
        .eq("reservation_id", reservationId)
        .maybeSingle();

      if (result.error || !result.data || Array.isArray(result.data)) {
        return undefined;
      }

      return {
        reservationId: String(result.data.reservation_id),
        state: result.data.state as CreditReservationState,
        requestedAmount: Number(result.data.requested_amount),
        workspaceId: String(result.data.workspace_id),
        userId:
          typeof result.data.user_id === "string" ? result.data.user_id : undefined,
        jobId: typeof result.data.job_id === "string" ? result.data.job_id : undefined,
        idempotencyKey: String(result.data.idempotency_key),
      };
    } catch {
      return undefined;
    }
  },

  getUsageLimit: async (workspaceId) => {
    try {
      const result = await client
        .from("usage_limits")
        .select("workspace_id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      return result.error || !result.data
        ? {
            kind: "unavailable",
            status: "usage_limits_not_configured",
            message:
              "Usage limits are not configured for this workspace; paid generation remains unavailable.",
          }
        : {
            kind: "available",
            status: "available",
            message: "Usage limit metadata is available.",
          };
    } catch {
      return {
        kind: "unavailable",
        status: "usage_limits_not_configured",
        message:
          "Usage limit lookup failed; paid generation remains unavailable.",
      };
    }
  },
});

export const createCreditWalletRepositoryFromClientFactory = (
  clientFactoryResult: SupabaseClientFactoryResult,
): CreditWalletRepository => {
  if (clientFactoryResult.kind !== "supabase_client_factory") {
    return createNotConfiguredCreditWalletRepository();
  }

  const adminHandle = clientFactoryResult.createAdminClientHandle();

  return createSupabaseCreditWalletRepository(
    adminHandle.client as unknown as SupabaseCreditRepositoryClient,
  );
};

export const createCreditLedgerEntryId = (input: {
  workspaceId: string;
  idempotencyKey: string;
  kind: CreditLedgerEntryKind;
}): string =>
  toStableUuid(
    `credit_ledger:${input.workspaceId}:${input.kind}:${input.idempotencyKey}`,
  );
