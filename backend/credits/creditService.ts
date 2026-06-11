import type { CreditLedgerEntry } from "./creditLedgerTypes";
import type {
  CreditReservationRequest,
  CreditSettlementRequest,
} from "./creditReservationTypes";
import {
  createCreditLedgerEntryId,
  createNotConfiguredCreditWalletRepository,
  type CreditRepositoryMutationResult,
  type CreditWalletRepository,
  type CreditWalletRepositoryReadiness,
  type CreditWalletStatus,
  type UsageLimitLookupResult,
} from "./creditWalletRepository";

export interface PlatformPaidGenerationReadinessRequest {
  workspaceId: string;
  userId?: string;
  jobId: string;
  reservationId: string;
  requestedAmount: number;
  idempotencyKey: string;
  reasonCode: string;
}

export type PlatformPaidGenerationReadinessResult =
  | {
      kind: "ready";
      status: "credits_reserved";
    }
  | {
      kind: "blocked";
      status:
        | "platform_credits_not_configured"
        | "wallet_unavailable"
        | "usage_limits_not_configured"
        | "insufficient_credits"
        | "credit_mutation_failed";
      message: string;
    };

export interface CreditService {
  getReadiness(): CreditWalletRepositoryReadiness;
  getWalletStatus(workspaceId: string): Promise<CreditWalletStatus>;
  reserveCredits(
    input: CreditReservationRequest,
  ): Promise<CreditRepositoryMutationResult>;
  settleReservation(
    input: CreditSettlementRequest,
  ): Promise<CreditRepositoryMutationResult>;
  releaseReservation(
    input: CreditSettlementRequest,
  ): Promise<CreditRepositoryMutationResult>;
  refundReservation(
    input: CreditSettlementRequest,
  ): Promise<CreditRepositoryMutationResult>;
  getUsageLimit(workspaceId: string): Promise<UsageLimitLookupResult>;
  checkPlatformPaidGenerationReadiness(
    input: PlatformPaidGenerationReadinessRequest,
  ): Promise<PlatformPaidGenerationReadinessResult>;
}

type PlatformPaidGenerationBlockedStatus = Extract<
  PlatformPaidGenerationReadinessResult,
  { kind: "blocked" }
>["status"];

const toBlocked = (
  status: PlatformPaidGenerationBlockedStatus,
  message: string,
): PlatformPaidGenerationReadinessResult => ({
  kind: "blocked",
  status,
  message,
});

const ledgerEntryForReservation = (
  input: CreditReservationRequest,
): CreditLedgerEntry => ({
  actorSource: "generation_runtime",
  amountDelta: -input.requestedAmount,
  createdAt: new Date().toISOString(),
  idempotencyKey: input.idempotencyKey,
  jobId: input.jobId,
  kind: "reservation",
  ledgerEntryId: createCreditLedgerEntryId({
    workspaceId: input.workspaceId,
    idempotencyKey: input.idempotencyKey,
    kind: "reservation",
  }),
  reasonCode: input.reasonCode,
  reservationId: input.reservationId,
  userId: input.userId,
  workspaceId: input.workspaceId,
});

export const createCreditService = (
  repository: CreditWalletRepository = createNotConfiguredCreditWalletRepository(),
): CreditService => ({
  getReadiness: () => repository.getReadiness(),

  getWalletStatus: (workspaceId) => repository.getWalletStatus(workspaceId),

  reserveCredits: async (input) => {
    const readiness = repository.getReadiness();

    if (readiness.kind !== "ready") {
      return {
        kind: "unavailable",
        status: readiness.status,
        message: readiness.message,
      };
    }

    const wallet = await repository.getWalletStatus(input.workspaceId);

    if (!wallet.liveBalanceAvailable || typeof wallet.balance !== "number") {
      return {
        kind: "unavailable",
        status: "credit_mutation_failed",
        message:
          "A live platform credit wallet is required before credits can be reserved.",
      };
    }

    if (wallet.balance - input.requestedAmount < 0) {
      return {
        kind: "unavailable",
        status: "insufficient_credits",
        message: "Insufficient platform credits for this reservation.",
      };
    }

    const reservation = await repository.reserveCredits(input);

    if (reservation.kind !== "ok") {
      return reservation;
    }

    return repository.createLedgerEntry(ledgerEntryForReservation(input));
  },

  settleReservation: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "settlement",
    }),

  releaseReservation: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "release",
    }),

  refundReservation: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "refund",
    }),

  getUsageLimit: (workspaceId) => repository.getUsageLimit(workspaceId),

  checkPlatformPaidGenerationReadiness: async (input) => {
    const readiness = repository.getReadiness();

    if (readiness.kind !== "ready") {
      return toBlocked("platform_credits_not_configured", readiness.message);
    }

    const usageLimit = await repository.getUsageLimit(input.workspaceId);

    if (usageLimit.kind !== "available") {
      return toBlocked("usage_limits_not_configured", usageLimit.message);
    }

    const reserveResult = await repository.reserveCredits({
      idempotencyKey: input.idempotencyKey,
      jobId: input.jobId,
      reasonCode: input.reasonCode,
      requestedAmount: input.requestedAmount,
      reservationId: input.reservationId,
      userId: input.userId,
      workspaceId: input.workspaceId,
    });

    if (reserveResult.kind !== "ok") {
      return toBlocked(
        reserveResult.status === "insufficient_credits"
          ? "insufficient_credits"
          : reserveResult.status === "credit_mutation_failed"
            ? "credit_mutation_failed"
            : "platform_credits_not_configured",
        reserveResult.message,
      );
    }

    return {
      kind: "ready",
      status: "credits_reserved",
    };
  },
});
