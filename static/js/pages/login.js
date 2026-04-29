/* global $, window */

// Page: login.html
// Features: client-side validation, loading state on submit button.
(function loginPage() {
  const C = window.AppCore;

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** 인라인 에러 메시지를 표시한다. */
  function showInlineError(message) {
    const $error = $("#loginError");
    $("#loginErrorText").text(message);
    $error.removeClass("hidden").addClass("flex");
  }

  /** 인라인 에러 메시지를 숨긴다. */
  function hideInlineError() {
    $("#loginError").removeClass("flex").addClass("hidden");
    $("#loginErrorText").text("");
  }

  /** 필드 에러 표시 */
  function showFieldError($field, $errorEl) {
    $field.addClass("border-rose-400 focus:border-rose-400");
    $errorEl.removeClass("hidden");
  }

  /** 필드 에러 초기화 */
  function clearFieldError($field, $errorEl) {
    $field.removeClass("border-rose-400 focus:border-rose-400");
    $errorEl.addClass("hidden");
  }

  /** 버튼을 로딩 상태로 전환한다. */
  function setLoading(isLoading) {
    const $btn = $("#loginBtn");
    if (isLoading) {
      $btn
        .prop("disabled", true)
        .html(
          `<span class="inline-flex items-center gap-2 justify-center">
             <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
               <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
               <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
             </svg>
             Logging in...
           </span>`
        );
    } else {
      $btn.prop("disabled", false).text("Login");
    }
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * 폼 유효성을 검사한다.
   * @returns {boolean} 유효하면 true
   */
  function validate() {
    const username = String($("#username").val() || "").trim();
    const password = String($("#password").val() || "").trim();
    let valid = true;

    // username
    if (!username) {
      showFieldError($("#username"), $("#usernameError"));
      valid = false;
    } else {
      clearFieldError($("#username"), $("#usernameError"));
    }

    // password
    if (!password) {
      showFieldError($("#password"), $("#passwordError"));
      valid = false;
    } else {
      clearFieldError($("#password"), $("#passwordError"));
    }

    if (!valid) {
      showInlineError("Please fill in all required fields.");
    } else {
      hideInlineError();
    }

    return valid;
  }

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------

  function mountLogin() {
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
    $("#username").on("input", function () {
      if (String($(this).val() || "").trim()) {
        clearFieldError($(this), $("#usernameError"));
        hideInlineError();
      }
    });

    $("#password").on("input", function () {
      if (String($(this).val() || "").trim()) {
        clearFieldError($(this), $("#passwordError"));
        hideInlineError();
      }
    });

    // 폼 제출 처리
    $("#loginForm").on("submit", function (e) {
      // 유효성 검사 실패 시 서버 요청 차단
      if (!validate()) {
        e.preventDefault();
        return;
      }

      // 유효성 통과 → 로딩 상태 전환 후 서버로 제출
      setLoading(true);

      // 서버 응답이 느릴 경우를 대비해 5초 후 버튼 복구
      window.setTimeout(function () {
        setLoading(false);
      }, 5000);
    });
  }

  $(document).ready(function () {
    if ($("body").attr("data-page") === "login") mountLogin();
  });
})();