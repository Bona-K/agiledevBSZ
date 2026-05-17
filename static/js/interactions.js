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
  const MOCK_VERSION = 4;

  /** One shared cover for cards when no custom image or when the image fails to load. */
  const ROUTE_CARD_DEFAULT_COVER =
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80";

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

  function serverBootstrap() {
    return global.MYVIBE_BOOTSTRAP || {};
  }

  function appUrl(path) {
    return path.startsWith("/") ? path : `/${path}`;
  }

  /**
   * JSON fetch with session cookie. Throws Error with .status and .body on non-2xx.
   */
  async function fetchJson(path, options = {}) {
    const url = appUrl(path.replace(/^\//, ""));
    const opts = { credentials: "same-origin", ...options };
    const headers = { ...(opts.headers || {}) };
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
      opts.body = JSON.stringify(opts.body);
    }
    opts.headers = headers;
    const res = await global.fetch(url, opts);
    let data = null;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { ok: false, parseError: true, raw: text };
    }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || res.statusText || "Request failed");
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  function routeDetailUrl(routeId) {
    return appUrl(`route/${encodeURIComponent(routeId)}`);
  }

  function createRouteUrl(routeId, mode) {
    const url = new URL(appUrl("create-route"), global.location.origin);
    if (routeId) url.searchParams.set("r", routeId);
    if (mode) url.searchParams.set("mode", mode);
    return url.pathname + url.search;
  }

  function syncSessionWithServer() {
    const bootstrap = serverBootstrap();
    const username = String(bootstrap.username || "").trim().toLowerCase();
    if (!bootstrap.isAuthenticated || !username) return null;

    let users = readStore(STORAGE_KEYS.users, []);
    let user = users.find((entry) => entry.username === username);

    if (!user) {
      user = {
        id: "u_" + Math.floor(Math.random() * 1000000),
        name: username,
        username,
        bio: "No bio yet.",
        joinedAt: nowIso(),
      };
      users = users.concat(user);
      writeStore(STORAGE_KEYS.users, users);
    }

    const nextSession = {
      userId: user.id,
      username: user.username,
      name: user.name,
      createdAt: nowIso(),
    };
    writeStore(STORAGE_KEYS.session, nextSession);
    return nextSession;
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
            { order: 1, time: "10:30", name: "Cafe stop", desc: "Easy chat to set the vibe.", parking: "<500m", lat: -31.9523, lng: 115.8613 },
            { order: 2, time: "12:00", name: "Riverside walk", desc: "Slow walk by the river and take photos.", parking: "<1km", lat: -31.9587, lng: 115.8541 },
            { order: 3, time: "18:10", name: "Sunset lookout", desc: "Arrive 10 minutes early for golden hour.", parking: "<500m", lat: -31.9614, lng: 115.8472 },
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
            { order: 1, time: "11:00", name: "Groceries", desc: "Buy drinks and snacks.", parking: "<500m", lat: -27.4698, lng: 153.0251 },
            { order: 2, time: "12:00", name: "Big park", desc: "Bring a picnic mat and find shade.", parking: "<1km", lat: -27.4762, lng: 153.0297 },
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
            { order: 1, time: "15:30", name: "Quiet viewpoint", desc: "Can be windy, bring a jacket.", parking: "<500m", lat: -33.8568, lng: 151.2153 },
            { order: 2, time: "17:45", name: "Small cafe", desc: "Warm drink to end the day.", parking: "<1km", lat: -33.8688, lng: 151.2093 },
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

    syncSessionWithServer();
  }

  function getSession() {
    return readStore(STORAGE_KEYS.session, null) || syncSessionWithServer();
  }

  function setSession(session) {
    writeStore(STORAGE_KEYS.session, session);
  }

  function clearSession() {
    global.localStorage.removeItem(STORAGE_KEYS.session);
  }

  function requireAuthOrRedirect() {
    const session = getSession();
    if (!session) global.location.href = appUrl("login");
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
      global.location.href = appUrl("logout");
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
    // Each theme gets a distinct gradient pair (instead of an emoji glyph).
    if (themeKey === "date")
      return { thumbBg: "#fce7f3", thumbBorder: "#f9a8d4", thumbText: "#9d174d", dot: "linear-gradient(135deg, #ec4899, #db2777)" };
    if (themeKey === "picnic")
      return { thumbBg: "#fef3c7", thumbBorder: "#fcd34d", thumbText: "#92400e", dot: "linear-gradient(135deg, #f59e0b, #d97706)" };
    if (themeKey === "active")
      return { thumbBg: "#dcfce7", thumbBorder: "#86efac", thumbText: "#14532d", dot: "linear-gradient(135deg, #22c55e, #15803d)" };
    return { thumbBg: "#ede9fe", thumbBorder: "#c4b5fd", thumbText: "#4c1d95", dot: "linear-gradient(135deg, #8b5cf6, #6d28d9)" };
  }

  function routeBadge(route) {
    const now = Date.now();
    const created = new Date(route.createdAt).getTime();
    const isNew = Number.isFinite(created) && now - created < 1000 * 60 * 60 * 24 * 4;
    if (isNew) return { text: "new", bg: "#dcfce7", color: "#14532d" };
    if ((route.likes || 0) >= 25) return { text: "hot", bg: "#fef3c7", color: "#92400e" };
    return { text: "staff pick", bg: "#ede9fe", color: "#4c1d95" };
  }

  function tagWithEmoji(tag) {
    // Legacy name kept for callers; no emoji prefix anymore — just the clean tag.
    return String(tag || "").toLowerCase();
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

  function normalizeRouteCoverUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("//")) return `${global.location.protocol}${s}`;
    if (s.startsWith("/")) return s;
    return appUrl(s.replace(/^\/*/, ""));
  }

  function routePhoto(route) {
    const custom = normalizeRouteCoverUrl(route?.photoUrl);
    if (custom) return custom;
    return ROUTE_CARD_DEFAULT_COVER;
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
    const uid = route.authorId;
    let author =
      (Array.isArray(users) ? users : []).find((u) => u.id === uid) ||
      (Array.isArray(users) ? users : []).find((u) => String(u.id) === String(uid));
    if (!author && route.authorUsername) {
      const uname = String(route.authorUsername).trim().toLowerCase();
      author = (Array.isArray(users) ? users : []).find(
        (u) => String(u.username || "").toLowerCase() === uname
      );
    }
    const authorLabel =
      (author && author.name) ||
      String(route.authorUsername || "")
        .trim()
        .replace(/^@/, "") ||
      "Unknown";
    const initialsSource = author && author.name ? author.name : authorLabel;
    const avatarTone = userAvatarTone(author || { username: authorLabel });
    const savedSet = new Set(savedIds || []);
    const saved = savedSet.has(route.id);
    const likedIds = new Set(readStore("mv_liked_route_ids", []));
    const isLiked = likedIds.has(route.id);
    const themeKey = normalizeTheme(route.theme);
    const visual = themeVisual(themeKey);
    const badge = routeBadge(route);
    const stops = Number(route.locations?.length || 0);
    const showPhotoCover = Boolean(options.showPhotoCover);
    const tags = (route.tags || []).slice(0, 3);
    const tagHtml = tags
      .map((t) => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700">${escapeHtml(tagWithEmoji(t))}</span>`)
      .join("");

    return `
      <article class="route-card p-3">
        <a href="${routeDetailUrl(route.id)}" class="block">
          ${
            showPhotoCover
              ? `<div class="route-thumb relative overflow-hidden border border-slate-200 bg-slate-100">
                   <img src="${escapeHtml(routePhoto(route))}" alt="${escapeHtml(route.title)} cover photo" class="min-h-[120px] h-full w-full object-cover" loading="lazy" data-fallback-cover="${escapeHtml(ROUTE_CARD_DEFAULT_COVER)}" onerror="this.onerror=null;this.src=this.dataset.fallbackCover" />
                   <div class="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-medium" style="background:${badge.bg};color:${badge.color};">${badge.text}</div>
                 </div>`
              : `<div class="route-thumb relative flex items-center justify-center" style="background:${visual.thumbBg};border-color:${visual.thumbBorder};color:${visual.thumbText};">
                   <div class="route-thumb__dot" style="background:${visual.dot};"></div>
                   <div class="absolute left-3 top-3 rounded-full px-2 py-1 text-[11px] font-medium" style="background:${badge.bg};color:${badge.color};">${badge.text}</div>
                 </div>`
          }
          <div class="mt-3">
            <div class="text-[13px] font-semibold text-slate-900">${escapeHtml(route.title)}</div>
            <div class="mt-1 text-xs text-slate-500">${stops} stops · ${estimateHours(route)} hrs</div>
            <div class="mt-3 flex flex-wrap gap-2">${tagHtml}</div>
          </div>
        </a>
        <div class="mt-3 flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <div class="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[10px] font-medium" style="background:${avatarTone.bg};color:${avatarTone.text};">
              ${escapeHtml(initials(initialsSource))}
            </div>
            <div class="truncate text-xs text-slate-500">${escapeHtml(authorLabel)}</div>
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
    const authorName = author
      ? author.name
      : String(route.authorUsername || "").trim() || "Unknown";
    const savedSet = new Set(savedIds || []);
    const saved = savedSet.has(route.id);
    const tags = (route.tags || []).slice(0, 3);
    const tagHtml = tags
      .map((t) => `<span class="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">#${escapeHtml(t)}</span>`)
      .join("");

    return `
      <div class="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
        <a href="${routeDetailUrl(route.id)}" class="block">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-slate-600">${escapeHtml(route.theme)} · ${escapeHtml(route.rating)}/5</div>
              <div class="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 hover:text-sky-800">${escapeHtml(route.title)}</div>
              <div class="mt-2 text-xs text-slate-600">by ${escapeHtml(authorName)} · ${escapeHtml(formatDate(route.createdAt))}</div>
            </div>
            <div class="rounded-xl ${saved ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"} px-3 py-2 text-xs font-semibold">${saved ? "Saved" : "Save"}</div>
          </div>
          <p class="mt-3 line-clamp-2 text-sm leading-6 text-slate-700">${escapeHtml(route.description)}</p>
          <div class="mt-4 flex flex-wrap gap-2">${tagHtml}</div>
          <div class="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>${escapeHtml(route.likes || 0)} likes</span>
            <span>${escapeHtml(route.locations?.length || 0)} stops</span>
          </div>
        </a>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <a href="${createRouteUrl(route.id, "edit")}" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 hover:bg-slate-50">Edit</a>
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
    // Update just the text label so we don't wipe the inline SVG icon.
    const $saveLabel = $("#btnSave span").last();
    if ($saveLabel.length) $saveLabel.text(isSaved ? "Saved" : "Save");
    else $("#btnSave").text(isSaved ? "Saved" : "Save");
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
    appUrl,
    fetchJson,
    routeDetailUrl,
    createRouteUrl,
    routeCardHtml,
    routeManageCardHtml,
    emptyCard,
    updateRouteButtons,
    bindRouteLikeInteractions,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Real-time notification poller
  //
  // Polls /api/notifications/poll every 10 seconds for any logged-in page.
  // - Shows a toast for each new unread notification (follow / message / etc).
  // - Updates the nav bell badge + nav messages badge in place.
  // - Tracks the highest notification id seen so we only toast each one once.
  // ──────────────────────────────────────────────────────────────────────────

  function startNotificationPoller() {
    const boot = global.MYVIBE_BOOTSTRAP || {};
    if (!boot.isAuthenticated) return;

    // Skip the poller on the conversation page since it has its own thread poller
    // and toasting incoming messages there would be redundant.
    const page = $("body").attr("data-page");
    if (page === "conversation") {
      // …but we still want badges updated, so do a lightweight version.
    }

    let lastSeenId = 0;

    function describe(item) {
      const name = item.sender && (item.sender.display_name || item.sender.username);
      if (!name) return "You have a new notification.";
      if (item.type === "follow")  return `${name} started following you.`;
      if (item.type === "message") return `${name} sent you a message.`;
      if (item.type === "like")    return `${name} liked your route.`;
      if (item.type === "comment") return `${name} commented on your route.`;
      return `${name}: new activity.`;
    }

    async function tick() {
      try {
        const data = await fetchJson(
          `api/notifications/poll?since_id=${lastSeenId}`
        );
        if (!data || !data.ok) return;

        // Update badges
        const setBadge = (id, count, lowColorClass) => {
          const $b = $("#" + id);
          if (!$b.length) return;
          if (!count || count === 0) {
            $b.addClass("hidden").text("");
          } else {
            $b.removeClass("hidden").text(count < 10 ? String(count) : "9+");
          }
        };
        setBadge("navNotifBadge", data.unread_notif_count);
        setBadge("navMsgBadge",   data.unread_msg_count);

        // Toast new ones (skip toasts on the conversation page to avoid double-noise)
        if (page !== "conversation" && Array.isArray(data.new_notifications)) {
          for (const item of data.new_notifications) {
            if (item.id > lastSeenId) lastSeenId = item.id;
            const tone = item.type === "message" ? "info" : "success";
            showToast(describe(item), tone);
          }
        } else if (Array.isArray(data.new_notifications)) {
          // Still advance lastSeenId so we don't re-toast next page load.
          for (const item of data.new_notifications) {
            if (item.id > lastSeenId) lastSeenId = item.id;
          }
        }
      } catch (err) {
        // Silent — retry next tick.
      }
    }

    // First tick after 2s so the page settles, then every 10s.
    global.setTimeout(tick, 2000);
    global.setInterval(tick, 10000);
  }

  $(document).ready(() => {
    bindRouteLikeInteractions();
    startNotificationPoller();
  });
})(window);
