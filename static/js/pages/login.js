/* global $, window */

// Page: login.html
// Features: mock authentication, validation, session bootstrap, redirect to dashboard.
(function loginPage() {
  const C = window.AppCore;
  if (!C) return;

  function mountLogin() {
    C.seedIfEmpty();
    const bootstrap = window.MYVIBE_BOOTSTRAP || {};
    if (bootstrap.isAuthenticated) {
      window.location.href = C.appUrl("dashboard");
      return;
    }

    C.clearSession();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "login") mountLogin();
  });
})();
