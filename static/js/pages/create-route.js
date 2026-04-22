/* global $, window */

// Page: create-route.html
// Features: create/edit route form, location modal CRUD, reorder, saved-location picker, preview.
(function createRoutePage() {
  const C = window.AppCore;
  if (!C) return;

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
      : [{ order: 1, time: "10:00", name: "Place name", desc: "Short description", parking: "unknown" }];
    let locModalMode = "create";
    let editingLocIndex = -1;

    function mapParkingLabel(v) {
      if (v === "yes") return "Yes";
      if (v === "no") return "No";
      return "Unknown";
    }

    function renumber() {
      locations = locations.map((l, i) => ({ ...l, order: i + 1 }));
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
        .map((loc) => `<option value="${C.escapeHtml(loc.id)}">${C.escapeHtml(loc.name)} · ${C.escapeHtml(mapParkingLabel(loc.parking))}</option>`)
        .join("");
      $("#savedLocationSelect").html(options || `<option value="">No saved locations</option>`);
    }

    function renderLocs() {
      const html = locations
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((loc, idx) => {
          return `
            <li class="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur">
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="text-sm font-semibold text-slate-900">${C.escapeHtml(loc.order)}. ${C.escapeHtml(loc.name)}</div>
                  <div class="mt-1 text-xs font-semibold text-slate-600">${C.escapeHtml(loc.time)} · Parking ${C.escapeHtml(mapParkingLabel(loc.parking))}</div>
                  <div class="mt-2 text-sm text-slate-700">${C.escapeHtml(loc.desc)}</div>
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
      const source = modeName === "edit" ? locations[idx] : { name: "", time: "", desc: "", parking: "unknown" };
      $("#locName").val(source.name || "");
      $("#locTime").val(source.time || "");
      $("#locDesc").val(source.desc || "");
      $("#locParking").val(source.parking || "unknown");
      $("#locationModal").removeClass("hidden").addClass("flex");
    }

    function closeLocModal() {
      $("#locationModal").removeClass("flex").addClass("hidden");
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

    $("#locationForm").on("submit", (e) => {
      e.preventDefault();
      const name = String($("#locName").val() || "").trim();
      const time = String($("#locTime").val() || "").trim();
      const desc = String($("#locDesc").val() || "").trim();
      const parking = String($("#locParking").val() || "unknown");
      if (!name) return C.showToast("Location name is required.", "error");
      if (!time) return C.showToast("Location time is required.", "error");

      const loc = {
        order: locModalMode === "edit" ? locations[editingLocIndex].order : locations.length + 1,
        name,
        time,
        desc: desc || "No description.",
        parking,
      };

      if (locModalMode === "edit" && editingLocIndex >= 0) locations[editingLocIndex] = loc;
      else locations.push(loc);
      renumber();
      renderLocs();
      closeLocModal();

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
    });
    $("#locList").on("click", ".btnUp", function () {
      const idx = Number($(this).attr("data-up"));
      if (idx <= 0) return;
      const tmp = locations[idx - 1];
      locations[idx - 1] = locations[idx];
      locations[idx] = tmp;
      renumber();
      renderLocs();
    });
    $("#locList").on("click", ".btnDown", function () {
      const idx = Number($(this).attr("data-down"));
      if (idx >= locations.length - 1) return;
      const tmp = locations[idx + 1];
      locations[idx + 1] = locations[idx];
      locations[idx] = tmp;
      renumber();
      renderLocs();
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
      });
      renumber();
      renderLocs();
    });

    $("#rtTitle, #rtTheme, #rtTags, #rtDesc").on("input", renderPreview);
    $("#rtPublic").on("change", renderPreview);

    $("#routeForm").on("submit", (e) => {
      e.preventDefault();
      const title = String($("#rtTitle").val() || "").trim();
      const theme = String($("#rtTheme").val() || "").trim();
      const desc = String($("#rtDesc").val() || "").trim();
      const tagsRaw = String($("#rtTags").val() || "");
      const isPublic = Boolean($("#rtPublic").is(":checked"));

      if (!title) return C.showToast("Please enter a title.", "error");
      if (!theme) return C.showToast("Please select a theme.", "error");
      if (locations.length === 0) return C.showToast("Please add at least one location.", "error");

      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim().replaceAll("#", ""))
        .filter(Boolean)
        .slice(0, 8);

      if (isEdit) {
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

      const route = {
        id: "r_" + Math.floor(Math.random() * 1000000),
        authorId: me.id,
        title,
        theme,
        description: desc || "No description yet (mock).",
        tags,
        isPublic,
        likes: 0,
        rating: 4.0,
        createdAt: C.nowIso(),
        locations: locations.slice(),
      };

      routes.push(route);
      C.writeStore(C.STORAGE_KEYS.routes, routes);
      C.showToast("Route saved (mock).", "success");
      window.setTimeout(() => {
        window.location.href = C.routeDetailUrl(route.id);
      }, 350);
    });

    renderSavedLocationSelect();
    renderLocs();
    renderPreview();
  }

  $(document).ready(() => {
    if ($("body").attr("data-page") === "create") mountCreate();
  });
})();
