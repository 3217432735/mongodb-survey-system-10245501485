(async function () {
  const user = await requireUser();
  if (!user) return;

  const $ = (id) => document.getElementById(id);
  $("currentUser").textContent = user.username;
  $("logoutButton").addEventListener("click", logout);

  let roots = [];
  let editingRootId = null;

  function currentType() {
    return $("libraryType").value;
  }

  function updateTypeFields() {
    const type = currentType();
    $("libraryChoiceFields").classList.toggle(
      "hidden",
      type !== "single" && type !== "multiple"
    );
    $("libraryMultipleFields").classList.toggle(
      "hidden",
      type !== "multiple"
    );
    $("libraryTextFields").classList.toggle(
      "hidden",
      type !== "text"
    );
    $("libraryNumberFields").classList.toggle(
      "hidden",
      type !== "number"
    );
  }

  function optionsFromTextarea() {
    return $("libraryOptions")
      .value.split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function questionBody() {
    const type = currentType();
    const body = {
      title: $("libraryTitle").value,
      type,
      required: $("libraryRequired").checked,
      options: [],
      jump_rules: []
    };
    if (type === "single" || type === "multiple") {
      body.options = optionsFromTextarea();
    }
    if (type === "multiple") {
      body.min_choices = $("libraryMinChoices").value || null;
      body.max_choices = $("libraryMaxChoices").value || null;
      body.exact_choices = $("libraryExactChoices").value || null;
    }
    if (type === "text") {
      body.min_length = $("libraryMinLength").value || 0;
      body.max_length = $("libraryMaxLength").value || 500;
    }
    if (type === "number") {
      body.min_value = $("libraryMinValue").value || null;
      body.max_value = $("libraryMaxValue").value || null;
      body.integer_only = $("libraryIntegerOnly").checked;
    }
    return body;
  }

  function resetForm() {
    editingRootId = null;
    $("libraryForm").reset();
    $("libraryType").value = "single";
    $("libraryRequired").checked = false;
    $("libraryMinLength").value = "0";
    $("libraryMaxLength").value = "500";
    $("libraryFormTitle").textContent = "新建题库题目";
    $("librarySaveButton").textContent = "保存到题库";
    $("libraryCancelButton").classList.add("hidden");
    setMessage($("libraryError"), "");
    updateTypeFields();
  }

  function editVersion(root) {
    if (!root.current_version) return;
    const version = root.current_version;
    editingRootId = root.id;
    $("libraryTitle").value = version.title;
    $("libraryType").value = version.type;
    $("libraryRequired").checked = version.required;
    $("libraryOptions").value =
      version.options && version.options.length
        ? version.options.map((item) => item.text).join("\n")
        : "";
    $("libraryMinChoices").value = version.min_choices ?? "";
    $("libraryMaxChoices").value = version.max_choices ?? "";
    $("libraryExactChoices").value = version.exact_choices ?? "";
    $("libraryMinLength").value = version.min_length ?? 0;
    $("libraryMaxLength").value = version.max_length ?? 500;
    $("libraryMinValue").value = version.min_value ?? "";
    $("libraryMaxValue").value = version.max_value ?? "";
    $("libraryIntegerOnly").checked = Boolean(version.integer_only);
    $("libraryFormTitle").textContent =
      "为“" + version.title + "”创建新版本";
    $("librarySaveButton").textContent = "创建新版本";
    $("libraryCancelButton").classList.remove("hidden");
    updateTypeFields();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderRoots() {
    if (!roots.length) {
      $("libraryList").innerHTML =
        '<div class="empty">还没有题目，先创建一道题。</div>';
      return;
    }

    $("libraryList").innerHTML = roots
      .map((root) => {
        const version = root.current_version;
        if (!version) return "";
        const ownerLabel = root.can_edit ? "我创建的" : "共享给我";
        const libraryLabel = root.in_library ? "已在题库" : "未加入题库";
        const actions = [];
        if (root.can_edit) {
          actions.push(
            '<button class="btn-small" data-action="edit" data-id="' +
              root.id +
              '" type="button">新建版本</button>'
          );
          actions.push(
            '<button class="btn-small" data-action="share" data-id="' +
              root.id +
              '" type="button">共享</button>'
          );
          if (!root.in_library) {
            actions.push(
              '<button class="btn-small" data-action="add-library" data-id="' +
                root.id +
                '" type="button">加入题库</button>'
            );
          }
        }
        actions.push(
          '<button class="btn-small" data-action="history" data-id="' +
            root.id +
            '" type="button">历史版本</button>'
        );
        actions.push(
          '<button class="btn-small" data-action="usage" data-id="' +
            root.id +
            '" type="button">使用问卷</button>'
        );
        actions.push(
          '<button class="btn-small" data-action="stats" data-id="' +
            root.id +
            '" type="button">跨问卷统计</button>'
        );

        return (
          '<article class="survey-item">' +
          '<div class="survey-item-head">' +
          "<div>" +
          "<h3>" +
          escapeHtml(version.title) +
          "</h3>" +
          '<div class="survey-meta">' +
          "<span>" +
          ownerLabel +
          "</span><span>" +
          typeName(version.type) +
          "</span><span>v" +
          version.version_no +
          "</span><span>" +
          libraryLabel +
          "</span><span>共享 " +
          root.shared_user_count +
          " 人</span>" +
          "</div></div>" +
          '<div class="actions">' +
          actions.join("") +
          "</div></div></article>"
        );
      })
      .join("");
  }

  async function loadRoots() {
    const data = await api("/api/library/questions");
    roots = data.questions;
    renderRoots();
  }

  function openDetail(title) {
    $("detailPanel").classList.remove("hidden");
    $("detailTitle").textContent = title;
    $("detailContent").innerHTML = "";
    $("detailPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderHistory(root) {
    openDetail("历史版本");
    const rows = root.versions
      .map((version) => {
        const previous = version.previous_version_id
          ? "上一版：" + version.previous_version_id
          : "初始版本";
        const derived = version.derived_from_version_id
          ? "，基于版本：" + version.derived_from_version_id
          : "";
        const restore =
          root.can_edit && version.id !== root.current_version.id
            ? '<button class="btn-small" data-action="restore" data-root="' +
              root.id +
              '" data-version="' +
              version.id +
              '" type="button">恢复此版本</button>'
            : "";
        return (
          '<div class="question-block">' +
          '<div class="question-block-head"><div>' +
          "<strong>v" +
          version.version_no +
          "　" +
          escapeHtml(version.title) +
          "</strong>" +
          '<div class="hint">' +
          formatDate(version.created_at) +
          "　" +
          previous +
          derived +
          "</div></div>" +
          '<div class="actions">' +
          restore +
          "</div></div></div>"
        );
      })
      .join("");
    $("detailContent").innerHTML = rows;
  }

  async function loadHistory(rootId) {
    const data = await api("/api/library/questions/" + rootId);
    renderHistory(data.question);
  }

  async function showUsage(rootId) {
    const data = await api("/api/library/questions/" + rootId + "/usage");
    openDetail("使用这些题目的问卷");
    if (!data.usages.length) {
      $("detailContent").innerHTML =
        '<div class="empty">还没有问卷使用这个题目。</div>';
      return;
    }
    $("detailContent").innerHTML = data.usages
      .map(
        (item) =>
          '<div class="question-block">' +
          '<div class="question-block-head"><div>' +
          "<strong>" +
          escapeHtml(item.survey_title) +
          "</strong>" +
          '<div class="hint">第 ' +
          item.question_order +
          " 题　v" +
          (item.version_no ?? "-") +
          "　问卷状态：" +
          item.survey_status +
          "</div></div>" +
          '<a class="button btn-small" href="/stats.html?id=' +
          item.survey_id +
          '">问卷统计</a>' +
          "</div></div>"
      )
      .join("");
  }

  function renderStats(data) {
    openDetail("跨问卷统计：" + data.title);
    const summary =
      '<div class="stat-grid">' +
      '<div class="stat-small"><div class="num">' +
      data.survey_count +
      '</div><div class="label">使用问卷</div></div>' +
      '<div class="stat-small"><div class="num">' +
      data.total_responses +
      '</div><div class="label">答卷总数</div></div>' +
      '<div class="stat-small"><div class="num">' +
      data.answered_count +
      '</div><div class="label">回答本题人数</div></div>' +
      "</div>";

    let details = "";
    if (data.type === "single" || data.type === "multiple") {
      details =
        '<div class="option-list">' +
        data.options
          .map(
            (item) =>
              '<div class="bar-row"><span>' +
              escapeHtml(item.text) +
              '</span><div class="bar-track"><div class="bar-fill" style="width:' +
              Math.min(100, item.percent) +
              '%"></div></div><span class="bar-count">' +
              item.count +
              "（" +
              item.percent +
              "%）</span></div>"
          )
          .join("") +
        "</div>";
    } else if (data.type === "number") {
      details =
        '<div class="stat-grid">' +
        '<div class="stat-small"><div class="num">' +
        (data.average ?? "-") +
        '</div><div class="label">平均值</div></div>' +
        '<div class="stat-small"><div class="num">' +
        (data.min ?? "-") +
        '</div><div class="label">最小值</div></div>' +
        '<div class="stat-small"><div class="num">' +
        (data.max ?? "-") +
        '</div><div class="label">最大值</div></div>' +
        "</div>";
    } else if (data.type === "text") {
      details =
        '<div class="text-answers">' +
        data.values
          .map(
            (item) =>
              '<div class="text-answer">' +
              escapeHtml(item.value) +
              '<div class="hint">' +
              escapeHtml(item.survey_title) +
              "　" +
              formatDate(item.submitted_at) +
              "</div></div>"
          )
          .join("") +
        "</div>";
    }
    $("detailContent").innerHTML =
      summary + details + '<p class="hint">只统计当前账号自己创建问卷中的答卷。</p>';
  }

  async function showStats(rootId) {
    const data = await api("/api/library/questions/" + rootId + "/stats");
    renderStats(data);
  }

  async function shareRoot(rootId) {
    const username = prompt("输入要共享给的用户名：");
    if (!username) return;
    const result = await api(
      "/api/library/questions/" + rootId + "/share",
      {
        method: "POST",
        body: JSON.stringify({ username: username.trim() })
      }
    );
    alert("已共享给 " + result.username);
    await loadRoots();
  }

  async function addToLibrary(rootId) {
    await api("/api/library/questions/" + rootId, {
      method: "PATCH",
      body: JSON.stringify({ in_library: true })
    });
    await loadRoots();
  }

  async function restoreVersion(rootId, versionId) {
    if (!confirm("恢复旧版本会生成一个新的当前版本，历史记录不会删除。继续吗？")) {
      return;
    }
    await api(
      "/api/library/questions/" +
        rootId +
        "/versions/" +
        versionId +
        "/restore",
      { method: "POST" }
    );
    await loadRoots();
    await loadHistory(rootId);
  }

  $("libraryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = $("librarySaveButton");
    button.disabled = true;
    setMessage($("libraryError"), "");
    try {
      if (editingRootId) {
        await api(
          "/api/library/questions/" + editingRootId + "/versions",
          {
            method: "POST",
            body: JSON.stringify(questionBody())
          }
        );
      } else {
        await api("/api/library/questions", {
          method: "POST",
          body: JSON.stringify(questionBody())
        });
      }
      resetForm();
      await loadRoots();
    } catch (error) {
      setMessage($("libraryError"), error.message);
    } finally {
      button.disabled = false;
    }
  });

  $("libraryType").addEventListener("change", updateTypeFields);
  $("libraryCancelButton").addEventListener("click", resetForm);
  $("detailCloseButton").addEventListener("click", () => {
    $("detailPanel").classList.add("hidden");
  });

  $("libraryList").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    try {
      const root = roots.find((item) => item.id === button.dataset.id);
      if (button.dataset.action === "edit" && root) editVersion(root);
      if (button.dataset.action === "share") {
        await shareRoot(button.dataset.id);
      }
      if (button.dataset.action === "add-library") {
        await addToLibrary(button.dataset.id);
      }
      if (button.dataset.action === "history") {
        await loadHistory(button.dataset.id);
      }
      if (button.dataset.action === "usage") {
        await showUsage(button.dataset.id);
      }
      if (button.dataset.action === "stats") {
        await showStats(button.dataset.id);
      }
    } catch (error) {
      alert(error.message);
    }
  });

  $("detailContent").addEventListener("click", async (event) => {
    const button = event.target.closest('button[data-action="restore"]');
    if (!button) return;
    try {
      await restoreVersion(button.dataset.root, button.dataset.version);
    } catch (error) {
      alert(error.message);
    }
  });

  updateTypeFields();
  await loadRoots();
})();
