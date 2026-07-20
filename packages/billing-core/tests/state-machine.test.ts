// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BillingDomainError,
  canTransition,
  getAllowedTransitions,
  transitionState,
  type MigrationState,
} from "../src";

const allStates: MigrationState[] = [
  "DRAFT",
  "RECEIPT_EXTRACTED",
  "SOURCE_VERIFIED",
  "QUOTE_READY",
  "CONFIRMATION_PENDING",
  "CREDIT_RESERVED",
  "TARGET_CREATION_PENDING",
  "TARGET_CREATED",
  "SOURCE_CONSUMED",
  "CREDIT_COMMITTED",
  "COMPLETED",
  "INELIGIBLE",
  "MANUAL_REVIEW_REQUIRED",
  "QUOTE_EXPIRED",
  "TARGET_CREATION_FAILED",
  "PAYMENT_FAILED",
  "RECONCILIATION_REQUIRED",
  "CANCELED",
  "FAILED",
];

describe("migration state machine", () => {
  it("accepts every declared transition", () => {
    for (const from of allStates) {
      for (const to of getAllowedTransitions(from)) {
        expect(canTransition(from, to)).toBe(true);
        expect(
          transitionState({
            from,
            to,
            eventType: "TEST_TRANSITION",
            actorType: "SYSTEM",
            actorId: "system",
            requestId: "req_test",
            timestampUtc: "2026-07-19T00:00:00.000Z",
            currentVersion: 4,
          }),
        ).toMatchObject({ previousState: from, nextState: to, nextVersion: 5 });
      }
    }
  });

  it("rejects every undeclared transition", () => {
    for (const from of allStates) {
      for (const to of allStates) {
        if (getAllowedTransitions(from).includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it("throws a typed error without returning a mutation", () => {
    expect(() =>
      transitionState({
        from: "DRAFT",
        to: "COMPLETED",
        eventType: "INVALID",
        actorType: "SYSTEM",
        actorId: "system",
        requestId: "req_invalid",
        timestampUtc: "2026-07-19T00:00:00.000Z",
        currentVersion: 0,
      }),
    ).toThrowError(BillingDomainError);
  });

  it.each(["COMPLETED", "INELIGIBLE", "MANUAL_REVIEW_REQUIRED", "CANCELED", "FAILED"])(
    "keeps terminal state %s immutable",
    (state) => {
      expect(getAllowedTransitions(state as MigrationState)).toHaveLength(0);
    },
  );
});
