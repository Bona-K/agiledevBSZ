/* global $, window */

// Page: dashboard.html
// Features: authenticated home stats, search, popular/latest route sections.
(function dashboardPage() {
    const C = window.AppCore;
    if (!C) return;

    function mountDashboard() {
        C.requireAuthOrRedirect();
        C.seedIfEmpty();
        C.mountNav();

        const users = C.readStore(C.STORAGE_KEYS.users, []);
        const routes = C.readStore(C.STORAGE_KEYS.routes, []);
        const saved = C.readStore(C.STORAGE_KEYS.saved, []);
        const session = C.getSession();
        const myRoutes = routes.filter((r) => r.authorId === session.userId);

        $("#statRoutes").text(routes.length);
        $("#statMyRoutes").text(myRoutes.length);
        $("#statTopTheme").text(C.topTheme(routes) || "—");

        function renderHomeLists() {
            const q = String($("#homeSearch").val() || "").trim().toLowerCase();
            let items = routes.filter((r) => r.isPublic);
            if (q) {
                items = items.filter((r) => {
                    return (
                        r.title.toLowerCase().includes(q) ||
                        r.description.toLowerCase().includes(q) ||
                        (r.tags || []).some((t) => t.toLowerCase().includes(q))
                    );
                });
            }

            const popular = items
                .slice()
                .sort((a, b) => (b.likes || 0) - (a.likes || 0))
                .slice(0, 6);
            const latest = items
                .slice()
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .slice(0, 6);

            $("#popularRoutes").html(
                popular.map((r) => C.routeCardHtml(r, users, saved, { showPhotoCover: true })).join("") || C.emptyCard("No popular routes found.")
            );
            $("#latestRoutes").html(
                latest.map((r) => C.routeCardHtml(r, users, saved, { showPhotoCover: true })).join("") || C.emptyCard("No latest routes found.")
            );
        }

        $("#homeSearch").on("input", renderHomeLists);
        renderHomeLists();
    }

    $(document).ready(() => {
        if ($("body").attr("data-page") === "dashboard") mountDashboard();
    });
})();
