/* global $, window */

// Page: dashboard.html
// Features: authenticated home stats, search, popular/latest route sections.
// Issue #40: Wired to real /api/routes/public feed (server-side filtering).
(function dashboardPage() {
  const C = window.AppCore;
  if (!C) return;

  function normalizeServerRoute(r) {
    if (!r || typeof r !== "object") return null;
    return { ...r, id: String(r.id), authorId: r.authorId };
  }

  function showSkeletons(containerId, count = 3) {
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
    $("#" + containerId).html(skeletons);
  }

  async function fetchPublicRoutes(q = "") {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("sort", "latest");
    const data = await C.fetchJson("api/routes/public?" + params.toString());
    return Array.isArray(data?.routes) ? data.routes.map(normalizeServerRoute).filter(Boolean) : [];
  }

  async function mountDashboard() {
    C.requireAuthOrRedirect();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);
    let saved = C.readStore(C.STORAGE_KEYS.saved, []);
    const boot = window.MYVIBE_BOOTSTRAP || {};

    // Show skeletons immediately
    showSkeletons("popularRoutes", 3);
    showSkeletons("latestRoutes", 3);

    let routes = [];
    let statMyRoutes = 0;

    if (boot.isAuthenticated) {
      try {
        const [pubData, myData] = await Promise.all([
          C.fetchJson("api/routes/public"),
          C.fetchJson("api/my-routes"),
        ]);
        routes = Array.isArray(pubData?.routes)
          ? pubData.routes.map(normalizeServerRoute).filter(Boolean)
          : [];
        // Fetch saved route IDs (added by feature/edit_account_info)
        if (typeof C.fetchSavedRouteIds === "function") {
          saved = await C.fetchSavedRouteIds();
        }
        statMyRoutes = Array.isArray(myData?.routes) ? myData.routes.length : 0;
      } catch {
        C.showToast("Could not load live routes — showing demo data.", "error");
        C.seedIfEmpty();
        routes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.isPublic);
      }
    }

    // Stats
    $("#statRoutes").text(routes.length);
    $("#statMyRoutes").text(statMyRoutes);
    $("#statTopTheme").text(C.topTheme(routes) || "—");
    $("#dashStatRoutesNote").text("Public routes (live)");
    $("#dashStatThemeNote").text("From public feed");

    function renderHomeLists(items) {
      const popular = items
        .slice()
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 6);
      const latest = items
        .slice()
        .sort((a, b) => (String(a.createdAt || "") < String(b.createdAt || "") ? 1 : -1))
        .slice(0, 6);

      $("#popularRoutes").html(
        popular.map((r) => C.routeCardHtml(r, users, saved)).join("") ||
          C.emptyCard("No popular routes found.")
      );
      $("#latestRoutes").html(
        latest.map((r) => C.routeCardHtml(r, users, saved)).join("") ||
          C.emptyCard("No latest routes found.")
      );
    }

    // Initial render
    renderHomeLists(routes);

    // Search: call API with query, show skeletons while loading
    let searchTimer = null;
    $("#homeSearch").on("input", function () {
      const q = String($(this).val() || "").trim();
      clearTimeout(searchTimer);
      showSkeletons("popularRoutes", 3);
      showSkeletons("latestRoutes", 3);
      searchTimer = setTimeout(async () => {
        try {
          const filtered = await fetchPublicRoutes(q);
          renderHomeLists(filtered);
        } catch {
          renderHomeLists([]);
        }
      }, 350);
    });
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "dashboard") void mountDashboard();
  });
})();
