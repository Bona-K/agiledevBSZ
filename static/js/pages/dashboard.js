/* global $, window */

// Page: dashboard.html
// Features: authenticated home stats, search, popular/latest route sections.
(function dashboardPage() {
  const C = window.AppCore;
  if (!C) return;

  function normalizeServerRoute(r) {
    if (!r || typeof r !== "object") return null;
    return { ...r, id: String(r.id), authorId: r.authorId };
  }

  async function mountDashboard() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const saved = C.readStore(C.STORAGE_KEYS.saved, []);
    const session = C.getSession();
    const boot = window.MYVIBE_BOOTSTRAP || {};

    const mockRoutes = C.readStore(C.STORAGE_KEYS.routes, []);
    const mockMyCount = mockRoutes.filter((r) => r.authorId === session.userId).length;

    let routes = mockRoutes;
    let statTotal = routes.length;
    let statMyRoutes = mockMyCount;
    let statTopTheme = C.topTheme(routes) || "—";
    let usingServerFeed = false;

    if (boot.isAuthenticated) {
      try {
        const [pubData, myData] = await Promise.all([
          C.fetchJson("api/routes/public"),
          C.fetchJson("api/my-routes"),
        ]);
        const rawPub = Array.isArray(pubData?.routes) ? pubData.routes : [];
        const normalized = rawPub.map(normalizeServerRoute).filter(Boolean);
        routes = normalized;
        statTotal = normalized.length;
        statMyRoutes = Array.isArray(myData?.routes) ? myData.routes.length : 0;
        statTopTheme = C.topTheme(normalized) || "—";
        usingServerFeed = true;
      } catch {
        C.showToast("Could not load live routes — showing saved demo data.", "error");
        routes = mockRoutes;
        statTotal = mockRoutes.length;
        statMyRoutes = mockMyCount;
        statTopTheme = C.topTheme(mockRoutes) || "—";
        usingServerFeed = false;
      }
    }

    $("#statRoutes").text(statTotal);
    $("#statMyRoutes").text(statMyRoutes);
    $("#statTopTheme").text(statTopTheme);
    $("#dashStatRoutesNote").text(usingServerFeed ? "Public routes (server)" : "Using mock data");
    $("#dashStatThemeNote").text(usingServerFeed ? "From public feed" : "Mock metric");

    function renderHomeLists() {
      const q = String($("#homeSearch").val() || "").trim().toLowerCase();
      let items = routes.filter((r) => r.isPublic);
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

      const popular = items
        .slice()
        .sort((a, b) => (b.likes || 0) - (a.likes || 0))
        .slice(0, 6);
      const latest = items
        .slice()
        .sort((a, b) => (String(a.createdAt || "") < String(b.createdAt || "") ? 1 : -1))
        .slice(0, 6);

      $("#popularRoutes").html(
        popular.map((r) => C.routeCardHtml(r, users, saved, { showPhotoCover: true })).join("") ||
          C.emptyCard("No popular routes found.")
      );
      $("#latestRoutes").html(
        latest.map((r) => C.routeCardHtml(r, users, saved, { showPhotoCover: true })).join("") ||
          C.emptyCard("No latest routes found.")
      );
    }

    $("#homeSearch").on("input", renderHomeLists);
    renderHomeLists();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "dashboard") void mountDashboard();
  });
})();
