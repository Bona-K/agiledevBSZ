/* global $, window */

// Page: explore.html
// Features: keyword search, sort, theme/tag chips, pagination/load-more.
(function explorePage() {
  const C = window.AppCore;
  if (!C) return;

  async function mountExplore() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const boot = window.MYVIBE_BOOTSTRAP || {};
    let routes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.isPublic);
    let saved = C.readStore(C.STORAGE_KEYS.saved, []);

    if (boot.isAuthenticated) {
      try {
        routes = await C.fetchPublicRoutes();
        saved = await C.fetchSavedRouteIds();
      } catch {
        C.showToast("Could not load live routes — showing saved demo data.", "error");
        routes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.isPublic);
      }
    }

    let activeTheme = "";
    let activeTag = "";
    const $initialTagChip = $(".tag-filter-chip.is-selected").first();
    if ($initialTagChip.length) {
      activeTag = String($initialTagChip.attr("data-tag") || "").trim().toLowerCase();
    }
    let visibleCount = 6;
    const pageSize = 6;

    function render() {
      const q = String($("#q").val() || "").trim().toLowerCase();
      const sort = String($("#sort").val() || "latest");
      let items = routes.filter((r) => r.isPublic !== false);

      if (activeTheme) {
        items = items.filter(
          (r) => String(r.theme || "").trim().toLowerCase() === activeTheme
        );
      }
      if (activeTag) {
        items = items.filter((r) =>
          (r.tags || []).some((t) => String(t || "").trim().toLowerCase() === activeTag)
        );
      }
      if (q) {
        items = items.filter((r) => {
          return (
            String(r.title || "")
              .toLowerCase()
              .includes(q) ||
            String(r.description || "")
              .toLowerCase()
              .includes(q) ||
            (r.tags || []).some((t) => String(t || "").toLowerCase().includes(q))
          );
        });
      }

      items = items.slice().sort((a, b) => {
        if (sort === "liked") return (b.likes || 0) - (a.likes || 0);
        return String(a.createdAt || "") < String(b.createdAt || "") ? 1 : -1;
      });

      const html = items
        .slice(0, visibleCount)
        .map((r) => C.routeCardHtml(r, users, saved))
        .join("");
      $("#exploreGrid").html(html || `<div class="text-sm text-slate-600">No matching routes.</div>`);
      if (items.length <= visibleCount) $("#exploreLoadMore").addClass("hidden");
      else $("#exploreLoadMore").removeClass("hidden");
    }

    function resetAndRender() {
      visibleCount = pageSize;
      render();
    }

    $(document).on("mv:routeLikeChanged", (_e, detail) => {
      if (!detail?.routeId) return;
      const route = routes.find((r) => String(r.id) === String(detail.routeId));
      if (!route) return;
      route.likes = detail.likes;
      route.userLiked = detail.userLiked;
    });

    $("#q").on("input", resetAndRender);
    $("#searchBtn").on("click", resetAndRender);
    $("#sort").on("change", resetAndRender);

    function syncThemeChipUi() {
      $(".theme-filter-chip").removeClass("is-selected");
      if (!activeTheme) {
        $(".theme-filter-chip").first().addClass("is-selected");
        return;
      }
      $(".theme-filter-chip").each(function eachThemeChip() {
        const v = String($(this).attr("data-theme") || "").trim().toLowerCase();
        if (v === activeTheme) $(this).addClass("is-selected");
      });
    }

    $(".tag-filter-chip").on("click", function onTagChipClick() {
      activeTag = String($(this).attr("data-tag") || "").trim().toLowerCase();
      $(".tag-filter-chip").removeClass("is-selected");
      $(this).addClass("is-selected");
      resetAndRender();
    });

    $(".theme-filter-chip").on("click", function onThemeChipClick() {
      const next = String($(this).attr("data-theme") || "").trim().toLowerCase();
      activeTheme = activeTheme === next ? "" : next;
      syncThemeChipUi();
      resetAndRender();
    });

    syncThemeChipUi();
    $("#exploreLoadMore").on("click", () => {
      visibleCount += pageSize;
      render();
    });

    resetAndRender();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "explore") void mountExplore();
  });
})();
