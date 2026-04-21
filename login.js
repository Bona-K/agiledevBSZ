/* global $, window */

// Page: login.html
// Features: mock authentication, validation, session bootstrap, redirect to dashboard.
(function loginPage() {
  const C = window.AppCore;
  if (!C) return;

  function mountLogin() {
    C.seedIfEmpty();
    const existing = C.getSession();
    if (existing) {
      window.location.href = "../pages/dashboard.html";
      return;
    }

    $("#loginForm").on("submit", (e) => {
      e.preventDefault();
      const username = String($("#username").val() || "").trim().toLowerCase();
      const password = String($("#password").val() || "").trim();

      if (!username || !password) {
        C.showToast("Please enter username and password.", "error");
        return;
      }

      const users = C.readStore(C.STORAGE_KEYS.users, []);
      const user = users.find((u) => u.username === username) || users[0];
      C.setSession({
        userId: user.id,
        username: user.username,
        name: user.name,
        createdAt: C.nowIso(),
      });

      C.showToast("Login success (mock).", "success");
      window.setTimeout(() => {
        window.location.href = "../pages/dashboard.html";
      }, 400);
    });
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "login") mountLogin();
  });
})();
