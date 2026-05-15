/* global $, window */

// Page: profile.html
// Features: profile info, tab switching, my/saved route lists, delete actions.
(function profilePage() {
  const C = window.AppCore;
  if (!C) return;

  function mountProfileTabs() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);

    async function loadMyRoutes() {
      try {
        const data = await C.fetchJson("api/my-routes");
        return Array.isArray(data?.routes)
          ? data.routes.map(C.normalizeServerRoute).filter(Boolean)
          : [];
      } catch (err) {
        C.showToast("Could not load your routes.", "error");
        return [];
      }
    }

    async function renderPanels() {
      const myRoutes = await loadMyRoutes();
      const { routes: savedRoutes, savedIds } = await C.fetchSavedRoutes();
      const { routes: completedRoutes } = await C.fetchCompletedRoutes();

      $("#myRoutesGrid").html(
        myRoutes.map((r) => C.routeManageCardHtml(r, users, savedIds)).join("") ||
          C.emptyCard("No routes yet.")
      );

      $("#savedRoutesGrid").html(
        savedRoutes.map((r) => C.routeCardHtml(r, users, savedIds)).join("") ||
          C.emptyCard("No saved routes yet.")
      );

      $("#completedRoutesGrid").html(
        completedRoutes.map((r) => C.routeCardHtml(r, users, savedIds)).join("") ||
          C.emptyCard("No completed routes yet.")
      );

    }

    function setTab(name) {
      $(".tabBtn").removeClass("bg-slate-900 text-white").addClass("bg-white text-slate-800 border border-slate-200 hover:bg-slate-50");
      $(`.tabBtn[data-tab='${name}']`).removeClass("bg-white text-slate-800 border border-slate-200 hover:bg-slate-50").addClass("bg-slate-900 text-white");
      $("[data-tab-panel]").addClass("hidden");
      $(`[data-tab-panel='${name}']`).removeClass("hidden");
    }

    $(".tabBtn").on("click", function () {
      setTab(String($(this).attr("data-tab")));
    });

    $("#myRoutesGrid").on("click", ".btnDeleteMyRoute", async function () {
      const routeId = String($(this).attr("data-route-id") || "");
      if (!routeId) return;
      if (!window.confirm("Delete this route? This cannot be undone.")) return;
      if (/^\d+$/.test(routeId)) {
        try {
          await C.fetchJson(`api/routes/${encodeURIComponent(routeId)}`, { method: "DELETE" });
        } catch (err) {
          if (err.status === 403) C.showToast("You can only delete your own routes.", "error");
          else C.showToast(err.body?.error || err.message || "Could not delete route.", "error");
          return;
        }
        await renderPanels();
        C.showToast("Route deleted.", "success");
        return;
      }
      const nextRoutes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.id !== routeId);
      C.writeStore(C.STORAGE_KEYS.routes, nextRoutes);
      const nextSaved = C.readStore(C.STORAGE_KEYS.saved, []).filter((id) => id !== routeId);
      C.writeStore(C.STORAGE_KEYS.saved, nextSaved);
      await renderPanels();
      C.showToast("Route deleted (mock).", "success");
    });

    renderPanels();
    setTab("my");
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "profile") mountProfileTabs();
  });
})();
