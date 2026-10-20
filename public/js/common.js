async function api(url, options = {}) {
  const config = {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  };
  const response = await fetch(url, config);
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = { error: "服务器返回的内容无法解析" };
  }
  if (response.status === 401 && !location.pathname.endsWith("login.html")) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/login.html?next=" + next;
    throw new Error("请先登录");
  }
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function getCurrentUser() {
  const result = await api("/api/auth/me");
  return result.user;
}

let appShareOrigin = "";
let appInfoPromise = null;

async function loadAppInfo() {
  if (!appInfoPromise) {
    appInfoPromise = fetch("/api/app-info", {
      credentials: "same-origin"
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && data.share_origin) {
          appShareOrigin = String(data.share_origin).replace(/\/+$/, "");
        }
        return appShareOrigin;
      })
      .catch(() => "");
  }
  return appInfoPromise;
}

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.href = "/login.html?next=" + next;
    return null;
  }
  await loadAppInfo();
  return user;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value, withTime = true) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  const pad = (number) => String(number).padStart(2, "0");
  const base =
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate());
  if (!withTime) return base;
  return base + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

function statusInfo(survey) {
  if (survey.status === "draft") return { text: "草稿", className: "draft" };
  if (survey.status === "closed") return { text: "已关闭", className: "closed" };
  if (survey.deadline && new Date(survey.deadline).getTime() <= Date.now()) {
    return { text: "已截止", className: "expired" };
  }
  return { text: "已发布", className: "published" };
}

function publicUrl(publicIdValue) {
  return (appShareOrigin || location.origin) + "/survey/" + publicIdValue;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    const input = document.createElement("textarea");
    input.value = value;
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    input.remove();
    return ok;
  }
}

function setMessage(element, message, isSuccess = false) {
  element.textContent = message || "";
  element.classList.toggle("success", Boolean(message) && isSuccess);
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  location.href = "/login.html";
}

function typeName(type) {
  return {
    single: "单选题",
    multiple: "多选题",
    text: "文本填空题",
    number: "数字填空题"
  }[type] || type;
}
