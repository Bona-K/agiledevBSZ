/* global $, window */

// Page: change_password.html
// Features: empty field validation, real-time password match, loading state.
(function changePasswordPage() {

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function showInlineError(message) {
    $("#changePasswordErrorText").text(message);
    $("#changePasswordError").removeClass("hidden").addClass("flex");
  }

  function hideInlineError() {
    $("#changePasswordError").removeClass("flex").addClass("hidden");
    $("#changePasswordErrorText").text("");
  }

  function showFieldError($field, $errorEl) {
    $field.addClass("border-rose-400 focus:border-rose-400");
    $errorEl.removeClass("hidden");
  }

  function clearFieldError($field, $errorEl) {
    $field.removeClass("border-rose-400 focus:border-rose-400");
    $errorEl.addClass("hidden");
  }

  function setLoading(isLoading) {
    const $btn = $("#changePasswordBtn");
    if (isLoading) {
      $btn
        .prop("disabled", true)
        .html(
          `<span class="inline-flex items-center gap-2 justify-center">
             <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
               <circle class="opacity-25" cx="12" cy="12" r="10"
                 stroke="currentColor" stroke-width="4"></circle>
               <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
             </svg>
             Updating...
           </span>`
        );
    } else {
      $btn.prop("disabled", false).text("Update password");
    }
  }

  // -------------------------------------------------------------------------
  // Real-time password match indicator
  // -------------------------------------------------------------------------

  function updateMatchIndicator() {
    const newPw  = String($("#newPassword").val()     || "");
    const confirm = String($("#confirmPassword").val() || "");
    const $msg   = $("#confirmPasswordMatchMsg");

    if (!confirm) {
      $msg.addClass("hidden").text("");
      return;
    }

    if (newPw === confirm) {
      $msg
        .removeClass("hidden text-rose-600")
        .addClass("text-emerald-600")
        .text("✓ Passwords match");
    } else {
      $msg
        .removeClass("hidden text-emerald-600")
        .addClass("text-rose-600")
        .text("✗ Passwords do not match");
    }
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  function validate() {
    const current = String($("#currentPassword").val() || "").trim();
    const newPw   = String($("#newPassword").val()     || "");
    const confirm = String($("#confirmPassword").val() || "");
    let valid = true;

    // Current password
    if (!current) {
      showFieldError($("#currentPassword"), $("#currentPasswordError"));
      valid = false;
    } else {
      clearFieldError($("#currentPassword"), $("#currentPasswordError"));
    }

    // New password length
    if (newPw.length < 6) {
      showFieldError($("#newPassword"), $("#newPasswordError"));
      valid = false;
    } else {
      clearFieldError($("#newPassword"), $("#newPasswordError"));
    }

    // Confirm match
    const $matchMsg = $("#confirmPasswordMatchMsg");
    if (newPw !== confirm) {
      $matchMsg
        .removeClass("hidden text-emerald-600")
        .addClass("text-rose-600")
        .text("✗ Passwords do not match");
      valid = false;
    }

    if (!valid) {
      showInlineError("Please fix the errors above before continuing.");
    } else {
      hideInlineError();
    }

    return valid;
  }

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------

  function mountChangePassword() {
    // 입력 시 해당 필드 에러 즉시 해제
    $("#currentPassword").on("input", function () {
      if (String($(this).val() || "").trim()) {
        clearFieldError($(this), $("#currentPasswordError"));
        hideInlineError();
      }
    });

    $("#newPassword").on("input", function () {
      if (String($(this).val() || "").length >= 6) {
        clearFieldError($(this), $("#newPasswordError"));
        hideInlineError();
      }
      updateMatchIndicator();
    });

    $("#confirmPassword").on("input", updateMatchIndicator);

    // 폼 제출 처리
    $("#changePasswordForm").on("submit", function (e) {
      if (!validate()) {
        e.preventDefault();
        return;
      }

      setLoading(true);

      // 서버 응답 지연 대비 5초 후 버튼 복구
      window.setTimeout(function () {
        setLoading(false);
      }, 5000);
    });
  }

  $(document).ready(function () {
    if ($("body").attr("data-page") === "change-password") mountChangePassword();
  });
})();