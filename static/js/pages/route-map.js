/* ============================================================
   MyVibe — Route detail map (Leaflet)
   ------------------------------------------------------------
   - Reads window.MYVIBE_ROUTE (set inline by route.html)
   - Drops a numbered marker on each stop that has lat/lng
   - Draws a polyline connecting stops in order
   - Fits the map view to the markers' bounds
   - If no stops have coordinates, shows a friendly empty state
     with a default view (centered on Bundaberg, QLD).
   ============================================================ */
(function () {
  "use strict";

  // Wait until both DOM and Leaflet are ready.
  function whenReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb, { once: true });
    } else {
      cb();
    }
  }

  function waitForLeaflet(cb, tries) {
    tries = tries || 0;
    if (typeof window.L !== "undefined") return cb();
    if (tries > 40) {
      // ~2s; give up gracefully.
      console.warn("[route-map] Leaflet failed to load.");
      return;
    }
    setTimeout(function () { waitForLeaflet(cb, tries + 1); }, 50);
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isValidCoord(lat, lng) {
    if (lat == null || lng == null) return false;
    var la = Number(lat);
    var ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
    if (la < -90 || la > 90) return false;
    if (ln < -180 || ln > 180) return false;
    return true;
  }

  function getRouteData() {
    // 1) Server-injected route JSON (numeric DB routes).
    if (window.MYVIBE_ROUTE) return window.MYVIBE_ROUTE;
    var tag = document.getElementById("myvibe-route-data");
    if (tag) {
      try { return JSON.parse(tag.textContent); }
      catch (e) { /* fall through */ }
    }

    // 2) localStorage-seeded routes (the mock r_1, r_2, r_3).
    // We mirror route.js's lookup logic so the map and the timeline always agree.
    try {
      var pathParts = window.location.pathname.split("/").filter(Boolean);
      var pathRouteId = pathParts[0] === "route" ? decodeURIComponent(pathParts[1] || "") : "";
      var queryId = new URLSearchParams(window.location.search).get("r") || "";
      var routeId = pathRouteId || queryId || "";

      var raw = window.localStorage.getItem("mv_routes");
      if (!raw) return null;
      var routes = JSON.parse(raw);
      if (!Array.isArray(routes) || routes.length === 0) return null;

      if (!routeId) return routes[0];
      // numeric IDs are DB-backed and should have come through path #1;
      // if we got here with a numeric id, just fall back to the first mock.
      if (/^\d+$/.test(String(routeId))) return routes[0];
      return routes.find(function (r) { return r.id === routeId; }) || routes[0];
    } catch (e) {
      return null;
    }
  }

  function makeNumberedIcon(L, num) {
    return L.divIcon({
      className: "",
      html: '<div class="route-map-marker">' + escapeHtml(num) + "</div>",
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -14],
    });
  }

  function init() {
    var mapEl = document.getElementById("routeMap");
    if (!mapEl) return; // not on a page with a map

    var route = getRouteData();
    var locations = (route && Array.isArray(route.locations)) ? route.locations.slice() : [];
    // Sort by stop order so the polyline draws the right path.
    locations.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    var placed = locations.filter(function (l) { return isValidCoord(l.lat, l.lng); });

    var countEl = document.getElementById("routeMapCount");
    var emptyEl = document.getElementById("routeMapEmpty");

    // Initialise the map. Center on Bundaberg, QLD as a friendly default;
    // we override the view as soon as we have real coords.
    var map = L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([-24.866, 152.349], 12); // Bundaberg

    // OpenStreetMap tiles — free, no API key required.
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    if (placed.length === 0) {
      // No coords — show empty state under the map, but keep the map usable.
      if (countEl) countEl.textContent = "0 mapped stops";
      if (emptyEl) emptyEl.classList.remove("hidden");
      // Leaflet sometimes needs a nudge when its container is hidden/animated in.
      setTimeout(function () { map.invalidateSize(); }, 100);
      return;
    }

    var RATING_EMOJI = { 1: "😡", 2: "😕", 3: "😐", 4: "🙂", 5: "😍" };

    // Drop markers + collect points for bounds + polyline.
    var latlngs = [];
    placed.forEach(function (loc, i) {
      var lat = Number(loc.lat);
      var lng = Number(loc.lng);
      var displayNum = loc.order || (i + 1);

      var marker = L.marker([lat, lng], { icon: makeNumberedIcon(L, displayNum) }).addTo(map);

      var placeLine = loc.placeName
        ? '<div class="map-popup__meta" style="color:#be185d;font-weight:700;">' + escapeHtml(loc.placeName) + "</div>"
        : "";
      var ratingLine = (loc.rating && RATING_EMOJI[loc.rating])
        ? '<div class="map-popup__meta" style="margin-top:4px;">' + RATING_EMOJI[loc.rating] + " " + escapeHtml(loc.rating) + "/5</div>"
        : "";
      var popup =
        '<div class="map-popup__title">' + escapeHtml(loc.name || "Stop " + displayNum) + "</div>" +
        placeLine +
        '<div class="map-popup__meta">' +
        (loc.time ? escapeHtml(loc.time) + " · " : "") +
        "Stop " + escapeHtml(displayNum) +
        "</div>" +
        ratingLine;
      marker.bindPopup(popup);

      latlngs.push([lat, lng]);
    });

    // Polyline through stops (only if 2+ points).
    if (latlngs.length >= 2) {
      L.polyline(latlngs, {
        color: "#ec4899",
        weight: 3,
        opacity: 0.75,
        dashArray: "6 8",
        lineCap: "round",
      }).addTo(map);
    }

    // Fit the view to the markers, with a little padding so the glass card edges aren't cramped.
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 14);
    } else {
      map.fitBounds(latlngs, { padding: [32, 32], maxZoom: 15 });
    }

    if (countEl) {
      var total = locations.length;
      var mapped = placed.length;
      countEl.textContent = mapped + " of " + total + " stops mapped";
    }
    if (emptyEl && placed.length < locations.length) {
      // Some stops are missing coords — soft hint, but keep the map prominent.
      emptyEl.classList.remove("hidden");
      var title = emptyEl.querySelector(".route-map-empty__title");
      var copy = emptyEl.querySelector(".route-map-empty__copy");
      if (title) title.textContent = "Some stops aren't mapped";
      if (copy) copy.textContent =
        (locations.length - placed.length) + " stop(s) are missing coordinates. Add lat/lng to plot them on the map.";
    }

    // Leaflet needs a nudge if it was created inside an animating/hidden container.
    setTimeout(function () { map.invalidateSize(); }, 200);
    // Also nudge once GSAP's reveal finishes (~700ms in app-glass.js).
    setTimeout(function () { map.invalidateSize(); }, 900);
  }

  whenReady(function () { waitForLeaflet(init); });
})();
