(function () {
  const isRegister = location.pathname.endsWith("register.html");
  const errorBox = document.getElementById("error");

  function nextPage() {
    const next = new URLSearchParams(location.search).get("next");
    return next || "/dashboard.html";
  }

  getCurrentUser()
    .then((user) => {
      if (user) location.href = nextPage();
    })
    .catch(() => {});

  const form = document.getElementById(isRegister ? "registerForm" : "loginForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(errorBox, "");
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (isRegister) {
      const password2 = document.getElementById("password2").value;
      if (password !== password2) {
        setMessage(errorBox, "两次输入的密码不一致");
        return;
      }
    }

    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await api(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });
      location.href = nextPage();
    } catch (error) {
      setMessage(errorBox, error.message);
      button.disabled = false;
    }
  });
})();
