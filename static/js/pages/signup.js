/* global $, window */

// Page: signup.html
// Features: registration validation, duplicate username check, auto-login after signup.
(function signupPage() {
  const C = window.AppCore;
  if (!C) return;

  function mountSignup() {
    C.seedIfEmpty();
    const bootstrap = window.MYVIBE_BOOTSTRAP || {};
    if (bootstrap.isAuthenticated) {
      window.location.href = C.appUrl("dashboard");
      return;
    }

    C.clearSession();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "signup") mountSignup();
  });
})();
