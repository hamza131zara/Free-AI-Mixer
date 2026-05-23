export type CreditReservationState =
  | "planned"
  | "reserved"
  | "settled"
  | "released"
  | "refunded"
  | "expired";

export interface CreditReservationRequest {
  reservationId: string;
  workspaceId: string;
  userId?: string;
  jobId?: string;
  requestedAmount: number;
  idempotencyKey: string;
  reasonCode: string;
}

export interface CreditSettlementRequest {
  reservationId: string;
  workspaceId: string;
  settlementKind: "settlement" | "release" | "refund";
  amountDelta: number;
  idempotencyKey: string;
  reasonCode: string;
  jobId?: string;
}
