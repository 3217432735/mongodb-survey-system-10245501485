(async function () {
  const user = await requireUser();
  if (!user) return;
  document.getElementById("currentUser").textContent = user.username;
  document.getElementById("logoutButton").addEventListener("click", logout);

  const surveyId = new URLSearchParams(location.search).get("id");
  if (!surveyId) {
    location.href = "/dashboard.html";
    return;
  }

  let survey = null;
  let questions = [];
  let editingId = null;

  const $ = (id) => document.getElementById(id);
  const listBox = $("questionList");
  const form = $("questionForm");
  const errorBox = $("questionError");

  function typeFields() {
    const type = $("questionType").value;
    $("choiceFields").classList.toggle("hidden", type !== "single" && type !== "multiple");
    $("multipleFields").classList.toggle("hidden", type !== "multiple");
    $("textFields").classList.toggle("hidden", type !== "text");
    $("numberFields").classList.toggle("hidden", type !== "number");
    $("jumpFields").classList.toggle("hidden", type === "text" || !editingId);
    if (type === "text") $("ruleList").innerHTML = "";
  }

  function optionsFromTextarea() {
    return $("questionOptions")
      .value.split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function laterQuestions() {
    if (!editingId) return [];
    const current = questions.find((item) => item.id === editingId);
    if (!current) return [];
    return questions.filter((item) => item.order > current.order);
  }

  function addRuleRow(rule) {
    const type = $("questionType").value;
    const later = laterQuestions();
    if (!later.length) {
      alert("后面还没有可以跳转的题目，请先添加题目。");
      return;
    }

    const row = document.createElement("div");
    row.className = "rule-row";
    row.dataset.rule = "1";
    let conditionHtml = "";

    if (type === "single" || type === "multiple") {
      const options = optionsFromTextarea();
      if (options.length < 2) {
        alert("请先填写选项。");
        return;
      }
      conditionHtml =
        '<span>当选择</span><select class="condition-option">' +
        options
          .map(
            (option, index) =>
              '<option value="' +
              String.fromCharCode(65 + index) +
              '">' +
              escapeHtml(String.fromCharCode(65 + index) + " " + option) +
              "</option>"
          )
          .join("") +
        "</select>";
    } else {
      conditionHtml =
        '<span>当数值</span><select class="condition-op">' +
        '<option value="eq">等于</option>' +
        '<option value="ne">不等于</option>' +
        '<option value="gt">大于</option>' +
        '<option value="gte">大于等于</option>' +
        '<option value="lt">小于</option>' +
        '<option value="lte">小于等于</option>' +
        '<option value="between">介于</option>' +
        "</select>" +
        '<input type="number" class="condition-value" step="any" placeholder="数值">' +
        '<input type="number" class="condition-value2 hidden" step="any" placeholder="上限">';
    }

    conditionHtml +=
      '<span>时，跳到</span><select class="rule-target">' +
      later
        .map(
          (item) =>
            '<option value="' +
            item.order +
            '">第' +
            item.order +
            "题：" +
            escapeHtml(item.title.slice(0, 18)) +
            "</option>"
        )
        .join("") +
      "</select>" +
      '<button type="button" class="btn-small btn-danger remove-rule">删除</button>';
    row.innerHTML = conditionHtml;

    if (rule) {
      if (type === "single" || type === "multiple") {
        row.querySelector(".condition-option").value = rule.condition.option;
      } else {
        row.querySelector(".condition-op").value = rule.condition.op;
        row.querySelector(".condition-value").value = rule.condition.value;
        if (rule.condition.op === "between") {
          const value2 = row.querySelector(".condition-value2");
          value2.classList.remove("hidden");
          value2.value = rule.condition.value2;
        }
      }
      row.querySelector(".rule-target").value = String(rule.target_order);
    }

    const opSelect = row.querySelector(".condition-op");
    if (opSelect) {
      opSelect.addEventListener("change", () => {
        row
          .querySelector(".condition-value2")
          .classList.toggle("hidden", opSelect.value !== "between");
      });
    }
    row.querySelector(".remove-rule").addEventListener("click", () => row.remove());
    $("ruleList").appendChild(row);
  }

  function collectRules() {
    const rows = [...$("ruleList").querySelectorAll(".rule-row")];
    const type = $("questionType").value;
    return rows.map((row) => {
      let condition;
      if (type === "single" || type === "multiple") {
        condition = { option: row.querySelector(".condition-option").value };
      } else {
        condition = {
          op: row.querySelector(".condition-op").value,
          value: Number(row.querySelector(".condition-value").value)
        };
        if (condition.op === "between") {
          condition.value2 = Number(
            row.querySelector(".condition-value2").value
          );
        }
      }
      return {
        condition,
        target_order: Number(row.querySelector(".rule-target").value)
      };
    });
  }

  function renderHead() {
    const status = statusInfo(survey);
    $("surveyTitle").textContent = survey.title;
    $("surveySubtitle").innerHTML =
      '状态：<span class="status ' +
      status.className +
      '">' +
      status.text +
      "</span>　题目 " +
      survey.question_count +
      " 道　已回收 " +
      survey.response_count +
      " 份";

    const actions = [];
    if (survey.status === "draft") {
      actions.push(
        '<button class="btn-primary" id="publishButton" type="button">发布问卷</button>'
      );
    } else {
      const url = publicUrl(survey.public_id);
      actions.push(
        '<a class="button" target="_blank" href="' +
          url +
          '">填写</a>' +
          '<a class="button" href="/stats.html?id=' +
          survey.id +
          '">查看统计</a>' +
          '<button type="button" id="copyLinkButton">复制链接</button>'
      );
    }
    $("headActions").innerHTML = actions.join("");

    if ($("publishButton")) {
      $("publishButton").addEventListener("click", publishSurvey);
    }
    if ($("copyLinkButton")) {
      $("copyLinkButton").addEventListener("click", async () => {
        const ok = await copyText(publicUrl(survey.public_id));
        $("copyLinkButton").textContent = ok ? "已复制" : "复制失败";
      });
    }
  }

  function renderSettings() {
    const isDraft = survey.status === "draft";
    $("settingsForm").classList.toggle("hidden", !isDraft);
    $("lockedNote").classList.toggle("hidden", isDraft);
    $("settingTitle").value = survey.title;
    $("settingDescription").value = survey.description || "";
    $("settingDeadline").value = toDatetimeLocal(survey.deadline);
    $("settingAnonymous").checked = survey.allow_anonymous;
    $("settingMultiple").checked = survey.allow_multiple;
    $("editorArea").classList.toggle("hidden", !isDraft);
  }

  function ruleSummary(question) {
    if (!question.jump_rules || !question.jump_rules.length) return "";
    return question.jump_rules
      .map((rule) => {
        if (question.type === "single") {
          return "选 " + rule.condition.option + " → 第" + rule.target_order + "题";
        }
        if (question.type === "multiple") {
          return "选中 " + rule.condition.option + " → 第" + rule.target_order + "题";
        }
        const names = {
          eq: "=",
          ne: "≠",
          gt: ">",
          gte: "≥",
          lt: "<",
          lte: "≤"
        };
        if (rule.condition.op === "between") {
          return (
            rule.condition.value +
            " ~ " +
            rule.condition.value2 +
            " → 第" +
            rule.target_order +
            "题"
          );
        }
        return (
          names[rule.condition.op] +
          " " +
          rule.condition.value +
          " → 第" +
          rule.target_order +
          "题"
        );
      })
      .join("；");
  }

  function constraintSummary(question) {
    const parts = [];
    if (question.type === "multiple") {
      if (question.exact_choices !== null) {
        parts.push("必须选 " + question.exact_choices + " 项");
      } else {
        if (question.min_choices !== null) parts.push("至少 " + question.min_choices + " 项");
        if (question.max_choices !== null) parts.push("最多 " + question.max_choices + " 项");
      }
    }
    if (question.type === "text") {
      parts.push(question.min_length + "~" + question.max_length + " 字");
    }
    if (question.type === "number") {
      if (question.min_value !== null || question.max_value !== null) {
        parts.push(
          (question.min_value ?? "不限") +
            " ~ " +
            (question.max_value ?? "不限")
        );
      }
      if (question.integer_only) parts.push("只能为整数");
    }
    return parts.join("，");
  }

  function renderQuestions() {
    $("questionCountText").textContent = "共 " + questions.length + " 题";
    if (!questions.length) {
      listBox.innerHTML = '<div class="empty">还没有题目，先在左边添加。</div>';
      return;
    }
    listBox.innerHTML = questions
      .map((question) => {
        const options =
          question.type === "single" || question.type === "multiple"
            ? '<div class="option-list">' +
              question.options
                .map(
                  (option) =>
                    '<div class="option-line">' +
                    option.key +
                    ". " +
                    escapeHtml(option.text) +
                    "</div>"
                )
                .join("") +
              "</div>"
            : "";
        const constraints = constraintSummary(question);
        const rules = ruleSummary(question);
        return (
          '<div class="question-block">' +
          '<div class="question-block-head">' +
          "<div>" +
          '<div class="question-no">第 ' +
          question.order +
          " 题　" +
          typeName(question.type) +
          (question.required ? "　<span style=\"color:#b4473d\">必答</span>" : "　选答") +
          "</div>" +
          '<h3 class="question-title">' +
          escapeHtml(question.title) +
          "</h3>" +
          (constraints ? '<div class="hint">' + escapeHtml(constraints) + "</div>" : "") +
          "</div>" +
          '<div class="actions">' +
          '<button class="btn-small" data-edit="' +
          question.id +
          '" type="button">编辑</button>' +
          (question.order === questions.length
            ? '<button class="btn-small btn-danger" data-delete="' +
              question.id +
              '" type="button">删除</button>'
            : "") +
          "</div>" +
          "</div>" +
          options +
          (rules
            ? '<div class="hint" style="margin-top:10px;">跳转：' +
              escapeHtml(rules) +
              "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");
  }

  function resetForm() {
    editingId = null;
    form.reset();
    $("questionType").value = "single";
    $("questionRequired").checked = false;
    $("questionOptions").value = "";
    $("minChoices").value = "";
    $("maxChoices").value = "";
    $("exactChoices").value = "";
    $("minLength").value = "0";
    $("maxLength").value = "500";
    $("minValue").value = "";
    $("maxValue").value = "";
    $("integerOnly").checked = false;
    $("ruleList").innerHTML = "";
    $("questionFormTitle").textContent = "添加题目";
    $("saveQuestionButton").textContent = "保存题目";
    $("cancelEditButton").classList.add("hidden");
    $("newQuestionNote").classList.remove("hidden");
    typeFields();
  }

  function editQuestion(id) {
    const question = questions.find((item) => item.id === id);
    if (!question) return;
    editingId = id;
    $("questionTitle").value = question.title;
    $("questionType").value = question.type;
    $("questionRequired").checked = question.required;
    $("questionOptions").value =
      question.options && question.options.length
        ? question.options.map((item) => item.text).join("\n")
        : "";
    $("minChoices").value = question.min_choices ?? "";
    $("maxChoices").value = question.max_choices ?? "";
    $("exactChoices").value = question.exact_choices ?? "";
    $("minLength").value = question.min_length ?? 0;
    $("maxLength").value = question.max_length ?? 500;
    $("minValue").value = question.min_value ?? "";
    $("maxValue").value = question.max_value ?? "";
    $("integerOnly").checked = Boolean(question.integer_only);
    $("ruleList").innerHTML = "";
    $("questionFormTitle").textContent = "编辑第 " + question.order + " 题";
    $("saveQuestionButton").textContent = "保存修改";
    $("cancelEditButton").classList.remove("hidden");
    $("newQuestionNote").classList.add("hidden");
    typeFields();
    for (const rule of question.jump_rules || []) addRuleRow(rule);
    window.scrollTo({ top: $("settingsCard").offsetHeight + 60, behavior: "smooth" });
  }

  function questionBody() {
    const type = $("questionType").value;
    const body = {
      title: $("questionTitle").value,
      type,
      required: $("questionRequired").checked,
      options: [],
      jump_rules: editingId ? collectRules() : []
    };
    if (type === "single" || type === "multiple") {
      body.options = optionsFromTextarea();
    }
    if (type === "multiple") {
      body.min_choices = $("minChoices").value || null;
      body.max_choices = $("maxChoices").value || null;
      body.exact_choices = $("exactChoices").value || null;
    }
    if (type === "text") {
      body.min_length = $("minLength").value || 0;
      body.max_length = $("maxLength").value || 500;
    }
    if (type === "number") {
      body.min_value = $("minValue").value || null;
      body.max_value = $("maxValue").value || null;
      body.integer_only = $("integerOnly").checked;
    }
    return body;
  }

  async function loadSurvey() {
    const data = await api("/api/surveys/" + surveyId);
    survey = data.survey;
    questions = data.questions;
    document.title = survey.title + " - 问卷小站";
    renderHead();
    renderSettings();
    renderQuestions();
    if (survey.status !== "draft") {
      $("editorArea").classList.add("hidden");
    }
  }

  async function publishSurvey() {
    if (!confirm("发布之后不能再修改题目，确定发布吗？")) return;
    try {
      await api("/api/surveys/" + surveyId + "/publish", { method: "POST" });
      alert("发布成功，链接已经可以发给别人了。");
      await loadSurvey();
    } catch (error) {
      alert(error.message);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(errorBox, "");
    const button = $("saveQuestionButton");
    button.disabled = true;
    try {
      if (editingId) {
        await api(
          "/api/surveys/" + surveyId + "/questions/" + editingId,
          { method: "PATCH", body: JSON.stringify(questionBody()) }
        );
      } else {
        await api("/api/surveys/" + surveyId + "/questions", {
          method: "POST",
          body: JSON.stringify(questionBody())
        });
      }
      await loadSurvey();
      resetForm();
    } catch (error) {
      setMessage(errorBox, error.message);
      button.disabled = false;
    }
  });

  $("questionType").addEventListener("change", () => {
    $("ruleList").innerHTML = "";
    typeFields();
  });
  $("addRuleButton").addEventListener("click", () => addRuleRow(null));
  $("cancelEditButton").addEventListener("click", resetForm);

  listBox.addEventListener("click", async (event) => {
    const editButton = event.target.closest("button[data-edit]");
    if (editButton) {
      editQuestion(editButton.dataset.edit);
      return;
    }
    const deleteButton = event.target.closest("button[data-delete]");
    if (deleteButton) {
      if (!confirm("确定删除最后一题吗？")) return;
      try {
        await api(
          "/api/surveys/" +
            surveyId +
            "/questions/" +
            deleteButton.dataset.delete,
          { method: "DELETE" }
        );
        await loadSurvey();
        resetForm();
      } catch (error) {
        alert(error.message);
      }
    }
  });

  $("settingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = $("settingsMessage");
    setMessage(message, "");
    try {
      const deadlineValue = $("settingDeadline").value;
      await api("/api/surveys/" + surveyId, {
        method: "PATCH",
        body: JSON.stringify({
          title: $("settingTitle").value,
          description: $("settingDescription").value,
          deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
          allow_anonymous: $("settingAnonymous").checked,
          allow_multiple: $("settingMultiple").checked
        })
      });
      setMessage(message, "已保存", true);
      await loadSurvey();
      setTimeout(() => setMessage(message, "已保存", true), 10);
    } catch (error) {
      setMessage(message, error.message);
    }
  });

  await loadSurvey();
  resetForm();
})();
