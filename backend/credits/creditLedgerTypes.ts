export type CreditLedgerEntryKind =
  | "grant"
  | "purchase"
  | "reservation"
  | "settlement"
  | "release"
  | "refund"
  | "adjustment"
  | "expiry";

export type CreditLedgerActorSource =
  | "system"
  | "user"
  | "admin"
  | "billing_webhook"
  | "generation_runtime"
  | "export_runtime";

export interface CreditLedgerEntry {
  ledgerEntryId: string;
  workspaceId: string;
  userId?: string;
  jobId?: string;
  reservationId?: string;
  kind: CreditLedgerEntryKind;
  amountDelta: number;
  reasonCode: string;
  idempotencyKey: string;
  actorSource: CreditLedgerActorSource;
  createdAt: string;
  providerTaskReference?: string;
  metadata?: Record<string, string | number | boolean | null>;
}
