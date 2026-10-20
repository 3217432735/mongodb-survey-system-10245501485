class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function text(value, maxLength, label) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new InputError(label + "不能为空");
  if (result.length > maxLength) {
    throw new InputError(label + "不能超过" + maxLength + "个字符");
  }
  return result;
}

function optionalInt(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isInteger(number)) throw new InputError(label + "必须是整数");
  return number;
}

function optionalNumber(value, label) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new InputError(label + "必须是数字");
  return number;
}

function optionKey(index) {
  return String.fromCharCode(65 + index);
}

function normalizeJumpRules(rules, type, optionKeys, order, questionCount) {
  if (type === "text") return [];
  if (rules === undefined || rules === null) return [];
  if (!Array.isArray(rules)) throw new InputError("跳转规则格式不正确");

  return rules.map((rule, index) => {
    const target = Number(rule.target_order);
    if (!Number.isInteger(target) || target <= order || target > questionCount) {
      throw new InputError("第" + (index + 1) + "条跳转规则的目标题号不正确");
    }

    const condition = rule.condition || {};
    if (type === "single" || type === "multiple") {
      if (!optionKeys.includes(condition.option)) {
        throw new InputError("第" + (index + 1) + "条跳转规则选中的选项不存在");
      }
      const match = condition.match === "all" ? "all" : "any";
      return {
        condition: { option: condition.option, match },
        target_order: target
      };
    }

    const ops = ["eq", "ne", "gt", "gte", "lt", "lte", "between"];
    if (!ops.includes(condition.op)) {
      throw new InputError("第" + (index + 1) + "条跳转规则的条件不正确");
    }
    const value = Number(condition.value);
    if (!Number.isFinite(value)) {
      throw new InputError("第" + (index + 1) + "条跳转规则缺少比较值");
    }
    const normalized = { op: condition.op, value };
    if (condition.op === "between") {
      const value2 = Number(condition.value2);
      if (!Number.isFinite(value2) || value2 < value) {
        throw new InputError("第" + (index + 1) + "条跳转规则的区间不正确");
      }
      normalized.value2 = value2;
    }
    return { condition: normalized, target_order: target };
  });
}

function normalizeQuestion(body, order, questionCount) {
  const typeList = ["single", "multiple", "text", "number"];
  if (!typeList.includes(body.type)) throw new InputError("题目类型不正确");

  const result = {
    order,
    type: body.type,
    title: text(body.title, 200, "题目标题"),
    required: body.required === true,
    options: [],
    min_choices: null,
    max_choices: null,
    exact_choices: null,
    min_length: null,
    max_length: null,
    min_value: null,
    max_value: null,
    integer_only: false,
    jump_rules: []
  };

  let keys = [];
  if (body.type === "single" || body.type === "multiple") {
    if (!Array.isArray(body.options)) throw new InputError("选项格式不正确");
    const options = body.options
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (options.length < 2) throw new InputError("选择题至少需要两个选项");
    if (options.length > 12) throw new InputError("选择题最多支持十二个选项");
    if (new Set(options).size !== options.length) {
      throw new InputError("选项内容不能重复");
    }
    result.options = options.map((item, index) => ({
      key: optionKey(index),
      text: item.slice(0, 200)
    }));
    keys = result.options.map((item) => item.key);
  }

  if (body.type === "multiple") {
    let min = optionalInt(body.min_choices, "最少选择数量");
    let max = optionalInt(body.max_choices, "最多选择数量");
    const exact = optionalInt(body.exact_choices, "必须选择数量");
    if (min !== null && min < 0) throw new InputError("最少选择数量不能小于0");
    if (max !== null && max < 1) throw new InputError("最多选择数量不能小于1");
    if (min !== null && max !== null && min > max) {
      throw new InputError("最少选择数量不能大于最多选择数量");
    }
    if (max !== null && max > keys.length) {
      throw new InputError("最多选择数量不能超过选项个数");
    }
    if (exact !== null) {
      if (exact < 1 || exact > keys.length) {
        throw new InputError("必须选择数量不能超过选项个数");
      }
      min = exact;
      max = exact;
    }
    result.min_choices = min;
    result.max_choices = max;
    result.exact_choices = exact;
  }

  if (body.type === "text") {
    const min = optionalInt(body.min_length, "最少字数") ?? 0;
    const max = optionalInt(body.max_length, "最多字数") ?? 500;
    if (min < 0 || max < 1) throw new InputError("文本长度限制不正确");
    if (min > max) throw new InputError("最少字数不能大于最多字数");
    if (max > 2000) throw new InputError("最多字数不能超过2000");
    result.min_length = min;
    result.max_length = max;
  }

  if (body.type === "number") {
    const min = optionalNumber(body.min_value, "最小值");
    const max = optionalNumber(body.max_value, "最大值");
    if (min !== null && max !== null && min > max) {
      throw new InputError("最小值不能大于最大值");
    }
    result.min_value = min;
    result.max_value = max;
    result.integer_only = body.integer_only === true;
  }

  result.jump_rules = normalizeJumpRules(
    body.jump_rules,
    body.type,
    keys,
    order,
    questionCount
  );
  return result;
}

function answerError(question, rawValue) {
  if (question.type === "single") {
    if (!rawValue) return "请选择一个选项";
    if (!question.options.some((item) => item.key === rawValue)) {
      return "选项不存在";
    }
    return null;
  }

  if (question.type === "multiple") {
    if (!Array.isArray(rawValue)) return "多选题答案格式不正确";
    const values = [...new Set(rawValue)];
    const validKeys = question.options.map((item) => item.key);
    if (values.some((value) => !validKeys.includes(value))) {
      return "选项中包含无效内容";
    }
    if (question.exact_choices !== null && values.length !== question.exact_choices) {
      return "本题必须选择" + question.exact_choices + "项";
    }
    if (question.min_choices !== null && values.length < question.min_choices) {
      return "本题至少选择" + question.min_choices + "项";
    }
    if (question.max_choices !== null && values.length > question.max_choices) {
      return "本题最多选择" + question.max_choices + "项";
    }
    return null;
  }

  if (question.type === "text") {
    if (typeof rawValue !== "string") return "答案格式不正确";
    const value = rawValue.trim();
    if (value.length < question.min_length) {
      return "至少需要填写" + question.min_length + "个字";
    }
    if (value.length > question.max_length) {
      return "最多只能填写" + question.max_length + "个字";
    }
    return null;
  }

  if (question.type === "number") {
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      return "请填写数字";
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return "请填写有效的数字";
    if (question.integer_only && !Number.isInteger(value)) {
      return "本题只能填写整数";
    }
    if (question.min_value !== null && value < question.min_value) {
      return "不能小于" + question.min_value;
    }
    if (question.max_value !== null && value > question.max_value) {
      return "不能大于" + question.max_value;
    }
    return null;
  }

  return "题目类型不正确";
}

function normalizeAnswer(question, rawValue) {
  if (question.type === "multiple") return [...new Set(rawValue)];
  if (question.type === "text") return rawValue.trim();
  if (question.type === "number") return Number(rawValue);
  return rawValue;
}

function isBlank(question, value) {
  if (value === undefined || value === null) return true;
  if (question.type === "text") return String(value).trim() === "";
  if (question.type === "multiple") return !Array.isArray(value) || value.length === 0;
  return value === "";
}

module.exports = {
  InputError,
  text,
  normalizeQuestion,
  answerError,
  normalizeAnswer,
  isBlank
};
