/* global $, window */

// Page: route.html
// Features: route detail rendering, like/save/share actions, owner edit/delete controls.
(function routePage() {
  const C = window.AppCore;
  if (!C) return;
  const COMMENTS_KEY = "mv_route_comments_v1";
  const CREATE_DRAFT_KEY = "mv_create_route_draft_v1";

  function commentsStore() {
    const store = C.readStore(COMMENTS_KEY, {});
    return store && typeof store === "object" ? store : {};
  }

  function writeCommentsStore(store) {
    C.writeStore(COMMENTS_KEY, store);
  }

  function routeComments(routeId) {
    const key = String(routeId || "");
    const store = commentsStore();
    const list = store[key];
    return Array.isArray(list) ? list : [];
  }

  function saveRouteComments(routeId, comments) {
    const key = String(routeId || "");
    const store = commentsStore();
    store[key] = comments;
    writeCommentsStore(store);
  }

  function normalizeCommentRow(c) {
    if (!c || typeof c !== "object") return null;
    const text = String(c.text ?? "").trim();
    if (!text) return null;
    const author = String(c.author ?? "Unknown").trim() || "Unknown";
    const createdAt = c.createdAt || C.nowIso();
    return { author, text, createdAt };
  }

  function timeAgoLabel(iso) {
    const ts = new Date(iso).getTime();
    if (!Number.isFinite(ts)) return "just now";
    const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60000));
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  }

  function renderCommentsList(list) {
    const rows = (Array.isArray(list) ? list : []).map(normalizeCommentRow).filter(Boolean);
    rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    if (!rows.length) {
      $("#commentList").html(
        `<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">No comments yet. Be the first to comment.</div>`
      );
      return;
    }
    $("#commentList").html(
      rows
        .map(
          (c) => `
        <div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <div class="text-xs font-semibold text-slate-600">${C.escapeHtml(c.author)} · ${C.escapeHtml(timeAgoLabel(c.createdAt))}</div>
          <div class="mt-2">${C.escapeHtml(c.text)}</div>
        </div>
      `
        )
        .join("")
    );
  }

  async function refreshRouteComments(routeId, numericId, boot) {
    if (numericId && boot.isAuthenticated) {
      try {
        const data = await C.fetchJson(`api/routes/${encodeURIComponent(routeId)}/comments`);
        renderCommentsList(data.comments || []);
      } catch (err) {
        if (err.status === 404) {
          renderCommentsList([]);
          return;
        }
        renderCommentsList([]);
        C.showToast(err.body?.error || err.message || "Could not load comments.", "error");
      }
      return;
    }
    const local = routeComments(routeId)
      .map((c) => ({
        author: c.author,
        text: c.text,
        createdAt: c.createdAt,
      }))
      .filter((c) => c.text);
    renderCommentsList(local);
  }

  function formatRatingLabel(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    if (!Number.isFinite(n)) return "—";
    return String(n);
  }

  function updateLikeButton(route) {
    const count = Number(route.likes || 0);
    const liked = Boolean(route.userLiked);
    const $btn = $("#btnLike");
    $btn.toggleClass("border-rose-300 bg-rose-50 text-rose-700", liked);
    $btn.text(liked ? `❤ Liked (${count})` : `❤ Like (${count})`);
  }

  function updateCompletedButton(route) {
    const done = Boolean(route.userCompleted);
    const $btn = $("#btnCompleted");
    $btn.text(done ? "Mark as incomplete" : "Mark as completed");
    $btn.toggleClass("border-emerald-300 bg-emerald-50 text-emerald-900", done);
  }

  function renderSimilarRoutes(route, routes) {
    const currentTags = new Set((route.tags || []).map((t) => String(t || "").toLowerCase()));
    const currentTheme = String(route.theme || "").toLowerCase();
    const similar = routes
      .filter((r) => String(r.id) !== String(route.id))
      .map((r) => {
        const rTags = (r.tags || []).map((t) => String(t || "").toLowerCase());
        const overlap = rTags.filter((t) => currentTags.has(t)).length;
        let score = 0;
        if (String(r.theme || "").toLowerCase() === currentTheme && currentTheme) score += 2;
        score += overlap;
        return { route: r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.route);

    if (!similar.length) {
      $("#similarRoutes").html(
        `<div class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">No similar routes available yet.</div>`
      );
      return;
    }
    $("#similarRoutes").html(
      similar
        .map(
          (r) => `
        <a href="${C.routeDetailUrl(r.id)}" class="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm hover:bg-slate-50">
          <div class="text-xs font-semibold text-slate-600">${C.escapeHtml(r.theme || "—")}</div>
          <div class="mt-1 font-semibold text-slate-900">${C.escapeHtml(r.title || "Untitled route")}</div>
          <div class="mt-2 text-slate-600">${C.escapeHtml((r.tags || []).slice(0, 3).map((t) => `#${t}`).join(" "))}</div>
        </a>
      `
        )
        .join("")
    );
  }

  async function mountRoute() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const routes = C.readStore(C.STORAGE_KEYS.routes, []);
    let saved = C.readStore(C.STORAGE_KEYS.saved, []);
    const session = C.getSession();
    const boot = window.MYVIBE_BOOTSTRAP || {};

    if (boot.isAuthenticated && C.fetchSavedRouteIds) {
      saved = await C.fetchSavedRouteIds();
    }

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    const pathRouteId = pathParts[0] === "route" ? decodeURIComponent(pathParts[1] || "") : "";
    const routeId = pathRouteId || C.getQueryParam("r") || routes[0]?.id;
    const numericId = /^\d+$/.test(String(routeId || ""));

    let route = null;
    if (numericId) {
      if (window.MYVIBE_ROUTE) {
        route = { ...window.MYVIBE_ROUTE, id: String(window.MYVIBE_ROUTE.id) };
      } else {
        try {
          const data = await C.fetchJson(`api/routes/${encodeURIComponent(routeId)}`);
          if (data?.ok && data.route) {
            route = { ...data.route, id: String(data.route.id) };
          }
        } catch {
          route = null;
        }
      }
    } else {
      route = routes.find((r) => r.id === routeId) || routes[0];
    }

    if (!route) {
      C.showToast("Route not found.", "error");
      window.location.href = C.appUrl("dashboard");
      return;
    }

    const author = users.find((u) => u.id === route.authorId);
    const authorUsername =
      String(route.authorUsername || "").trim() ||
      (author ? String(author.username || "").trim() : "");
    const authorLabel =
      String(route.authorDisplayName || "").trim() ||
      (author ? String(author.name || author.username || "").trim() : "") ||
      authorUsername ||
      "Unknown";
    $("#routeTitle").text(route.title);
    $("#routeTheme").text(route.theme);
    $("#routeAuthor").text(authorLabel);
    if (authorUsername) {
      $("#routeAuthorLink").attr(
        "href",
        C.appUrl(`user/${encodeURIComponent(authorUsername.toLowerCase())}`)
      );
    } else {
      $("#routeAuthorLink").attr("href", "#");
    }
    const createdLabel = route.createdAt ? C.formatDate(route.createdAt) : "—";
    $("#routeMeta").text(
      `${createdLabel} · ${route.locations.length} stops · ★ ${formatRatingLabel(route.rating)}`
    );
    updateLikeButton(route);
    updateCompletedButton(route);
    if (route.userRating != null && route.userRating !== "") {
      $("#ratingSelect").val(String(route.userRating));
    }
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
        const photo = loc.photoUrl
          ? `<div class="mt-3"><img src="${C.escapeHtml(loc.photoUrl)}" alt="" class="max-h-48 w-full max-w-md rounded-xl border border-slate-200 object-cover" loading="lazy" /></div>`
          : "";
        return `
          <li class="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-900">${C.escapeHtml(loc.order)}. ${C.escapeHtml(loc.name)}</div>
                <div class="mt-1 text-xs font-semibold text-slate-600">${C.escapeHtml(loc.time)} · Parking ${C.escapeHtml(loc.parking || "—")}</div>
                <p class="mt-3 text-sm leading-6 text-slate-700">${C.escapeHtml(loc.desc || "")}</p>
                ${photo}
              </div>
              <div class="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Stop</div>
            </div>
          </li>
        `;
      })
      .join("");
    $("#routeLocations").html(locHtml);
    renderSimilarRoutes(route, routes);
    await refreshRouteComments(route.id, numericId, boot);

    const savedSet = new Set((saved || []).map(String));
    C.updateRouteButtons(route, savedSet);
    let isOwner = false;
    if (numericId && boot.userId != null) {
      isOwner = Number(route.authorId) === Number(boot.userId);
    } else {
      isOwner = Boolean(session && session.userId === route.authorId);
    }
    if (isOwner) {
      $("#ownerActions").removeClass("hidden");
      $("#btnEditRoute").attr("href", C.createRouteUrl(route.id, "edit"));
    }

    $("#btnLike").on("click", async () => {
      const routeKey = String(route.id);
      if (numericId && boot.isAuthenticated) {
        try {
          const data = await C.fetchJson(`api/routes/${encodeURIComponent(routeKey)}/like`, {
            method: "POST",
          });
          route.likes = Number(data.likes || 0);
          route.userLiked = Boolean(data.userLiked ?? data.liked);
          updateLikeButton(route);
          C.showToast(route.userLiked ? "Route liked." : "Like removed.", "success");
        } catch (err) {
          if (err.status === 401) C.showToast("Please sign in first.", "error");
          else C.showToast(err.body?.error || err.message || "Could not update like.", "error");
        }
        return;
      }
      route.likes = (route.likes || 0) + 1;
      C.writeStore(C.STORAGE_KEYS.routes, routes);
      updateLikeButton(route);
      C.showToast("Liked (mock).", "success");
    });

    $("#btnSave").on("click", async () => {
      const routeKey = String(route.id);
      if (numericId && boot.isAuthenticated) {
        const wasSaved = savedSet.has(routeKey);
        try {
          if (wasSaved) {
            await C.fetchJson(`api/routes/${encodeURIComponent(routeKey)}/save`, { method: "DELETE" });
          } else {
            await C.fetchJson(`api/routes/${encodeURIComponent(routeKey)}/save`, { method: "POST" });
          }
          saved = await C.fetchSavedRouteIds();
          const nextSet = new Set(saved.map(String));
          savedSet.clear();
          nextSet.forEach((id) => savedSet.add(id));
          C.updateRouteButtons(route, savedSet);
          C.showToast(wasSaved ? "Removed from saved." : "Route saved.", "success");
        } catch (err) {
          C.showToast(err.body?.error || err.message || "Could not update saved routes.", "error");
        }
        return;
      }
      const set = new Set((C.readStore(C.STORAGE_KEYS.saved, []) || []).map(String));
      if (set.has(routeKey)) set.delete(routeKey);
      else set.add(routeKey);
      const arr = Array.from(set);
      C.writeStore(C.STORAGE_KEYS.saved, arr);
      savedSet.clear();
      arr.forEach((id) => savedSet.add(id));
      C.updateRouteButtons(route, savedSet);
      C.showToast(savedSet.has(routeKey) ? "Saved (mock)." : "Removed from saved (mock).", "success");
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

    $("#btnCmt").on("click", async () => {
      const text = String($("#cmt").val() || "").trim();
      if (!text) {
        C.showToast("Please enter a comment.", "error");
        return;
      }
      if (numericId && boot.isAuthenticated) {
        try {
          await C.fetchJson(`api/routes/${encodeURIComponent(route.id)}/comments`, {
            method: "POST",
            body: { text },
          });
          $("#cmt").val("");
          await refreshRouteComments(route.id, numericId, boot);
          C.showToast("Comment added.", "success");
        } catch (err) {
          if (err.status === 401) C.showToast("Please sign in first.", "error");
          else if (err.body?.errors?.text) C.showToast(err.body.errors.text, "error");
          else C.showToast(err.body?.error || err.message || "Could not post comment.", "error");
        }
        return;
      }
      const next = routeComments(route.id);
      next.push({
        author: boot.username || session?.username || "you",
        text,
        createdAt: C.nowIso(),
      });
      saveRouteComments(route.id, next);
      $("#cmt").val("");
      await refreshRouteComments(route.id, numericId, boot);
      C.showToast("Comment added.", "success");
    });

    $("#btnDuplicate").on("click", async () => {
      const me = session || C.getSession();
      if (!me) {
        C.showToast("Please sign in first.", "error");
        return;
      }

      const orderedLocations = (route.locations || [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((loc, i) => ({
          order: i + 1,
          name: String(loc.name || "").trim(),
          time: String(loc.time || "").trim(),
          desc: String(loc.desc || loc.description || "").trim(),
          parking: String(loc.parking || "unknown").trim() || "unknown",
          photoUrl: loc.photoUrl || null,
        }));

      const duplicateDraft = {
        title: String(route.title || "").trim(),
        theme: String(route.theme || "").trim().toLowerCase(),
        tags: (route.tags || []).map((t) => String(t || "").trim().toLowerCase()).join(", "),
        description: String(route.description || "").trim(),
        isPublic: Boolean(route.isPublic),
        locations: orderedLocations,
        savedAt: C.nowIso(),
      };

      try {
        window.localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(duplicateDraft));
      } catch {
        C.showToast("Could not prepare duplicate draft.", "error");
        return;
      }

      C.showToast("Duplicate loaded. Opening create route…", "success");
      window.setTimeout(() => {
        window.location.href = C.appUrl("create-route");
      }, 350);
    });

    $("#btnCompleted").on("click", async () => {
      if (numericId && boot.isAuthenticated) {
        const wasDone = Boolean(route.userCompleted);
        try {
          if (wasDone) {
            await C.fetchJson(`api/routes/${encodeURIComponent(route.id)}/complete`, {
              method: "DELETE",
            });
            route.userCompleted = false;
            C.showToast("Marked as incomplete.", "success");
          } else {
            await C.fetchJson(`api/routes/${encodeURIComponent(route.id)}/complete`, {
              method: "POST",
            });
            route.userCompleted = true;
            C.showToast("Marked as completed.", "success");
          }
          updateCompletedButton(route);
        } catch (err) {
          if (err.status === 401) C.showToast("Please sign in first.", "error");
          else C.showToast(err.body?.error || err.message || "Could not update completion.", "error");
        }
        return;
      }
      route.userCompleted = !Boolean(route.userCompleted);
      updateCompletedButton(route);
      C.showToast(route.userCompleted ? "Marked as completed." : "Marked as incomplete.", "success");
    });
    $("#btnSubmitRating").on("click", async () => {
      const rating = String($("#ratingSelect").val() || "").trim();
      if (!rating) {
        C.showToast("Please choose a rating from 1 to 5.", "error");
        return;
      }
      const score = Number(rating);
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        C.showToast("Rating must be between 1 and 5.", "error");
        return;
      }
      if (numericId && boot.isAuthenticated) {
        try {
          const data = await C.fetchJson(`api/routes/${encodeURIComponent(String(route.id))}/rating`, {
            method: "POST",
            body: { rating: score },
          });
          route.rating = data.rating;
          route.userRating = data.userRating;
          const label = route.createdAt ? C.formatDate(route.createdAt) : "—";
          $("#routeMeta").text(
            `${label} · ${route.locations.length} stops · ★ ${formatRatingLabel(route.rating)}`
          );
          C.showToast("Rating saved.", "success");
        } catch (err) {
          if (err.status === 401) C.showToast("Please sign in first.", "error");
          else if (err.body?.errors?.rating) C.showToast(err.body.errors.rating, "error");
          else C.showToast(err.body?.error || err.message || "Could not save rating.", "error");
        }
        return;
      }
      C.showToast(`Rating submitted: ${rating}/5.`, "success");
    });
    $("#btnDeleteRoute").on("click", async () => {
      if (!isOwner) return;
      if (!window.confirm("Delete this route? This action cannot be undone.")) return;
      if (numericId) {
        try {
          await C.fetchJson(`api/routes/${encodeURIComponent(String(route.id))}`, { method: "DELETE" });
        } catch (err) {
          if (err.status === 403) C.showToast("You can only delete your own routes.", "error");
          else C.showToast(err.body?.error || err.message || "Could not delete route.", "error");
          return;
        }
        const nextSaved = (saved || []).filter((id) => String(id) !== String(route.id));
        C.writeStore(C.STORAGE_KEYS.saved, nextSaved);
        C.showToast("Route deleted.", "success");
        window.setTimeout(() => {
          window.location.href = C.appUrl("dashboard");
        }, 350);
        return;
      }
      const nextRoutes = routes.filter((r) => r.id !== route.id);
      C.writeStore(C.STORAGE_KEYS.routes, nextRoutes);
      const nextSaved = (saved || []).filter((id) => id !== route.id);
      C.writeStore(C.STORAGE_KEYS.saved, nextSaved);
      C.showToast("Route deleted (mock).", "success");
      window.setTimeout(() => {
        window.location.href = C.appUrl("dashboard");
      }, 350);
    });
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "route") {
      mountRoute();
    }
  });
})();