/* global $, window */

// Page: signup.html
// Features: registration validation, duplicate username check, auto-login after signup.
(function signupPage() {
  const C = window.AppCore;
  if (!C) return;

  function mountSignup() {
    C.seedIfEmpty();
    const existing = C.getSession();
    if (existing) {
      window.location.href = "/dashboard";
      return;
    }

    $("#signupForm").on("submit", (e) => {
      e.preventDefault();
      const raw = String($("#suEmail").val() || "").trim().toLowerCase();
      const p1 = String($("#suPassword").val() || "");
      const p2 = String($("#suPassword2").val() || "");

      if (!raw) {
        C.showToast("Please enter username/email.", "error");
        return;
      }
      if (p1.length < 6) {
        C.showToast("Password must be at least 6 characters.", "error");
        return;
      }
      if (p1 !== p2) {
        C.showToast("Passwords do not match.", "error");
        return;
      }

      const users = C.readStore(C.STORAGE_KEYS.users, []);
      if (users.some((u) => u.username === raw)) {
        C.showToast("Username already exists.", "error");
        return;
      }

      const newUser = {
        id: "u_" + Math.floor(Math.random() * 1000000),
        name: raw,
        username: raw,
        bio: "No bio yet.",
        joinedAt: C.nowIso(),
      };

      users.push(newUser);
      C.writeStore(C.STORAGE_KEYS.users, users);

      C.setSession({
        userId: newUser.id,
        username: newUser.username,
        name: newUser.name,
        createdAt: C.nowIso(),
      });

      C.showToast("Signup success (mock).", "success");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 400);
    });
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "signup") mountSignup();
  });
})();