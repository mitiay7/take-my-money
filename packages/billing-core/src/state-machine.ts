import { BillingDomainError } from "./errors";

export type MigrationState =
  | "DRAFT"
  | "RECEIPT_EXTRACTED"
  | "SOURCE_VERIFIED"
  | "QUOTE_READY"
  | "CONFIRMATION_PENDING"
  | "CREDIT_RESERVED"
  | "TARGET_CREATION_PENDING"
  | "TARGET_CREATED"
  | "SOURCE_CONSUMED"
  | "CREDIT_COMMITTED"
  | "COMPLETED"
  | "INELIGIBLE"
  | "MANUAL_REVIEW_REQUIRED"
  | "QUOTE_EXPIRED"
  | "TARGET_CREATION_FAILED"
  | "PAYMENT_FAILED"
  | "RECONCILIATION_REQUIRED"
  | "CANCELED"
  | "FAILED";

export type StateTransition = {
  previousState: MigrationState;
  nextState: MigrationState;
  eventType: string;
  actorType: "USER" | "SYSTEM" | "RECONCILER";
  actorId: string;
  requestId: string;
  timestampUtc: string;
  previousVersion: number;
  nextVersion: number;
  metadata: Readonly<Record<string, unknown>>;
};

const allowedTransitions: Readonly<Record<MigrationState, readonly MigrationState[]>> = {
  DRAFT: ["RECEIPT_EXTRACTED", "SOURCE_VERIFIED", "CANCELED"],
  RECEIPT_EXTRACTED: ["SOURCE_VERIFIED", "CANCELED"],
  SOURCE_VERIFIED: ["QUOTE_READY", "INELIGIBLE", "MANUAL_REVIEW_REQUIRED", "CANCELED"],
  QUOTE_READY: ["CONFIRMATION_PENDING", "QUOTE_EXPIRED", "CANCELED"],
  CONFIRMATION_PENDING: ["CREDIT_RESERVED"],
  CREDIT_RESERVED: ["TARGET_CREATION_PENDING"],
  TARGET_CREATION_PENDING: ["TARGET_CREATED", "TARGET_CREATION_FAILED", "RECONCILIATION_REQUIRED"],
  TARGET_CREATED: ["SOURCE_CONSUMED"],
  SOURCE_CONSUMED: ["CREDIT_COMMITTED"],
  CREDIT_COMMITTED: ["COMPLETED"],
  TARGET_CREATION_FAILED: ["QUOTE_READY"],
  RECONCILIATION_REQUIRED: ["TARGET_CREATED", "TARGET_CREATION_FAILED"],
  COMPLETED: [],
  INELIGIBLE: [],
  MANUAL_REVIEW_REQUIRED: [],
  QUOTE_EXPIRED: [],
  PAYMENT_FAILED: [],
  CANCELED: [],
  FAILED: [],
};

export function canTransition(from: MigrationState, to: MigrationState): boolean {
  return allowedTransitions[from].includes(to);
}

export function transitionState(input: {
  from: MigrationState;
  to: MigrationState;
  eventType: string;
  actorType: StateTransition["actorType"];
  actorId: string;
  requestId: string;
  timestampUtc: string;
  currentVersion: number;
  metadata?: Readonly<Record<string, unknown>>;
}): StateTransition {
  if (!canTransition(input.from, input.to)) {
    throw new BillingDomainError(
      "INVALID_STATE_TRANSITION",
      `Invalid migration transition: ${input.from} -> ${input.to}`,
    );
  }

  return Object.freeze({
    previousState: input.from,
    nextState: input.to,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId,
    requestId: input.requestId,
    timestampUtc: input.timestampUtc,
    previousVersion: input.currentVersion,
    nextVersion: input.currentVersion + 1,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
  });
}

export function getAllowedTransitions(state: MigrationState): readonly MigrationState[] {
  return allowedTransitions[state];
}
