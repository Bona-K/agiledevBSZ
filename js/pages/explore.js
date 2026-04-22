/* global $, window */

// Page: explore.html
// Features: keyword search, sort, tag chips, vibe tiles, pagination/load-more.
(function explorePage() {
    const C = window.AppCore;
    if (!C) return;

    function mountExplore() {
        C.requireAuthOrRedirect();
        C.seedIfEmpty();
        C.mountNav();

        const users = C.readStore(C.STORAGE_KEYS.users, []);
        const routes = C.readStore(C.STORAGE_KEYS.routes, []);
        const saved = C.readStore(C.STORAGE_KEYS.saved, []);

        let activeTheme = "";
        let activeTag = "";
        let visibleCount = 6;
        const pageSize = 6;

        function render() {
            const q = String($("#q").val() || "").trim().toLowerCase();
            const sort = String($("#sort").val() || "latest");
            let items = routes.filter((r) => r.isPublic);

            if (activeTheme) items = items.filter((r) => C.normalizeTheme(r.theme) === activeTheme);
            if (activeTag) items = items.filter((r) => (r.tags || []).includes(activeTag));
            if (q) {
                items = items.filter((r) => {
                    return (
                        r.title.toLowerCase().includes(q) ||
                        r.description.toLowerCase().includes(q) ||
                        (r.tags || []).some((t) => t.toLowerCase().includes(q))
                    );
                });
            }

            items = items.slice().sort((a, b) => {
                if (sort === "liked") return (b.likes || 0) - (a.likes || 0);
                return a.createdAt < b.createdAt ? 1 : -1;
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

        $("#q").on("input", resetAndRender);
        $("#searchBtn").on("click", resetAndRender);
        $("#sort").on("change", resetAndRender);

        $(".filter-chip").on("click", function onTagClick() {
            activeTag = String($(this).attr("data-tag") || "");
            $(".filter-chip").removeClass("is-selected");
            $(this).addClass("is-selected");
            resetAndRender();
        });

        $(".vibeTile").on("click", function onVibeClick() {
            const next = String($(this).attr("data-theme") || "");
            activeTheme = activeTheme === next ? "" : next;
            $(".vibeTile").removeClass("is-selected");
            if (activeTheme) $(`.vibeTile[data-theme='${activeTheme}']`).addClass("is-selected");
            resetAndRender();
        });

        $("#exploreLoadMore").on("click", () => {
            visibleCount += pageSize;
            render();
        });

        resetAndRender();
    }

    $(document).ready(() => {
        if ($("body").attr("data-page") === "explore") mountExplore();
    });
})();
