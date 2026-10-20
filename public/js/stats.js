(async function () {
  const user = await requireUser();
  if (!user) return;
  document.getElementById("currentUser").textContent = user.username;

  const surveyId = new URLSearchParams(location.search).get("id");
  if (!surveyId) {
    location.href = "/dashboard.html";
    return;
  }

  let data;
  try {
    data = await api("/api/surveys/" + surveyId + "/stats");
  } catch (error) {
    document.getElementById("statsList").innerHTML =
      '<div class="card empty">' + escapeHtml(error.message) + "</div>";
    return;
  }

  const survey = data.survey;
  const questions = data.questions;
  const total = data.total_responses;
  document.title = survey.title + " - 统计";
  document.getElementById("statsTitle").textContent = survey.title;
  document.getElementById("statsSubtitle").textContent =
    "统计结果会根据已提交的答卷实时计算";
  document.getElementById("totalResponses").textContent = total;
  document.getElementById("questionTotal").textContent = questions.length;
  const totalAnswered = questions.reduce(
    (sum, question) => sum + question.answered_count,
    0
  );
  document.getElementById("averageAnswered").textContent = questions.length
    ? (Math.round((totalAnswered / questions.length) * 10) / 10).toFixed(1)
    : "0";

  const fillUrl = publicUrl(survey.public_id);
  document.getElementById("statsActions").innerHTML =
    '<a class="button" href="/builder.html?id=' +
    survey.id +
    '">查看问卷</a>' +
    '<a class="button" target="_blank" href="' +
    fillUrl +
    '">填写问卷</a>' +
    '<button type="button" id="copyStatsLink">复制链接</button>';
  document.getElementById("copyStatsLink").addEventListener("click", async () => {
    const ok = await copyText(fillUrl);
    document.getElementById("copyStatsLink").textContent = ok
      ? "已复制"
      : "复制失败";
  });

  function questionHead(question) {
    return (
      '<div class="question-block-head">' +
      "<div>" +
      '<div class="question-no">第 ' +
      question.order +
      " 题　" +
      typeName(question.type) +
      "</div>" +
      '<h3 class="question-title">' +
      escapeHtml(question.title) +
      "</h3>" +
      "</div>" +
      '<div class="hint">回答人数：' +
      question.answered_count +
      "</div>" +
      "</div>"
    );
  }

  function bars(question) {
    return (
      '<div style="margin-top:14px;">' +
      question.options
        .map((option) => {
          const width = Math.max(0, Math.min(100, option.percent));
          return (
            '<div class="bar-row">' +
            '<div title="' +
            escapeHtml(option.text) +
            '">' +
            option.key +
            ". " +
            escapeHtml(option.text) +
            "</div>" +
            '<div class="bar-track"><div class="bar-fill" style="width:' +
            width +
            '%"></div></div>' +
            '<div class="bar-count">' +
            option.count +
            " 人（" +
            option.percent +
            "%）</div>" +
            "</div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderQuestion(question) {
    let body = "";
    if (question.type === "single" || question.type === "multiple") {
      body =
        bars(question) +
        '<div class="hint">' +
        (question.type === "multiple"
          ? "百分比为选择该选项的人数占回答本题人数的比例，多选相加可能超过 100%。"
          : "百分比按回答本题的人数计算。") +
        "</div>";
    }
    if (question.type === "number") {
      body =
        '<div class="stat-grid" style="margin-top:16px;margin-bottom:0;">' +
        '<div class="stat-small"><div class="num">' +
        (question.average ?? "-") +
        '</div><div class="label">平均值</div></div>' +
        '<div class="stat-small"><div class="num">' +
        (question.min ?? "-") +
        '</div><div class="label">最小值</div></div>' +
        '<div class="stat-small"><div class="num">' +
        (question.max ?? "-") +
        '</div><div class="label">最大值</div></div>' +
        "</div>";
    }
    if (question.type === "text") {
      body = question.values.length
        ? '<div class="text-answers">' +
          question.values
            .map(
              (item) =>
                '<div class="text-answer">' +
                escapeHtml(item.value) +
                '<div class="hint">' +
                formatDate(item.submitted_at) +
                "</div></div>"
            )
            .join("") +
          "</div>"
        : '<p class="hint">暂无填写内容。</p>';
    }

    return (
      '<article class="question-block">' + questionHead(question) + body + "</article>"
    );
  }

  if (!questions.length) {
    document.getElementById("statsList").innerHTML =
      '<div class="card empty">这份问卷还没有题目。</div>';
    return;
  }

  document.getElementById("statsList").innerHTML =
    (total === 0
      ? '<div class="inline-note">还没有收到答卷，下面显示的是各题的统计框架。</div>'
      : "") + questions.map(renderQuestion).join("");
})();
