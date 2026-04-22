/* global $, window, document */

// Cross-page interactions and shared utilities.
// Pages using these helpers: login, signup, dashboard, explore, route, create-route, profile.
(function exposeAppCore(global) {
  const STORAGE_KEYS = {
    mockVersion: "mv_mock_version",
    session: "gp_session",
    users: "gp_users",
    routes: "mv_routes",
    saved: "mv_saved_route_ids",
    locations: "mv_saved_locations",
  };
  const MOCK_VERSION = 3;

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function readStore(key, fallback) {
    return safeJsonParse(global.localStorage.getItem(key), fallback);
  }

  function writeStore(key, value) {
    global.localStorage.setItem(key, JSON.stringify(value));
  }

  function seedIfEmpty() {
    const currentVersion = readStore(STORAGE_KEYS.mockVersion, 0);
    if (currentVersion !== MOCK_VERSION) {
      global.localStorage.removeItem(STORAGE_KEYS.users);
      global.localStorage.removeItem(STORAGE_KEYS.routes);
      global.localStorage.removeItem(STORAGE_KEYS.saved);
      global.localStorage.removeItem(STORAGE_KEYS.locations);
      writeStore(STORAGE_KEYS.mockVersion, MOCK_VERSION);
    }

    const users = readStore(STORAGE_KEYS.users, null);
    const routes = readStore(STORAGE_KEYS.routes, null);
    const saved = readStore(STORAGE_KEYS.saved, null);
    const locations = readStore(STORAGE_KEYS.locations, null);

    if (!users) {
      writeStore(STORAGE_KEYS.users, [
        { id: "u_1", name: "Alex Chen", username: "alex", bio: "Enjoys visual design and front-end motion.", joinedAt: "2026-03-01T00:00:00.000Z" },
        { id: "u_2", name: "Mina Li", username: "mina", bio: "Focused on product UX and usability.", joinedAt: "2026-03-05T00:00:00.000Z" },
        { id: "u_3", name: "Sam Wu", username: "sam", bio: "Interested in backend and databases.", joinedAt: "2026-03-10T00:00:00.000Z" },
      ]);
    }

    if (!routes) {
      writeStore(STORAGE_KEYS.routes, [
        {
          id: "r_1",
          authorId: "u_2",
          title: "First date in Perth (easy + cozy)",
          theme: "first date",
          description: "Coffee start -> riverside walk -> sunset view -> dessert finish.",
          tags: ["date", "cafe", "sunset"],
          isPublic: true,
          likes: 24,
          rating: 4.6,
          createdAt: "2026-03-22T09:20:00.000Z",
          locations: [
            { order: 1, time: "10:30", name: "Cafe stop", desc: "Easy chat to set the vibe.", parking: "<500m" },
            { order: 2, time: "12:00", name: "Riverside walk", desc: "Slow walk by the river and take photos.", parking: "<1km" },
            { order: 3, time: "18:10", name: "Sunset lookout", desc: "Arrive 10 minutes early for golden hour.", parking: "<500m" },
          ],
        },
        {
          id: "r_2",
          authorId: "u_1",
          title: "Picnic day: park + cheap eats",
          theme: "picnic",
          description: "Snacks pickup -> picnic -> light activity.",
          tags: ["cheap", "picnic", "active"],
          isPublic: true,
          likes: 17,
          rating: 4.2,
          createdAt: "2026-03-23T14:05:00.000Z",
          locations: [
            { order: 1, time: "11:00", name: "Groceries", desc: "Buy drinks and snacks.", parking: "<500m" },
            { order: 2, time: "12:00", name: "Big park", desc: "Bring a picnic mat and find shade.", parking: "<1km" },
          ],
        },
        {
          id: "r_3",
          authorId: "u_3",
          title: "Hidden gems: quiet spots + views",
          theme: "hidden gems",
          description: "Less crowded spots with great views.",
          tags: ["hidden", "sunset"],
          isPublic: true,
          likes: 31,
          rating: 4.8,
          createdAt: "2026-03-24T08:40:00.000Z",
          locations: [
            { order: 1, time: "15:30", name: "Quiet viewpoint", desc: "Can be windy, bring a jacket.", parking: "<500m" },
            { order: 2, time: "17:45", name: "Small cafe", desc: "Warm drink to end the day.", parking: "<1km" },
          ],
        },
      ]);
    }

    if (!saved) writeStore(STORAGE_KEYS.saved, ["r_1"]);

    if (!locations) {
      writeStore(STORAGE_KEYS.locations, [
        { id: "l_1", name: "Cafe stop", desc: "Great coffee and quiet seats.", parking: "yes", time: "10:30" },
        { id: "l_2", name: "Riverside walk", desc: "Easy walking trail with views.", parking: "unknown", time: "12:00" },
        { id: "l_3", name: "Sunset lookout", desc: "Best golden-hour city view.", parking: "no", time: "18:00" },
      ]);
    }
  }

  function getSession() {
    return readStore(STORAGE_KEYS.session, null);
  }

  function setSession(session) {
    writeStore(STORAGE_KEYS.session, session);
  }

  function clearSession() {
    global.localStorage.removeItem(STORAGE_KEYS.session);
  }

  function requireAuthOrRedirect() {
    const session = getSession();
    if (!session) global.location.href = "../pages/login.html";
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function initials(name) {
    return String(name)
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  }

  function showToast(message, tone = "info") {
    const $toast = $("#toast");
    if ($toast.length === 0) return;
    const color = tone === "success" ? "bg-emerald-600" : tone === "error" ? "bg-rose-600" : "bg-slate-900";
    $toast.removeClass("bg-emerald-600 bg-rose-600 bg-slate-900").addClass(color).find("[data-toast-text]").text(message);
    $toast.addClass("is-visible");
    global.setTimeout(() => $toast.removeClass("is-visible"), 2200);
  }

  // Shared header behavior for authenticated pages.
  function mountNav() {
    const session = getSession();
    if (!session) return;
    $("[data-session-name]").text(session.name);
    $("[data-session-username]").text("@" + session.username);
    $("[data-session-initials]").text(initials(session.name));
    $("[data-action='logout']").on("click", (e) => {
      e.preventDefault();
      clearSession();
      global.location.href = "../pages/login.html";
    });
  }

  function getQueryParam(name) {
    const url = new URL(global.location.href);
    return url.searchParams.get(name);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTheme(theme) {
    const t = String(theme || "").trim().toLowerCase();
    if (t.includes("date")) return "date";
    if (t.includes("picnic")) return "picnic";
    if (t.includes("active")) return "active";
    if (t.includes("hidden")) return "hidden";
    return t;
  }

  function topTheme(routes) {
    const counts = {};
    for (const r of routes) {
      const k = String(r.theme || "").trim();
      if (!k) continue;
      counts[k] = (counts[k] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries[0]?.[0] || "";
  }

  function themeVisual(themeKey) {
    if (themeKey === "date") return { thumbBg: "#fce7f3", thumbBorder: "#f9a8d4", thumbText: "#9d174d", emoji: "🌙" };
    if (themeKey === "picnic") return { thumbBg: "#fef3c7", thumbBorder: "#fcd34d", thumbText: "#92400e", emoji: "☕" };
    if (themeKey === "active") return { thumbBg: "#dcfce7", thumbBorder: "#86efac", thumbText: "#14532d", emoji: "🎒" };
    return { thumbBg: "#ede9fe", thumbBorder: "#c4b5fd", thumbText: "#4c1d95", emoji: "🎨" };
  }

  function routeBadge(route) {
    const now = Date.now();
    const created = new Date(route.createdAt).getTime();
    const isNew = Number.isFinite(created) && now - created < 1000 * 60 * 60 * 24 * 4;
    if (isNew) return { text: "🆕 new", bg: "#dcfce7", color: "#14532d" };
    if ((route.likes || 0) >= 25) return { text: "🔥 hot", bg: "#fef3c7", color: "#92400e" };
    return { text: "⭐ staff pick", bg: "#ede9fe", color: "#4c1d95" };
  }

  function tagWithEmoji(tag) {
    const t = String(tag || "").toLowerCase();
    if (t.includes("cafe") || t.includes("coffee")) return `☕ ${t}`;
    if (t.includes("sunset")) return `🌇 ${t}`;
    if (t.includes("beach")) return `🌊 ${t}`;
    if (t.includes("date")) return `🌙 ${t}`;
    if (t.includes("cheap") || t.includes("budget")) return `💸 ${t}`;
    return `✨ ${t}`;
  }

  function userAvatarTone(user) {
    const key = String(user?.username || "anon");
    const options = [
      { bg: "#fef3c7", text: "#92400e" },
      { bg: "#fce7f3", text: "#9d174d" },
      { bg: "#dcfce7", text: "#14532d" },
      { bg: "#ede9fe", text: "#4c1d95" },
    ];
    let sum = 0;
    for (const c of key) sum += c.charCodeAt(0);
    return options[sum % options.length];
  }

  function estimateHours(route) {
    const stops = Number(route.locations?.length || 0);
    return (Math.max(stops, 1) * 0.7 + 0.7).toFixed(1);
  }

  function routePhoto(route) {
    if (route?.photoUrl) return String(route.photoUrl);
    const byId = {
      r_1: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
      r_2: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
      r_3: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    };
    return byId[route?.id] || "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80";
  }

  // Shared interaction used by any page rendering route cards.
  function bindRouteLikeInteractions() {
    $("body")
      .off("click.routeLike")
      .on("click.routeLike", ".routeLikeBtn", function onLike(e) {
        e.preventDefault();
        e.stopPropagation();
        const routeId = String($(this).attr("data-route-id") || "");
        if (!routeId) return;

        const routes = readStore(STORAGE_KEYS.routes, []);
        const likedIds = new Set(readStore("mv_liked_route_ids", []));
        const route = routes.find((r) => r.id === routeId);
        if (!route) return;

        let nextLiked = false;
        if (likedIds.has(routeId)) {
          likedIds.delete(routeId);
          route.likes = Math.max(0, Number(route.likes || 0) - 1);
        } else {
          likedIds.add(routeId);
          route.likes = Number(route.likes || 0) + 1;
          nextLiked = true;
        }

        writeStore(STORAGE_KEYS.routes, routes);
        writeStore("mv_liked_route_ids", Array.from(likedIds));
        const $btn = $(this);
        $btn.toggleClass("is-liked", nextLiked);
        $btn.find("[data-like-count]").text(route.likes);
      });
  }

  // Shared route card renderer for dashboard/explore/profile pages.
  function routeCardHtml(route, users, savedIds, options = {}) {
    const author = users.find((u) => u.id === route.authorId);
    const savedSet = new Set(savedIds || []);
    const saved = savedSet.has(route.id);
    const likedIds = new Set(readStore("mv_liked_route_ids", []));
    const isLiked = likedIds.has(route.id);
    const themeKey = normalizeTheme(route.theme);
    const visual = themeVisual(themeKey);
    const badge = routeBadge(route);
    const avatarTone = userAvatarTone(author);
    const stops = Number(route.locations?.length || 0);
    const showPhotoCover = Boolean(options.showPhotoCover);
    const tags = (route.tags || []).slice(0, 3);
    const tagHtml = tags
      .map((t) => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(tagWithEmoji(t))}</span>`)
      .join("");

    return `
      <article class="route-card p-3">
        <a href="../pages/route.html?r=${encodeURIComponent(route.id)}" class="block">
          ${
            showPhotoCover
              ? `<div class="route-thumb relative overflow-hidden border border-slate-200 bg-slate-100">
                   <img src="${escapeHtml(routePhoto(route))}" alt="${escapeHtml(route.title)} cover photo" class="h-full w-full object-cover" loading="lazy" />
                   <div class="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-medium" style="background:${badge.bg};color:${badge.color};">${badge.text}</div>
                 </div>`
              : `<div class="route-thumb relative flex items-center justify-center" style="background:${visual.thumbBg};border-color:${visual.thumbBorder};color:${visual.thumbText};">
                   <div class="text-5xl leading-none">${visual.emoji}</div>
                   <div class="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-medium" style="background:${badge.bg};color:${badge.color};">${badge.text}</div>
                 </div>`
          }
          <div class="mt-3">
            <div class="text-[13px] font-semibold text-slate-900">${escapeHtml(route.title)}</div>
            <div class="mt-1 text-xs text-slate-500">📍 ${stops} stops · ⏱ ${estimateHours(route)} hrs</div>
            <div class="mt-3 flex flex-wrap gap-2">${tagHtml}</div>
          </div>
        </a>
        <div class="mt-3 flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <div class="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-medium" style="background:${avatarTone.bg};color:${avatarTone.text};">
              ${escapeHtml(initials(author ? author.name : "Unknown"))}
            </div>
            <div class="truncate text-xs text-slate-500">${escapeHtml(author ? author.name : "Unknown")}</div>
            <div class="rounded-full px-2 py-0.5 text-[10px] font-medium ${saved ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}">${saved ? "saved" : "open"}</div>
          </div>
          <button type="button" data-route-id="${escapeHtml(route.id)}" class="routeLikeBtn route-like-btn ${isLiked ? "is-liked" : ""} inline-flex items-center gap-1 px-2 py-1 text-xs font-medium">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M12 21s-6.716-4.237-9.192-8.216C.605 9.246 2.08 4.5 6.237 4.5c2.18 0 3.54 1.104 4.356 2.43.816-1.326 2.176-2.43 4.356-2.43 4.157 0 5.632 4.746 3.429 8.284C18.716 16.763 12 21 12 21z"></path>
            </svg>
            <span data-like-count>${escapeHtml(route.likes || 0)}</span>
          </button>
        </div>
      </article>
    `;
  }

  // Shared profile management card for "My Routes" panel.
  function routeManageCardHtml(route, users, savedIds) {
    const author = users.find((u) => u.id === route.authorId);
    const savedSet = new Set(savedIds || []);
    const saved = savedSet.has(route.id);
    const tags = (route.tags || []).slice(0, 3);
    const tagHtml = tags
      .map((t) => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">#${escapeHtml(t)}</span>`)
      .join("");

    return `
      <div class="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
        <a href="../pages/route.html?r=${encodeURIComponent(route.id)}" class="block">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-slate-600">${escapeHtml(route.theme)} · ★ ${escapeHtml(route.rating)}</div>
              <div class="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 hover:text-sky-800">${escapeHtml(route.title)}</div>
              <div class="mt-2 text-xs text-slate-600">by ${escapeHtml(author ? author.name : "Unknown")} · ${escapeHtml(formatDate(route.createdAt))}</div>
            </div>
            <div class="rounded-xl ${saved ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"} px-3 py-2 text-xs font-semibold">${saved ? "Saved" : "Save"}</div>
          </div>
          <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">${escapeHtml(route.description)}</p>
          <div class="mt-4 flex flex-wrap gap-2">${tagHtml}</div>
          <div class="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>❤ ${escapeHtml(route.likes || 0)}</span>
            <span>${escapeHtml(route.locations?.length || 0)} stops</span>
          </div>
        </a>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <a href="../pages/create-route.html?r=${encodeURIComponent(route.id)}&mode=edit" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50">Edit</a>
          <button data-route-id="${escapeHtml(route.id)}" class="btnDeleteMyRoute rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700" type="button">Delete</button>
        </div>
      </div>
    `;
  }

  function emptyCard(text) {
    return `<div class="rounded-2xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-700 shadow-sm backdrop-blur">${escapeHtml(text)}</div>`;
  }

  function updateRouteButtons(route, savedSet) {
    const isSaved = savedSet.has(route.id);
    $("#btnSave").text(isSaved ? "🔖 Saved" : "🔖 Save");
  }

  global.AppCore = {
    STORAGE_KEYS,
    nowIso,
    readStore,
    writeStore,
    seedIfEmpty,
    getSession,
    setSession,
    clearSession,
    requireAuthOrRedirect,
    formatDate,
    initials,
    showToast,
    mountNav,
    getQueryParam,
    escapeHtml,
    normalizeTheme,
    topTheme,
    routeCardHtml,
    routeManageCardHtml,
    emptyCard,
    updateRouteButtons,
    bindRouteLikeInteractions,
  };

  $(document).ready(() => {
    bindRouteLikeInteractions();
  });
})(window);
