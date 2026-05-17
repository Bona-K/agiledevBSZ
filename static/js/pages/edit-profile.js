/* global $, window */

// Page: edit_profile.html — success toast + redirect to profile after save.
(function editProfilePage() {
  const REDIRECT_MS = 3000;

  $(document).ready(() => {
    if ($("body").attr("data-page") !== "edit-profile") return;

    const $success = $("#serverSuccess");
    if ($success.length === 0) return;

    const C = window.AppCore;
    const profileUrl = C && C.appUrl ? C.appUrl("profile") : "/profile";

    $("#editProfileForm")
      .find("input, textarea, button")
      .prop("disabled", true);

    if (C && C.showToast) {
      C.showToast("Profile updated successfully.", "success", REDIRECT_MS);
    }

    window.setTimeout(() => {
      window.location.assign(profileUrl);
    }, REDIRECT_MS);
  });
})();
