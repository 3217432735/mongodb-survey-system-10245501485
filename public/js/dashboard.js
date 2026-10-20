(async function () {
  const user = await requireUser();
  if (!user) return;
  document.getElementById("currentUser").textContent = user.username;
  document.getElementById("logoutButton").addEventListener("click", logout);

  const listBox = document.getElementById("surveyList");
  const createPanel = document.getElementById("createPanel");
  const showCreateButton = document.getElementById("showCreateButton");

  showCreateButton.addEventListener("click", () => {
    createPanel.classList.toggle("hidden");
    if (!createPanel.classList.contains("hidden")) {
      document.getElementById("newTitle").focus();
    }
  });
  document.getElementById("cancelCreateButton").addEventListener("click", () => {
    createPanel.classList.add("hidden");
  });

  async function loadSurveys() {
    const data = await api("/api/surveys");
    if (!data.surveys.length) {
      listBox.innerHTML =
        '<div class="card empty">还没有问卷，点击右上角“新建问卷”开始。</div>';
      return;
    }
    listBox.innerHTML = data.surveys.map(renderSurvey).join("");
  }

  function renderSurvey(survey) {
    const status = statusInfo(survey);
    const expired =
      survey.status === "published" &&
      survey.deadline &&
      new Date(survey.deadline).getTime() <= Date.now();
    const publicAddress = publicUrl(survey.public_id);
    const isDraft = survey.status === "draft";
    const isPublished = survey.status === "published";

    const editButton = isDraft
      ? '<a class="button btn-small" href="/builder.html?id=' + survey.id + '">继续编辑</a>'
      : '<a class="button btn-small" href="/builder.html?id=' + survey.id + '">查看问卷</a>';
    const publishButton = isDraft
      ? '<button class="btn-primary btn-small" data-action="publish" data-id="' +
        survey.id +
        '" type="button">发布</button>'
      : "";
    const fillButton = !isDraft
      ? '<a class="button btn-small" target="_blank" href="' +
        publicAddress +
        '">填写</a>'
      : "";
    const closeButton = isPublished && !expired
      ? '<button class="btn-small" data-action="close" data-id="' +
        survey.id +
        '" type="button">关闭</button>'
      : "";
    const deleteButton = isDraft
      ? '<button class="btn-small btn-danger" data-action="delete" data-id="' +
        survey.id +
        '" type="button">删除</button>'
      : "";
    const linkLine = !isDraft
      ? '<div class="public-link">填写链接：' +
        escapeHtml(publicAddress) +
        ' <button class="btn-small" data-action="copy" data-url="' +
        escapeHtml(publicAddress) +
        '" type="button">复制</button>' +
        '<div class="hint">填写链接使用公网地址，其他网络可直接打开。</div></div>'
      : "";

    const settings = [];
    settings.push(survey.allow_anonymous ? "允许匿名" : "需登录且记录用户名");
    settings.push(survey.allow_multiple ? "可重复填写" : "每人限填一次");

    return (
      '<article class="survey-item">' +
      '<div class="survey-item-head">' +
      "<div>" +
      '<h3><a href="/builder.html?id=' +
      survey.id +
      '">' +
      escapeHtml(survey.title) +
      "</a></h3>" +
      '<div class="survey-meta">' +
      "<span>状态：" +
      '<span class="status ' +
      status.className +
      '">' +
      status.text +
      "</span></span>" +
      "<span>题目：" +
      survey.question_count +
      " 道</span>" +
      "<span>回收：" +
      survey.response_count +
      " 份</span>" +
      "<span>截止：" +
      formatDate(survey.deadline) +
      "</span>" +
      "</div>" +
      '<div class="survey-meta"><span>' +
      settings.join("</span><span>") +
      "</span></div>" +
      "</div>" +
      '<div class="actions">' +
      editButton +
      publishButton +
      fillButton +
      '<a class="button btn-small" href="/stats.html?id=' +
      survey.id +
      '">统计</a>' +
      closeButton +
      deleteButton +
      "</div>" +
      "</div>" +
      linkLine +
      "</article>"
    );
  }

  listBox.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    try {
      if (action === "copy") {
        const ok = await copyText(button.dataset.url);
        button.textContent = ok ? "已复制" : "复制失败";
        setTimeout(() => (button.textContent = "复制"), 1200);
        return;
      }
      if (action === "publish") {
        if (!confirm("发布之后题目不能再修改，确定发布吗？")) return;
        await api("/api/surveys/" + button.dataset.id + "/publish", {
          method: "POST"
        });
        alert("发布成功，现在可以把链接发给别人了。");
        await loadSurveys();
      }
      if (action === "close") {
        if (!confirm("关闭后别人将不能继续填写，确定关闭吗？")) return;
        await api("/api/surveys/" + button.dataset.id + "/close", {
          method: "POST"
        });
        await loadSurveys();
      }
      if (action === "delete") {
        if (!confirm("删除后不能恢复，确定删除这份草稿吗？")) return;
        await api("/api/surveys/" + button.dataset.id, { method: "DELETE" });
        await loadSurveys();
      }
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById("createForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById("createError");
    setMessage(errorBox, "");
    const deadlineValue = document.getElementById("newDeadline").value;
    const button = event.target.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const result = await api("/api/surveys", {
        method: "POST",
        body: JSON.stringify({
          title: document.getElementById("newTitle").value,
          description: document.getElementById("newDescription").value,
          deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
          allow_anonymous: document.getElementById("newAnonymous").checked,
          allow_multiple: document.getElementById("newMultiple").checked
        })
      });
      location.href = "/builder.html?id=" + result.survey.id;
    } catch (error) {
      setMessage(errorBox, error.message);
      button.disabled = false;
    }
  });

  await loadSurveys();
})();
