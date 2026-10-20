(async function () {
  const user = await requireUser();
  if (!user) return;
  document.getElementById("currentUser").textContent = user.username;

  const publicId = new URLSearchParams(location.search).get("id");
  const loading = document.getElementById("loading");
  const accessMessage = document.getElementById("accessMessage");
  const intro = document.getElementById("intro");
  const fillArea = document.getElementById("fillArea");
  const doneBox = document.getElementById("doneBox");
  const fillError = document.getElementById("fillError");

  if (!publicId) {
    loading.classList.add("hidden");
    accessMessage.classList.remove("hidden");
    document.getElementById("accessText").textContent = "链接里缺少问卷编号。";
    return;
  }

  let data;
  try {
    data = await api("/api/fill/" + encodeURIComponent(publicId));
  } catch (error) {
    loading.classList.add("hidden");
    accessMessage.classList.remove("hidden");
    document.getElementById("accessTitle").textContent = "无法填写";
    document.getElementById("accessText").textContent = error.message;
    return;
  }

  const survey = data.survey;
  const questions = data.questions;
  const byOrder = new Map(questions.map((item) => [item.order, item]));
  const answers = {};
  let path = [];
  let position = 0;
  let submitted = false;

  document.title = survey.title + " - 填写问卷";
  document.getElementById("fillTitle").textContent = survey.title;
  document.getElementById("fillDescription").textContent = survey.description || "";
  document.getElementById("fillDescription").classList.toggle(
    "hidden",
    !survey.description
  );
  document.getElementById("fillMeta").innerHTML =
    "<span>共 " +
    questions.length +
    " 道题</span><span>截止时间：" +
    formatDate(survey.deadline) +
    "</span><span>" +
    (survey.allow_multiple ? "可以重复填写" : "每人只能填写一次") +
    "</span>";
  document
    .getElementById("anonymousLine")
    .classList.toggle("hidden", !survey.allow_anonymous);
  document.getElementById("againButton").classList.toggle(
    "hidden",
    !survey.allow_multiple
  );
  loading.classList.add("hidden");

  if (data.already_submitted) {
    doneBox.classList.remove("hidden");
    document.getElementById("doneTitle").textContent = "已经填写过了";
    document.getElementById("doneText").textContent =
      "这份问卷设置了每人只能填写一次。";
    return;
  }
  intro.classList.remove("hidden");

  document.getElementById("startButton").addEventListener("click", start);
  document.getElementById("backButton").addEventListener("click", goBack);
  document.getElementById("nextButton").addEventListener("click", goNext);
  document.getElementById("againButton").addEventListener("click", () => {
    resetAll();
    start();
  });

  function start() {
    intro.classList.add("hidden");
    fillArea.classList.remove("hidden");
    submitted = false;
    patchReset();
    path = [1];
    position = 0;
    renderQuestion();
  }

  function resetAll() {
    for (const key of Object.keys(answers)) delete answers[key];
    path = [];
    position = 0;
  }

  function renderQuestion() {
    const question = byOrder.get(path[position]);
    if (!question) return;
    fillError.textContent = "";
    const progress = Math.round((question.order / questions.length) * 100);
    document.getElementById("progressBar").style.width = progress + "%";
    document.getElementById("progressText").textContent =
      "第 " + question.order + " 题，共 " + questions.length + " 题";
    document.getElementById("backButton").disabled = position === 0;
    document.getElementById("nextButton").textContent =
      question.order === questions.length ? "提交问卷" : "下一题";

    const required = question.required
      ? '<span class="required">*</span>'
      : "";
    let inputHtml = "";
    const oldValue = answers[String(question.order)];

    if (question.type === "single") {
      inputHtml =
        '<div class="option-list">' +
        question.options
          .map(
            (option) =>
              '<label class="option-line"><input type="radio" name="answer" value="' +
              option.key +
              '"' +
              (oldValue === option.key ? " checked" : "") +
              "><span>" +
              option.key +
              ". " +
              escapeHtml(option.text) +
              "</span></label>"
          )
          .join("") +
        "</div>";
    }

    if (question.type === "multiple") {
      const values = Array.isArray(oldValue) ? oldValue : [];
      let countHint = "";
      if (question.exact_choices !== null) {
        countHint = "请选择 " + question.exact_choices + " 项";
      } else if (question.min_choices !== null && question.max_choices !== null) {
        countHint =
          "请选择 " + question.min_choices + " 至 " + question.max_choices + " 项";
      } else if (question.min_choices !== null) {
        countHint = "至少选择 " + question.min_choices + " 项";
      } else if (question.max_choices !== null) {
        countHint = "最多选择 " + question.max_choices + " 项";
      }
      inputHtml =
        '<div class="hint">' +
        countHint +
        "</div>" +
        '<div class="option-list">' +
        question.options
          .map(
            (option) =>
              '<label class="option-line"><input type="checkbox" name="answer" value="' +
              option.key +
              '"' +
              (values.includes(option.key) ? " checked" : "") +
              "><span>" +
              option.key +
              ". " +
              escapeHtml(option.text) +
              "</span></label>"
          )
          .join("") +
        "</div>";
    }

    if (question.type === "text") {
      inputHtml =
        '<textarea id="textAnswer" maxlength="' +
        question.max_length +
        '" placeholder="请输入">' +
        escapeHtml(oldValue || "") +
        "</textarea>" +
        '<div class="hint">' +
        question.min_length +
        " 至 " +
        question.max_length +
        " 字</div>";
    }

    if (question.type === "number") {
      const range = [];
      if (question.min_value !== null) range.push("最小 " + question.min_value);
      if (question.max_value !== null) range.push("最大 " + question.max_value);
      inputHtml =
        '<input type="number" id="numberAnswer" step="' +
        (question.integer_only ? "1" : "any") +
        '" value="' +
        (oldValue ?? "") +
        '">' +
        '<div class="hint">' +
        range.join("，") +
        (question.integer_only ? "，只能填写整数" : "") +
        "</div>";
    }

    document.getElementById("questionCard").innerHTML =
      '<div class="question-no">第 ' +
      question.order +
      " 题　" +
      typeName(question.type) +
      "</div>" +
      "<h2>" +
      escapeHtml(question.title) +
      required +
      "</h2>" +
      inputHtml;
  }

  function readAnswer(question) {
    if (question.type === "text") {
      return document.getElementById("textAnswer").value.trim();
    }
    if (question.type === "number") {
      const raw = document.getElementById("numberAnswer").value.trim();
      return raw === "" ? null : Number(raw);
    }
    if (question.type === "multiple") {
      return [...document.querySelectorAll('input[name="answer"]:checked')].map(
        (item) => item.value
      );
    }
    const checked = document.querySelector('input[name="answer"]:checked');
    return checked ? checked.value : null;
  }

  function isBlank(question, value) {
    if (value === null || value === undefined) return true;
    if (question.type === "text") return String(value).trim() === "";
    if (question.type === "multiple") return !Array.isArray(value) || !value.length;
    return false;
  }

  function validateAnswer(question, value) {
    if (isBlank(question, value)) {
      return question.required ? "本题为必答题，请填写后再继续" : "";
    }
    if (question.type === "multiple") {
      if (question.exact_choices !== null && value.length !== question.exact_choices) {
        return "本题必须选择 " + question.exact_choices + " 项";
      }
      if (question.min_choices !== null && value.length < question.min_choices) {
        return "本题至少选择 " + question.min_choices + " 项";
      }
      if (question.max_choices !== null && value.length > question.max_choices) {
        return "本题最多选择 " + question.max_choices + " 项";
      }
    }
    if (question.type === "text") {
      if (value.length < question.min_length) {
        return "至少需要填写 " + question.min_length + " 个字";
      }
      if (value.length > question.max_length) {
        return "最多只能填写 " + question.max_length + " 个字";
      }
    }
    if (question.type === "number") {
      if (!Number.isFinite(value)) return "请填写有效的数字";
      if (question.integer_only && !Number.isInteger(value)) {
        return "本题只能填写整数";
      }
      if (question.min_value !== null && value < question.min_value) {
        return "不能小于 " + question.min_value;
      }
      if (question.max_value !== null && value > question.max_value) {
        return "不能大于 " + question.max_value;
      }
    }
    return "";
  }

  function matchRule(question, rule, answer) {
    if (answer === null || answer === undefined) return false;
    if (question.type === "single") return answer === rule.condition.option;
    if (question.type === "multiple") {
      return (
        Array.isArray(answer) && answer.includes(rule.condition.option)
      );
    }
    if (question.type === "number") {
      const condition = rule.condition;
      const value = Number(answer);
      if (!Number.isFinite(value)) return false;
      if (condition.op === "eq") return value === condition.value;
      if (condition.op === "ne") return value !== condition.value;
      if (condition.op === "gt") return value > condition.value;
      if (condition.op === "gte") return value >= condition.value;
      if (condition.op === "lt") return value < condition.value;
      if (condition.op === "lte") return value <= condition.value;
      if (condition.op === "between") {
        return value >= condition.value && value <= condition.value2;
      }
    }
    return false;
  }

  function nextOrder(question, answer) {
    for (const rule of question.jump_rules || []) {
      if (matchRule(question, rule, answer)) return rule.target_order;
    }
    return question.order < questions.length ? question.order + 1 : null;
  }

  function patchReset() {
    fillError.textContent = "";
  }

  async function goNext() {
    const question = byOrder.get(path[position]);
    const value = readAnswer(question);
    const error = validateAnswer(question, value);
    if (error) {
      fillError.textContent = error;
      return;
    }

    if (isBlank(question, value)) delete answers[String(question.order)];
    else answers[String(question.order)] = value;

    for (const oldOrder of path.slice(position + 1)) {
      delete answers[String(oldOrder)];
    }
    path = path.slice(0, position + 1);

    const target = nextOrder(question, value);
    if (!target || target > questions.length) {
      await submit();
      return;
    }
    path.push(target);
    position += 1;
    renderQuestion();
  }

  function goBack() {
    if (position === 0) return;
    position -= 1;
    renderQuestion();
  }

  async function submit() {
    const button = document.getElementById("nextButton");
    button.disabled = true;
    fillError.textContent = "";
    const payload = {
      anonymous:
        survey.allow_anonymous &&
        document.getElementById("anonymousCheck").checked,
      answers: path
        .filter((order) => answers[String(order)] !== undefined)
        .map((order) => ({
          question_order: order,
          value: answers[String(order)]
        }))
    };

    try {
      const result = await api("/api/fill/" + encodeURIComponent(publicId), {
        method: "POST",
        body: JSON.stringify(payload)
      });
      submitted = true;
      fillArea.classList.add("hidden");
      doneBox.classList.remove("hidden");
      document.getElementById("doneTitle").textContent = "提交成功";
      document.getElementById("doneText").textContent = result.message || "感谢填写。";
    } catch (error) {
      fillError.textContent = error.message;
      button.disabled = false;
    }
  }
})();
