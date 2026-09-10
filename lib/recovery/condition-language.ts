export type RecoveryFactValue = string | number | boolean | null;
export type ConditionResult = true | false | "unknown";

export type ConditionExpr =
  | { op: "and"; all: ConditionExpr[] }
  | { op: "or"; any: ConditionExpr[] }
  | {
      op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
      fact: string;
      value?: RecoveryFactValue;
      parameter?: string;
    };

const MAX_CONDITION_DEPTH = 8;
const COMPARISON_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte"]);

function invalidCondition(): never {
  throw new Error("invalid_condition");
}

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function validateNode(expression: unknown, depth: number): asserts expression is ConditionExpr {
  if (depth > MAX_CONDITION_DEPTH || !expression || typeof expression !== "object") invalidCondition();

  const node = expression as Record<string, unknown>;
  if (node.op === "and") {
    if (!Array.isArray(node.all) || node.all.length === 0) invalidCondition();
    for (const child of node.all) validateNode(child, depth + 1);
    return;
  }
  if (node.op === "or") {
    if (!Array.isArray(node.any) || node.any.length === 0) invalidCondition();
    for (const child of node.any) validateNode(child, depth + 1);
    return;
  }

  if (typeof node.op !== "string" || !COMPARISON_OPS.has(node.op)) invalidCondition();
  if (typeof node.fact !== "string" || !node.fact.trim()) invalidCondition();

  const hasValue = hasOwn(node, "value");
  const hasParameter = hasOwn(node, "parameter");
  if (hasValue === hasParameter) invalidCondition();

  if (hasValue) {
    const value = node.value;
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) invalidCondition();
  }
  if (hasParameter && (typeof node.parameter !== "string" || !node.parameter.trim())) invalidCondition();
}

export function validateConditionExpression(expression: ConditionExpr): ConditionExpr {
  validateNode(expression, 1);
  return expression;
}

function comparisonTarget(
  expression: Extract<ConditionExpr, { fact: string }>,
  parameters: Record<string, RecoveryFactValue>,
): RecoveryFactValue | undefined {
  if (hasOwn(expression, "parameter")) {
    const key = expression.parameter as string;
    return hasOwn(parameters, key) ? parameters[key] : undefined;
  }
  return expression.value;
}

function compare(
  op: Extract<ConditionExpr, { fact: string }>["op"],
  left: RecoveryFactValue,
  right: RecoveryFactValue,
): ConditionResult {
  if (left === null || right === null) return "unknown";

  if (op === "eq") return Object.is(left, right);
  if (op === "neq") return !Object.is(left, right);
  if (typeof left !== typeof right || (typeof left !== "number" && typeof left !== "string")) return "unknown";

  if (typeof left === "number" && typeof right === "number") {
    if (op === "gt") return left > right;
    if (op === "gte") return left >= right;
    if (op === "lt") return left < right;
    return left <= right;
  }

  const leftString = left as string;
  const rightString = right as string;
  if (op === "gt") return leftString > rightString;
  if (op === "gte") return leftString >= rightString;
  if (op === "lt") return leftString < rightString;
  return leftString <= rightString;
}

function evaluateValidated(
  expression: ConditionExpr,
  facts: Record<string, RecoveryFactValue>,
  parameters: Record<string, RecoveryFactValue>,
): ConditionResult {
  if (expression.op === "and") {
    let sawUnknown = false;
    for (const child of expression.all) {
      const result = evaluateValidated(child, facts, parameters);
      if (result === false) return false;
      if (result === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : true;
  }

  if (expression.op === "or") {
    let sawUnknown = false;
    for (const child of expression.any) {
      const result = evaluateValidated(child, facts, parameters);
      if (result === true) return true;
      if (result === "unknown") sawUnknown = true;
    }
    return sawUnknown ? "unknown" : false;
  }

  if (!hasOwn(facts, expression.fact)) return "unknown";
  const left = facts[expression.fact];
  const right = comparisonTarget(expression, parameters);
  if (right === undefined) return "unknown";
  return compare(expression.op, left, right);
}

export function evaluateCondition(
  expression: ConditionExpr,
  facts: Record<string, RecoveryFactValue>,
  parameters: Record<string, RecoveryFactValue>,
): ConditionResult {
  validateConditionExpression(expression);
  return evaluateValidated(expression, facts, parameters);
}
