/* global $, window */

// Page: explore.html
// Features: keyword search, sort, tag chips, vibe tiles, pagination/load-more.
// Issue #40 + #41: Wired to real /api/routes/public with server-side filtering.
(function explorePage() {
  const C = window.AppCore;
  if (!C) return;

  function normalizeServerRoute(r) {
    if (!r || typeof r !== "object") return null;
    return { ...r, id: String(r.id), authorId: r.authorId };
  }

  function showSkeletons(count = 6) {
    const skeletons = Array(count)
      .fill(0)
      .map(
        () => `
        <div class="route-card animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div class="h-4 w-2/3 rounded bg-slate-200 mb-3"></div>
          <div class="h-3 w-full rounded bg-slate-100 mb-2"></div>
          <div class="h-3 w-1/2 rounded bg-slate-100"></div>
        </div>`
      )
      .join("");
    $("#exploreGrid").html(skeletons);
    $("#exploreLoadMore").addClass("hidden");
  }

  async function fetchRoutes(params = {}) {
    const qs = new URLSearchParams();
    if (params.q)     qs.set("q",     params.q);
    if (params.sort)  qs.set("sort",  params.sort);
    if (params.tag)   qs.set("tag",   params.tag);
    if (params.theme) qs.set("theme", params.theme);
    const data = await C.fetchJson("api/routes/public?" + qs.toString());
    return Array.isArray(data?.routes) ? data.routes.map(normalizeServerRoute).filter(Boolean) : [];
  }

  async function mountExplore() {
    C.requireAuthOrRedirect();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const saved = C.readStore(C.STORAGE_KEYS.saved, []);

    let activeTheme = "";
    let activeTag   = "";
    let allRoutes   = [];
    let visibleCount = 6;
    const pageSize   = 6;

    // Show skeletons on initial load
    showSkeletons(6);

    // Initial fetch
    try {
      allRoutes = await fetchRoutes();
    } catch {
      C.showToast("Could not load routes — showing demo data.", "error");
      C.seedIfEmpty();
      allRoutes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.isPublic);
    }

    function renderGrid(items) {
      const visible = items.slice(0, visibleCount);
      const html = visible.map((r) => C.routeCardHtml(r, users, saved)).join("");
      $("#exploreGrid").html(html || `<div class="text-sm text-slate-600 col-span-3 py-8 text-center">No matching routes found.</div>`);
      if (items.length <= visibleCount) $("#exploreLoadMore").addClass("hidden");
      else $("#exploreLoadMore").removeClass("hidden");
    }

    async function refreshFromApi() {
      visibleCount = pageSize;
      showSkeletons(6);
      const q    = String($("#q").val() || "").trim();
      const sort = String($("#sort").val() || "latest");
      try {
        allRoutes = await fetchRoutes({ q, sort, tag: activeTag, theme: activeTheme });
        renderGrid(allRoutes);
      } catch {
        $("#exploreGrid").html(`<div class="text-sm text-slate-600 col-span-3 py-8 text-center">Failed to load routes. Please try again.</div>`);
      }
    }

    // Debounced search input
    let searchTimer = null;
    $("#q").on("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(refreshFromApi, 350);
    });
    $("#searchBtn").on("click", refreshFromApi);
    $("#sort").on("change", refreshFromApi);

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
      refreshFromApi();
    });

    $(".theme-filter-chip").on("click", function onThemeChipClick() {
      const next = String($(this).attr("data-theme") || "").trim().toLowerCase();
      activeTheme = activeTheme === next ? "" : next;
      $(".vibeTile").removeClass("is-selected");
      if (activeTheme) $(`.vibeTile[data-theme='${activeTheme}']`).addClass("is-selected");
      refreshFromApi();
    });

    syncThemeChipUi();
    $("#exploreLoadMore").on("click", () => {
      visibleCount += pageSize;
      renderGrid(allRoutes);
    });

    // Initial render with already-fetched data
    renderGrid(allRoutes);
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "explore") void mountExplore();
  });
})();