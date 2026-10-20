function matchRule(question, rule, answer) {
  if (answer === undefined || answer === null) return false;
  const condition = rule.condition || {};

  if (question.type === "single") {
    return answer === condition.option;
  }

  if (question.type === "multiple") {
    if (!Array.isArray(answer)) return false;
    if (condition.match === "all") {
      const needAll = [condition.option];
      return needAll.every((key) => answer.includes(key));
    }
    return answer.includes(condition.option);
  }

  if (question.type === "number") {
    const value = Number(answer);
    if (!Number.isFinite(value)) return false;
    switch (condition.op) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "gt":
        return value > condition.value;
      case "gte":
        return value >= condition.value;
      case "lt":
        return value < condition.value;
      case "lte":
        return value <= condition.value;
      case "between":
        return value >= condition.value && value <= condition.value2;
      default:
        return false;
    }
  }

  return false;
}

function findNextOrder(question, answer, questionCount) {
  for (const rule of question.jump_rules || []) {
    if (matchRule(question, rule, answer)) return rule.target_order;
  }
  if (question.order < questionCount) return question.order + 1;
  return null;
}

function buildPath(questions, answersByOrder) {
  const byOrder = new Map(questions.map((item) => [item.order, item]));
  const path = [];
  const visited = new Set();
  let order = 1;

  while (order && byOrder.has(order) && !visited.has(order)) {
    const question = byOrder.get(order);
    visited.add(order);
    path.push(question);
    const answer = answersByOrder.get(String(order));
    order = findNextOrder(question, answer, questions.length);
  }
  return path;
}

module.exports = { matchRule, findNextOrder, buildPath };
