import type {
  CreditReservationRequest,
  CreditSettlementRequest,
} from "./creditReservationTypes";
import type {
  CreditRepositoryMutationResult,
  CreditWalletRepository,
} from "./creditWalletRepository";

export interface CreditReservationService {
  reserve(input: CreditReservationRequest): Promise<CreditRepositoryMutationResult>;
  settle(input: CreditSettlementRequest): Promise<CreditRepositoryMutationResult>;
  release(input: CreditSettlementRequest): Promise<CreditRepositoryMutationResult>;
  refund(input: CreditSettlementRequest): Promise<CreditRepositoryMutationResult>;
}

export const createCreditReservationService = (
  repository: CreditWalletRepository,
): CreditReservationService => ({
  reserve: (input) => repository.reserveCredits(input),
  settle: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "settlement",
    }),
  release: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "release",
    }),
  refund: (input) =>
    repository.settleReservation({
      ...input,
      settlementKind: "refund",
    }),
});
