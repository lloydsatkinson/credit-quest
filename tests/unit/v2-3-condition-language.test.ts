import { describe, expect, it } from "vitest";
import {
  evaluateCondition,
  validateConditionExpression,
  type ConditionExpr,
} from "@/lib/recovery/condition-language";

describe("V2.3 controlled recovery condition language", () => {
  it("evaluates allowlisted comparisons against facts and policy parameters", () => {
    expect(evaluateCondition(
      { op: "gte", fact: "monthsSinceDecline", parameter: "cooldownMonths" },
      { monthsSinceDecline: 6 },
      { cooldownMonths: 6 },
    )).toBe(true);
    expect(evaluateCondition(
      { op: "eq", fact: "evidenceVerified", value: true },
      { evidenceVerified: true },
      {},
    )).toBe(true);
  });

  it("uses three-valued logic instead of inventing truth from missing facts", () => {
    expect(evaluateCondition(
      { op: "gt", fact: "disposableIncome", value: 0 },
      { disposableIncome: null },
      {},
    )).toBe("unknown");

    const unknownComparison: ConditionExpr = { op: "eq", fact: "bureauFixed", value: true };
    expect(evaluateCondition(
      { op: "and", all: [unknownComparison, { op: "eq", fact: "safe", value: false }] },
      { safe: false },
      {},
    )).toBe(false);
    expect(evaluateCondition(
      { op: "or", any: [unknownComparison, { op: "eq", fact: "safe", value: true }] },
      { safe: true },
      {},
    )).toBe(true);
  });

  it("rejects comparisons with both or neither a literal and parameter target", () => {
    expect(() => validateConditionExpression({
      op: "eq", fact: "x", value: 1, parameter: "threshold",
    } as unknown as ConditionExpr)).toThrow(/invalid_condition/i);
    expect(() => validateConditionExpression({
      op: "eq", fact: "x",
    } as unknown as ConditionExpr)).toThrow(/invalid_condition/i);
  });

  it("rejects unknown operations and expressions deeper than eight levels", () => {
    expect(() => validateConditionExpression({ op: "execute", fact: "x", value: 1 } as unknown as ConditionExpr)).toThrow(/invalid_condition/i);

    let expression: ConditionExpr = { op: "eq", fact: "x", value: 1 };
    for (let index = 0; index < 9; index += 1) expression = { op: "and", all: [expression] };
    expect(() => validateConditionExpression(expression)).toThrow(/invalid_condition/i);
  });
});
