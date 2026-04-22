/* global $, window */

// Page: route.html
// Features: route detail rendering, like/save/share actions, owner edit/delete controls.
(function routePage() {
    const C = window.AppCore;
    if (!C) return;

    function mountRoute() {
        C.requireAuthOrRedirect();
        C.seedIfEmpty();
        C.mountNav();

        const users = C.readStore(C.STORAGE_KEYS.users, []);
        const routes = C.readStore(C.STORAGE_KEYS.routes, []);
        const saved = C.readStore(C.STORAGE_KEYS.saved, []);
        const session = C.getSession();

        const routeId = C.getQueryParam("r") || routes[0]?.id;
        const route = routes.find((r) => r.id === routeId) || routes[0];
        if (!route) {
            C.showToast("Route not found.", "error");
            window.location.href = "../pages/dashboard.html";
            return;
        }

        const author = users.find((u) => u.id === route.authorId);
        $("#routeTitle").text(route.title);
        $("#routeTheme").text(route.theme);
        $("#routeAuthor").text(author ? author.name : "Unknown");
        $("#routeMeta").text(`${C.formatDate(route.createdAt)} · ${route.locations.length} stops · ★ ${route.rating}`);
        $("#routeDesc").text(route.description);
        $("#routeTags").html(
            (route.tags || [])
                .map((t) => `<span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">#${C.escapeHtml(t)}</span>`)
                .join("")
        );

        const locHtml = route.locations
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((loc) => {
                return `
          <li class="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-900">${C.escapeHtml(loc.order)}. ${C.escapeHtml(loc.name)}</div>
                <div class="mt-1 text-xs font-semibold text-slate-600">${C.escapeHtml(loc.time)} · Parking ${C.escapeHtml(loc.parking || "—")}</div>
                <p class="mt-3 text-sm leading-6 text-slate-700">${C.escapeHtml(loc.desc || "")}</p>
              </div>
              <div class="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Stop</div>
            </div>
          </li>
        `;
            })
            .join("");
        $("#routeLocations").html(locHtml);

        const savedSet = new Set(saved || []);
        C.updateRouteButtons(route, savedSet);
        const isOwner = session && session.userId === route.authorId;
        if (isOwner) {
            $("#ownerActions").removeClass("hidden");
            $("#btnEditRoute").attr("href", `../pages/create-route.html?r=${encodeURIComponent(route.id)}&mode=edit`);
        }

        $("#btnLike").on("click", () => {
            route.likes = (route.likes || 0) + 1;
            C.writeStore(C.STORAGE_KEYS.routes, routes);
            C.showToast("Liked (mock).", "success");
        });

        $("#btnSave").on("click", () => {
            const set = new Set(C.readStore(C.STORAGE_KEYS.saved, []));
            if (set.has(route.id)) set.delete(route.id);
            else set.add(route.id);
            const arr = Array.from(set);
            C.writeStore(C.STORAGE_KEYS.saved, arr);
            C.updateRouteButtons(route, set);
            C.showToast(set.has(route.id) ? "Saved (mock)." : "Removed from saved (mock).", "success");
        });

        $("#btnShare").on("click", async () => {
            const url = window.location.href;
            try {
                await navigator.clipboard.writeText(url);
                C.showToast("Link copied.", "success");
            } catch {
                C.showToast("Copy failed. Please copy from address bar.", "error");
            }
        });

        $("#btnCmt").on("click", () => C.showToast("Comment section is placeholder only.", "info"));

        $("#btnDeleteRoute").on("click", () => {
            if (!isOwner) return;
            if (!window.confirm("Delete this route? This action cannot be undone.")) return;
            const nextRoutes = routes.filter((r) => r.id !== route.id);
            C.writeStore(C.STORAGE_KEYS.routes, nextRoutes);
            const nextSaved = (saved || []).filter((id) => id !== route.id);
            C.writeStore(C.STORAGE_KEYS.saved, nextSaved);
            C.showToast("Route deleted (mock).", "success");
            window.setTimeout(() => {
                window.location.href = "../pages/dashboard.html";
            }, 350);
        });
    }

    $(document).ready(() => {
        if ($("body").attr("data-page") === "route") mountRoute();
    });
})();
