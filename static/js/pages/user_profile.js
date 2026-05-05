/* global window */

// Page: user_profile.html
// Features: AJAX follow/unfollow button, follower count update.
(function userProfilePage() {

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** 버튼을 팔로우 상태로 업데이트한다. */
  function setFollowingState(isFollowing) {
    const $btn = document.getElementById("followBtn");
    if (!$btn) return;

    if (isFollowing) {
      $btn.textContent = "Unfollow";
      $btn.className = [
        "w-full rounded-xl border border-slate-200 bg-white",
        "px-4 py-2 text-sm font-semibold text-slate-900",
        "shadow-sm transition hover:bg-rose-50",
        "hover:border-rose-200 hover:text-rose-700",
      ].join(" ");
    } else {
      $btn.textContent = "Follow";
      $btn.className = [
        "w-full rounded-xl bg-slate-900",
        "px-4 py-2 text-sm font-semibold text-white",
        "shadow-sm transition hover:bg-slate-800",
      ].join(" ");
    }
  }

  /** 팔로워 수 표시를 업데이트한다. */
  function setFollowerCount(count) {
    const $el = document.getElementById("followerCount");
    if ($el) $el.textContent = count;
  }

  /** 버튼 로딩 상태 처리 */
  function setLoading(isLoading) {
    const $btn = document.getElementById("followBtn");
    if (!$btn) return;
    $btn.disabled = isLoading;
    if (isLoading) {
      $btn.textContent = "...";
    }
  }

  // -------------------------------------------------------------------------
  // Follow / Unfollow AJAX
  // -------------------------------------------------------------------------

  async function handleFollowClick(username) {
    setLoading(true);
    try {
      const res = await fetch(`/follow/${encodeURIComponent(username)}`, {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        const msg = (data && data.error) || "Something went wrong.";
        alert(msg);
        setLoading(false);
        return;
      }

      setFollowingState(data.is_following);
      setFollowerCount(data.follower_count);

    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Mount
  // -------------------------------------------------------------------------

  function mountUserProfile() {
    const $btn = document.getElementById("followBtn");
    if (!$btn) return;

    // data-username 속성에서 유저명을 읽는다.
    // user_profile.html 의 followBtn 에 data-username 추가 필요
    const username = $btn.getAttribute("data-username");
    if (!username) return;

    $btn.addEventListener("click", function (e) {
      e.preventDefault();
      handleFollowClick(username);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const page = document.body.getAttribute("data-page");
    if (page === "user-profile") mountUserProfile();
  });
})();