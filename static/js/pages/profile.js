/* global $, window */

// Page: profile.html
// Features: profile info, tab switching, my/saved route lists, saved locations, delete actions.
(function profilePage() {
  const C = window.AppCore;
  if (!C) return;

  function mountProfileTabs() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const session = C.getSession();
    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const savedLocations = C.readStore(C.STORAGE_KEYS.locations, []);
    const me = users.find((u) => u.id === session.userId) || users[0];

    $("#profileName").text(me.name);
    $("#profileUsername").text("@" + me.username);
    $("#profileBio").text(me.bio);
    $("#profileInitials").text(C.initials(me.name));
    $("#profileJoined").text(C.formatDate(me.joinedAt));

    async function loadMyRoutes() {
      try {
        const data = await C.fetchJson("api/my-routes");
        return Array.isArray(data?.routes) ? data.routes : [];
      } catch (err) {
        C.showToast("Could not load your routes.", "error");
        return [];
      }
    }

    async function renderPanels() {
      const myRoutes = await loadMyRoutes();
      const allSaved = C.readStore(C.STORAGE_KEYS.saved, []);
      $("#myRoutesGrid").html(
        myRoutes.map((r) => C.routeManageCardHtml(r, users, allSaved)).join("") ||
          C.emptyCard("You have not created any routes yet.")
      );

      const savedSet = new Set(allSaved || []);
      const allRoutes = C.readStore(C.STORAGE_KEYS.routes, []);
      const savedRoutes = allRoutes.filter((r) => savedSet.has(r.id));
      $("#savedRoutesGrid").html(savedRoutes.map((r) => C.routeCardHtml(r, users, allSaved)).join("") || C.emptyCard("No saved routes yet."));

      const locationHtml = (savedLocations || [])
        .map((loc) => {
          return `
            <div class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div class="text-sm font-semibold text-slate-900">${C.escapeHtml(loc.name)}</div>
              <div class="mt-1 text-xs font-semibold text-slate-600">${C.escapeHtml(loc.time || "—")} · Parking ${C.escapeHtml(loc.parking || "unknown")}</div>
              <div class="mt-2 text-sm text-slate-700">${C.escapeHtml(loc.desc || "")}</div>
            </div>
          `;
        })
        .join("");
      $("#myLocationsGrid").html(locationHtml || C.emptyCard("No saved locations yet."));
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

    $("#myRoutesGrid").on("click", ".btnDeleteMyRoute", function () {
      const routeId = String($(this).attr("data-route-id") || "");
      if (!routeId) return;
      if (/^\d+$/.test(routeId)) {
        C.showToast("Delete is not available yet.", "error");
        return;
      }
      if (!window.confirm("Delete this route?")) return;
      const nextRoutes = C.readStore(C.STORAGE_KEYS.routes, []).filter((r) => r.id !== routeId);
      C.writeStore(C.STORAGE_KEYS.routes, nextRoutes);
      const nextSaved = C.readStore(C.STORAGE_KEYS.saved, []).filter((id) => id !== routeId);
      C.writeStore(C.STORAGE_KEYS.saved, nextSaved);
      renderPanels();
      C.showToast("Route deleted (mock).", "success");
    });

    renderPanels();
    setTab("my");
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "profile") mountProfileTabs();
  });
})();
