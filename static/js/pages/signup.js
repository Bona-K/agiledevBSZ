/* global $, window */

// Page: signup.html
// Features: client-side validation, real-time password match, loading state.
(function signupPage() {
  const C = window.AppCore;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** 인라인 에러 블록에 메시지를 표시한다. */
  function showInlineError(message) {
    $("#signupErrorText").text(message);
    $("#signupError").removeClass("hidden").addClass("flex");
  }

  /** 인라인 에러 블록을 숨긴다. */
  function hideInlineError() {
    $("#signupError").removeClass("flex").addClass("hidden");
    $("#signupErrorText").text("");
  }

  /** 개별 필드 에러 표시 */
  function showFieldError($field, $errorEl) {
    $field.addClass("border-rose-400 focus:border-rose-400");
    $errorEl.removeClass("hidden");
  }

  /** 개별 필드 에러 초기화 */
  function clearFieldError($field, $errorEl) {
    $field.removeClass("border-rose-400 focus:border-rose-400");
    $errorEl.addClass("hidden");
  }

  /** 이메일 형식 검사 */
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  /** 버튼 로딩 상태 전환 */
  function setLoading(isLoading) {
    const $btn = $("#signupBtn");
    if (isLoading) {
      $btn
        .prop("disabled", true)
        .html(
          `<span class="inline-flex items-center gap-2 justify-center">
             <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
               <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
               <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
             </svg>
             Creating account...
           </span>`
        );
    } else {
      $btn.prop("disabled", false).text("Sign up and continue");
    }
  }

  // -------------------------------------------------------------------------
  // Real-time password match indicator
  // -------------------------------------------------------------------------

  function updatePasswordMatchIndicator() {
    const password  = String($("#suPassword").val()  || "");
    const confirm   = String($("#suPassword2").val() || "");
    const $msg      = $("#passwordMatchMsg");

    // 확인 필드가 비어 있으면 표시하지 않음
    if (!confirm) {
      $msg.addClass("hidden").text("");
      return;
    }

    if (password === confirm) {
      $msg
        .removeClass("hidden text-rose-600")
        .addClass("text-emerald-600")
        .text("✓ Passwords match");
      clearFieldError($("#suPassword2"), $msg);
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
    const name      = String($("#suName").val()      || "").trim();
    const email     = String($("#suEmail").val()     || "").trim();
    const username  = String($("#suUsername").val()  || "").trim();
    const password  = String($("#suPassword").val()  || "");
    const confirm   = String($("#suPassword2").val() || "");
    let valid = true;

    // Name
    if (!name) {
      showFieldError($("#suName"), $("#suNameError"));
      valid = false;
    } else {
      clearFieldError($("#suName"), $("#suNameError"));
    }

    // Email
    if (!email || !isValidEmail(email)) {
      showFieldError($("#suEmail"), $("#suEmailError"));
      valid = false;
    } else {
      clearFieldError($("#suEmail"), $("#suEmailError"));
    }

    // Username
    if (!username) {
      showFieldError($("#suUsername"), $("#suUsernameError"));
      valid = false;
    } else {
      clearFieldError($("#suUsername"), $("#suUsernameError"));
    }

    // Password
    if (password.length < 6) {
      showFieldError($("#suPassword"), $("#suPasswordError"));
      valid = false;
    } else {
      clearFieldError($("#suPassword"), $("#suPasswordError"));
    }

    // Confirm password
    if (password !== confirm) {
      showFieldError($("#suPassword2"), $("#passwordMatchMsg"));
      $("#passwordMatchMsg")
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

  function mountSignup() {
    if (C) {
      C.seedIfEmpty();

      // 이미 로그인된 경우 dashboard로 이동
      const bootstrap = window.MYVIBE_BOOTSTRAP || {};
      if (bootstrap.isAuthenticated) {
        window.location.href = C.appUrl("dashboard");
        return;
      }
    }

    // 입력 시 해당 필드 에러 즉시 해제
    $("#suName").on("input", function () {
      if (String($(this).val() || "").trim()) {
        clearFieldError($(this), $("#suNameError"));
        hideInlineError();
      }
    });

    $("#suEmail").on("input", function () {
      if (isValidEmail(String($(this).val() || "").trim())) {
        clearFieldError($(this), $("#suEmailError"));
        hideInlineError();
      }
    });

    $("#suUsername").on("input", function () {
      if (String($(this).val() || "").trim()) {
        clearFieldError($(this), $("#suUsernameError"));
        hideInlineError();
      }
    });

    $("#suPassword").on("input", function () {
      if (String($(this).val() || "").length >= 6) {
        clearFieldError($(this), $("#suPasswordError"));
        hideInlineError();
      }
      // 비밀번호 변경 시 실시간 일치 여부 재확인
      updatePasswordMatchIndicator();
    });

    // 확인 비밀번호 실시간 일치 확인
    $("#suPassword2").on("input", updatePasswordMatchIndicator);

    // 폼 제출 처리
    $("#signupForm").on("submit", function (e) {
      if (!validate()) {
        e.preventDefault();
        return;
      }

      // 유효성 통과 → 로딩 상태 전환 후 서버로 제출
      setLoading(true);

      // 서버 응답이 느릴 경우 5초 후 버튼 복구
      window.setTimeout(function () {
        setLoading(false);
      }, 5000);
    });
  }

  $(document).ready(function () {
    if ($("body").attr("data-page") === "signup") mountSignup();
  });
})();