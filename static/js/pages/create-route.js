/* global $, window */

// Page: create-route.html
// Create route: multi-stop form, server persistence, draft recovery, per-stop photo upload, inline validation.
(function createRoutePage() {
  const C = window.AppCore;
  if (!C) return;

  const DRAFT_KEY = "mv_create_route_draft_v1";
  const DRAFT_DEBOUNCE_MS = 1200;

  function mountCreate() {
    C.requireAuthOrRedirect();
    C.seedIfEmpty();
    C.mountNav();

    const session = C.getSession();
    const users = C.readStore(C.STORAGE_KEYS.users, []);
    const me = users.find((u) => u.id === session.userId) || users[0];

    const routes = C.readStore(C.STORAGE_KEYS.routes, []);
    const savedLocations = C.readStore(C.STORAGE_KEYS.locations, []);
    const editRouteId = C.getQueryParam("r");
    const mode = C.getQueryParam("mode");
    const editingRoute = routes.find((r) => r.id === editRouteId);
    const isEdit = mode === "edit" && editingRoute && editingRoute.authorId === me.id;

    let locations = isEdit
      ? (editingRoute.locations || []).slice().sort((a, b) => a.order - b.order)
      : [{ order: 1, time: "10:00", name: "Place name", desc: "Short description", parking: "unknown", photoUrl: null }];
    let locModalMode = "create";
    let editingLocIndex = -1;
    let locPendingPhotoUrl = null;
    let draftTimer = null;
    let isSubmitting = false;

    function mapParkingLabel(v) {
      if (v === "yes") return "Yes";
      if (v === "no") return "No";
      return "Unknown";
    }

    function renumber() {
      locations = locations.map((l, i) => ({ ...l, order: i + 1 }));
    }

    function clearRouteFieldErrors() {
      $("#routeFormAlert").addClass("hidden").text("");
      $("#errRtTitle,#errRtTheme,#errRtTags,#errRtLocations,#errLocList").addClass("hidden").text("");
      $("#rtTitle,#rtTheme,#rtTags,#rtDesc").removeClass("border-rose-300 ring-rose-200");
    }

    function clearLocModalErrors() {
      $("#errLocName,#errLocTime,#errLocPhoto").addClass("hidden").text("");
      $("#locName,#locTime").removeClass("border-rose-300");
    }

    function showRouteAlert(msg) {
      $("#routeFormAlert").removeClass("hidden").text(msg);
    }

    function applyServerErrors(errors) {
      clearRouteFieldErrors();
      if (!errors || typeof errors !== "object") return;
      const locMsgs = [];
      Object.entries(errors).forEach(([key, msg]) => {
        const text = String(msg || "");
        if (key === "title") $("#errRtTitle").removeClass("hidden").text(text);
        else if (key === "theme") $("#errRtTheme").removeClass("hidden").text(text);
        else if (key === "tags") $("#errRtTags").removeClass("hidden").text(text);
        else if (key === "locations") $("#errRtLocations").removeClass("hidden").text(text);
        else if (key.startsWith("locations.")) locMsgs.push(text);
        else if (key === "author" || key === "") showRouteAlert(text);
      });
      if (locMsgs.length) {
        $("#errLocList").removeClass("hidden").text(locMsgs.join(" "));
      }
    }

    function collectDraftState() {
      return {
        title: String($("#rtTitle").val() || "").trim(),
        theme: String($("#rtTheme").val() || "").trim(),
        tags: String($("#rtTags").val() || "").trim(),
        description: String($("#rtDesc").val() || "").trim(),
        isPublic: Boolean($("#rtPublic").is(":checked")),
        locations: locations.map((l) => ({ ...l })),
        savedAt: C.nowIso(),
      };
    }

    function saveDraftNow() {
      if (isEdit) return;
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraftState()));
      } catch {
        /* quota or private mode */
      }
    }

    function scheduleDraftSave() {
      if (isEdit) return;
      if (draftTimer) window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(() => {
        draftTimer = null;
        saveDraftNow();
      }, DRAFT_DEBOUNCE_MS);
    }

    function clearDraft() {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    }

    function loadDraft() {
      if (isEdit) return null;
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }

    function restoreDraft(d) {
      if (!d || typeof d !== "object") return;
      if (typeof d.title === "string") $("#rtTitle").val(d.title);
      if (typeof d.theme === "string") $("#rtTheme").val(d.theme);
      if (typeof d.tags === "string") $("#rtTags").val(d.tags);
      if (typeof d.description === "string") $("#rtDesc").val(d.description);
      if (typeof d.isPublic === "boolean") $("#rtPublic").prop("checked", d.isPublic);
      if (Array.isArray(d.locations) && d.locations.length) {
        locations = d.locations.map((loc, i) => ({
          order: i + 1,
          name: loc.name || "",
          time: loc.time || "",
          desc: loc.desc || loc.description || "",
          parking: loc.parking || "unknown",
          photoUrl: loc.photoUrl || null,
        }));
        renumber();
      }
      C.showToast("Draft restored.", "success");
    }

    function setSubmitting(on) {
      isSubmitting = on;
      const $btn = $("#btnSubmitRoute");
      $btn.prop("disabled", on);
      $btn.text(on ? "Saving…" : "Save route");
    }

    function renderPreview() {
      const title = String($("#rtTitle").val() || "").trim() || "(untitled)";
      const theme = String($("#rtTheme").val() || "").trim() || "(no theme)";
      const desc = String($("#rtDesc").val() || "").trim() || "No description yet.";
      const tags = String($("#rtTags").val() || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5)
        .join(" ");
      const visibility = $("#rtPublic").is(":checked") ? "Public" : "Private";
      $("#routePreview").html(
        `<div class="text-xs font-semibold text-slate-600">${C.escapeHtml(theme)} · ${visibility}</div>
         <div class="mt-1 text-sm font-semibold text-slate-900">${C.escapeHtml(title)}</div>
         <div class="mt-2 text-sm text-slate-700">${C.escapeHtml(desc)}</div>
         <div class="mt-2 text-xs text-slate-600">${C.escapeHtml(tags || "No tags")} · ${locations.length} locations</div>`
      );
    }

    function renderSavedLocationSelect() {
      const options = (savedLocations || [])
        .map(
          (loc) =>
            `<option value="${C.escapeHtml(loc.id)}">${C.escapeHtml(loc.name)} · ${C.escapeHtml(mapParkingLabel(loc.parking))}</option>`
        )
        .join("");
      $("#savedLocationSelect").html(options || `<option value="">No saved locations</option>`);
    }

    function renderLocs() {
      const html = locations
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((loc, idx) => {
          const thumb = loc.photoUrl
            ? `<div class="mt-2"><img src="${C.escapeHtml(loc.photoUrl)}" alt="" class="max-h-24 rounded-lg border border-slate-200 object-cover" loading="lazy" /></div>`
            : "";
          return `
            <li class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-slate-900">${C.escapeHtml(loc.order)}. ${C.escapeHtml(loc.name)}</div>
                  <div class="mt-1 text-xs font-semibold text-slate-600">${C.escapeHtml(loc.time)} · Parking ${C.escapeHtml(mapParkingLabel(loc.parking))}</div>
                  <div class="mt-2 text-sm text-slate-700">${C.escapeHtml(loc.desc)}</div>
                  ${thumb}
                </div>
                <div class="flex flex-col gap-2">
                  <button data-edit="${idx}" class="btnEdit rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50" type="button">Edit</button>
                  <button data-up="${idx}" class="btnUp rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50" type="button">↑</button>
                  <button data-down="${idx}" class="btnDown rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50" type="button">↓</button>
                  <button data-del="${idx}" class="btnDel rounded-xl bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700" type="button">Delete</button>
                </div>
              </div>
            </li>
          `;
        })
        .join("");
      $("#locList").html(html || C.emptyCard("No locations yet. Add one from the button above."));
      renderPreview();
    }

    function openLocModal(modeName, idx) {
      locModalMode = modeName;
      editingLocIndex = typeof idx === "number" ? idx : -1;
      clearLocModalErrors();
      locPendingPhotoUrl = null;
      $("#locPhoto").val("");
      $("#locPhotoStatus").text("");
      $("#locPhotoPreviewWrap").addClass("hidden");
      $("#locPhotoPreview").attr("src", "");

      const source = modeName === "edit" ? locations[idx] : { name: "", time: "", desc: "", parking: "unknown", photoUrl: null };
      $("#locName").val(source.name || "");
      $("#locTime").val(source.time || "");
      $("#locDesc").val(source.desc || "");
      $("#locParking").val(source.parking || "unknown");
      if (source.photoUrl) {
        locPendingPhotoUrl = source.photoUrl;
        $("#locPhotoPreview").attr("src", source.photoUrl);
        $("#locPhotoPreviewWrap").removeClass("hidden");
        $("#locPhotoStatus").text("Existing photo kept unless you pick a new file.");
      }
      $("#locationModal").removeClass("hidden").addClass("flex");
    }

    function closeLocModal() {
      $("#locationModal").removeClass("flex").addClass("hidden");
    }

    async function uploadPlacePhoto(file) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(C.appUrl("api/uploads/place-photo"), {
        method: "POST",
        body: fd,
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      if (!data.url) throw new Error("No image URL returned.");
      return data.url;
    }

    function validateRouteClient() {
      clearRouteFieldErrors();
      let ok = true;
      const title = String($("#rtTitle").val() || "").trim();
      const theme = String($("#rtTheme").val() || "").trim();
      if (!title) {
        $("#errRtTitle").removeClass("hidden").text("Title is required.");
        $("#rtTitle").addClass("border-rose-300 ring-2 ring-rose-200");
        ok = false;
      }
      if (!theme) {
        $("#errRtTheme").removeClass("hidden").text("Please choose a theme.");
        $("#rtTheme").addClass("border-rose-300 ring-2 ring-rose-200");
        ok = false;
      }
      if (!locations.length) {
        $("#errRtLocations").removeClass("hidden").text("Add at least one location.");
        ok = false;
      }
      return ok;
    }

    function buildCreatePayload() {
      const title = String($("#rtTitle").val() || "").trim();
      const theme = String($("#rtTheme").val() || "").trim();
      const desc = String($("#rtDesc").val() || "").trim();
      const tagsRaw = String($("#rtTags").val() || "");
      const isPublic = Boolean($("#rtPublic").is(":checked"));
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim().replaceAll("#", ""))
        .filter(Boolean)
        .slice(0, 8);
      const ordered = locations.slice().sort((a, b) => a.order - b.order);
      return {
        title,
        description: desc,
        theme,
        tags,
        isPublic,
        locations: ordered.map((l, i) => ({
          order: i + 1,
          name: String(l.name || "").trim(),
          time: String(l.time || "").trim(),
          desc: String(l.desc || "").trim(),
          parking: String(l.parking || "unknown").trim() || "unknown",
          photoUrl: l.photoUrl || null,
        })),
      };
    }

    if (!isEdit) {
      const draft = loadDraft();
      if (draft) restoreDraft(draft);
    }

    if (isEdit) {
      $("#rtTitle").val(editingRoute.title);
      $("#rtTheme").val(editingRoute.theme);
      $("#rtTags").val((editingRoute.tags || []).join(","));
      $("#rtDesc").val(editingRoute.description);
      $("#rtPublic").prop("checked", Boolean(editingRoute.isPublic));
      $("h1").first().text("Edit route");
    }

    $("#btnAddLoc").on("click", () => openLocModal("create"));
    $("#btnCloseLocModal, #btnCancelLoc").on("click", closeLocModal);

    $("#locPhoto").on("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      $("#errLocPhoto").addClass("hidden").text("");
      if (!file) return;
      $("#locPhotoStatus").text("Uploading…");
      try {
        const url = await uploadPlacePhoto(file);
        locPendingPhotoUrl = url;
        $("#locPhotoPreview").attr("src", url);
        $("#locPhotoPreviewWrap").removeClass("hidden");
        $("#locPhotoStatus").text("Photo attached.");
      } catch (err) {
        $("#errLocPhoto").removeClass("hidden").text(err.message || "Upload failed.");
        $("#locPhotoStatus").text("");
        locPendingPhotoUrl = null;
        $("#locPhotoPreviewWrap").addClass("hidden");
      }
    });

    $("#locationForm").on("submit", (e) => {
      e.preventDefault();
      clearLocModalErrors();
      const name = String($("#locName").val() || "").trim();
      const time = String($("#locTime").val() || "").trim();
      const desc = String($("#locDesc").val() || "").trim();
      const parking = String($("#locParking").val() || "unknown");
      let modalOk = true;
      if (!name) {
        $("#errLocName").removeClass("hidden").text("Location name is required.");
        $("#locName").addClass("border-rose-300");
        modalOk = false;
      }
      if (!time) {
        $("#errLocTime").removeClass("hidden").text("Time is required.");
        $("#locTime").addClass("border-rose-300");
        modalOk = false;
      }
      if (!modalOk) return;

      const photoUrl = locPendingPhotoUrl || (locModalMode === "edit" ? locations[editingLocIndex]?.photoUrl : null) || null;

      const loc = {
        order: locModalMode === "edit" ? locations[editingLocIndex].order : locations.length + 1,
        name,
        time,
        desc: desc || "No description.",
        parking,
        photoUrl,
      };

      if (locModalMode === "edit" && editingLocIndex >= 0) locations[editingLocIndex] = loc;
      else locations.push(loc);
      renumber();
      renderLocs();
      closeLocModal();
      scheduleDraftSave();

      const exists = savedLocations.some((x) => x.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        savedLocations.push({
          id: "l_" + Math.floor(Math.random() * 1000000),
          name,
          desc: loc.desc,
          parking: loc.parking,
          time: loc.time,
        });
        C.writeStore(C.STORAGE_KEYS.locations, savedLocations);
        renderSavedLocationSelect();
      }
    });

    $("#locList").on("click", ".btnEdit", function () {
      const idx = Number($(this).attr("data-edit"));
      if (idx < 0 || idx >= locations.length) return;
      openLocModal("edit", idx);
    });
    $("#locList").on("click", ".btnDel", function () {
      const idx = Number($(this).attr("data-del"));
      if (idx < 0 || idx >= locations.length) return;
      locations.splice(idx, 1);
      renumber();
      renderLocs();
      scheduleDraftSave();
    });
    $("#locList").on("click", ".btnUp", function () {
      const idx = Number($(this).attr("data-up"));
      if (idx <= 0) return;
      const tmp = locations[idx - 1];
      locations[idx - 1] = locations[idx];
      locations[idx] = tmp;
      renumber();
      renderLocs();
      scheduleDraftSave();
    });
    $("#locList").on("click", ".btnDown", function () {
      const idx = Number($(this).attr("data-down"));
      if (idx >= locations.length - 1) return;
      const tmp = locations[idx + 1];
      locations[idx + 1] = locations[idx];
      locations[idx] = tmp;
      renumber();
      renderLocs();
      scheduleDraftSave();
    });

    $("#btnAddSavedLoc").on("click", () => {
      const id = String($("#savedLocationSelect").val() || "");
      const loc = savedLocations.find((x) => x.id === id);
      if (!loc) return C.showToast("Please select a saved location.", "error");
      locations.push({
        order: locations.length + 1,
        name: loc.name,
        time: loc.time || "12:00",
        desc: loc.desc || "Imported from saved locations.",
        parking: loc.parking || "unknown",
        photoUrl: null,
      });
      renumber();
      renderLocs();
      scheduleDraftSave();
    });

    $("#rtTitle, #rtTheme, #rtTags, #rtDesc").on("input", () => {
      renderPreview();
      scheduleDraftSave();
    });
    $("#rtPublic").on("change", () => {
      renderPreview();
      scheduleDraftSave();
    });

    $("#btnSaveDraft").on("click", () => {
      if (isEdit) return;
      saveDraftNow();
      C.showToast("Draft saved on this device.", "success");
    });

    $("#btnDiscardDraft").on("click", () => {
      if (isEdit) return;
      if (!window.confirm("Discard the saved draft on this device?")) return;
      clearDraft();
      $("#rtTitle").val("");
      $("#rtTags").val("");
      $("#rtDesc").val("");
      $("#rtTheme").prop("selectedIndex", 0);
      $("#rtPublic").prop("checked", true);
      locations = [
        { order: 1, time: "10:00", name: "Place name", desc: "Short description", parking: "unknown", photoUrl: null },
      ];
      renderLocs();
      renderPreview();
      C.showToast("Draft discarded.", "info");
    });

    $("#routeForm").on("submit", async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      const title = String($("#rtTitle").val() || "").trim();
      const theme = String($("#rtTheme").val() || "").trim();
      const desc = String($("#rtDesc").val() || "").trim();
      const tagsRaw = String($("#rtTags").val() || "");
      const isPublic = Boolean($("#rtPublic").is(":checked"));

      if (isEdit) {
        if (!title) {
          $("#errRtTitle").removeClass("hidden").text("Please enter a title.");
          return;
        }
        if (!theme) {
          $("#errRtTheme").removeClass("hidden").text("Please select a theme.");
          return;
        }
        if (locations.length === 0) {
          $("#errRtLocations").removeClass("hidden").text("Please add at least one location.");
          return;
        }
        const tags = tagsRaw
          .split(",")
          .map((t) => t.trim().replaceAll("#", ""))
          .filter(Boolean)
          .slice(0, 8);
        editingRoute.title = title;
        editingRoute.theme = theme;
        editingRoute.description = desc || "No description yet (mock).";
        editingRoute.tags = tags;
        editingRoute.isPublic = isPublic;
        editingRoute.locations = locations.slice();
        C.writeStore(C.STORAGE_KEYS.routes, routes);
        C.showToast("Route updated (mock).", "success");
        window.setTimeout(() => {
          window.location.href = C.routeDetailUrl(editingRoute.id);
        }, 350);
        return;
      }

      clearRouteFieldErrors();
      if (!validateRouteClient()) {
        C.showToast("Fix the highlighted fields.", "error");
        return;
      }

      const payload = buildCreatePayload();
      setSubmitting(true);
      try {
        const data = await C.fetchJson("api/routes", { method: "POST", body: payload });
        if (!data.ok || !data.route) throw new Error("Unexpected response.");
        clearDraft();
        C.showToast("Route saved.", "success");
        window.setTimeout(() => {
          window.location.href = C.routeDetailUrl(String(data.route.id));
        }, 400);
      } catch (err) {
        setSubmitting(false);
        const body = err.body || {};
        if (body.errors && typeof body.errors === "object") {
          applyServerErrors(body.errors);
        } else {
          showRouteAlert(err.message || "Could not save route.");
        }
        C.showToast("Save failed — check the form.", "error");
      }
    });

    renderSavedLocationSelect();
    renderLocs();
    renderPreview();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "create") mountCreate();
  });
})();
