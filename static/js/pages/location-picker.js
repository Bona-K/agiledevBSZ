/* ============================================================
   MyVibe — Location picker (autocomplete + map + rating)
   ------------------------------------------------------------
   Wires up the create-route modal:
     - Place search box uses Nominatim (OpenStreetMap) scoped to Australia
       to suggest real places as the user types.
     - A mini Leaflet map lets the user click to drop a pin manually.
     - Selecting a suggestion pans the map and drops a pin.
     - Smiley rating buttons toggle a 1-5 value.
   ------------------------------------------------------------
   Exposed on window.MYVIBE_LOC_PICKER so create-route.js can:
     - open()        prepares the picker (lazy-init map on first show)
     - close()       hides the picker UI bits
     - reset()       clears all picker state for a new "Add"
     - prefill(data) populates picker for "Edit" mode
     - readState()   returns { placeName, lat, lng, rating }
   ============================================================ */
(function (global) {
  "use strict";

  // Nominatim is free + keyless but has a 1 req/sec policy. We debounce + cache.
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
  var DEBOUNCE_MS = 350;
  var MIN_QUERY = 2;
  var SEARCH_CACHE = Object.create(null);

  // Default view = centre of Australia, friendly zoom for picking.
  var DEFAULT_CENTRE = [-25.2744, 133.7751];
  var DEFAULT_ZOOM = 4;

  var state = {
    map: null,
    marker: null,
    inputEl: null,
    suggestEl: null,
    selectedChipEl: null,
    selectedChipTextEl: null,
    placeNameEl: null,
    latEl: null,
    lngEl: null,
    ratingValueEl: null,
    ratingRoot: null,
    debounceTimer: null,
    activeRequest: 0,
    suggestActiveIdx: -1,
    suggestItems: [],
  };

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function $(id) { return document.getElementById(id); }

  function makePin(L) {
    return L.divIcon({
      className: "",
      html: '<div class="route-map-marker">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  }

  function ensureMap() {
    if (state.map) return state.map;
    if (typeof global.L === "undefined") return null;
    var el = $("locPicker");
    if (!el) return null;

    var map = L.map(el, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTRE, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Click anywhere on the map → drop pin, store coords. We try a reverse-geocode
    // for a friendly place name; if it fails the user can still type one manually.
    map.on("click", function (e) {
      setPin(e.latlng.lat, e.latlng.lng);
      reverseGeocode(e.latlng.lat, e.latlng.lng);
    });

    state.map = map;
    return map;
  }

  function setPin(lat, lng) {
    var L = global.L;
    if (!L || !state.map) return;
    if (state.marker) state.marker.setLatLng([lat, lng]);
    else state.marker = L.marker([lat, lng], { icon: makePin(L) }).addTo(state.map);
    if (state.latEl) state.latEl.value = lat.toFixed(6);
    if (state.lngEl) state.lngEl.value = lng.toFixed(6);
  }

  function setPlace(displayName, lat, lng) {
    setPin(lat, lng);
    if (state.placeNameEl) state.placeNameEl.value = displayName || "";
    if (state.inputEl) state.inputEl.value = displayName || "";
    if (state.selectedChipEl && state.selectedChipTextEl) {
      state.selectedChipTextEl.textContent = displayName || "(custom pin)";
      state.selectedChipEl.classList.remove("hidden");
      state.selectedChipEl.classList.add("flex");
    }
    if (state.map) state.map.flyTo([lat, lng], 15, { duration: 0.6 });
    hideSuggest();
  }

  function clearPlace() {
    if (state.placeNameEl) state.placeNameEl.value = "";
    if (state.latEl) state.latEl.value = "";
    if (state.lngEl) state.lngEl.value = "";
    if (state.inputEl) state.inputEl.value = "";
    if (state.marker && state.map) {
      state.map.removeLayer(state.marker);
      state.marker = null;
    }
    if (state.selectedChipEl) {
      state.selectedChipEl.classList.add("hidden");
      state.selectedChipEl.classList.remove("flex");
    }
    if (state.map) state.map.setView(DEFAULT_CENTRE, DEFAULT_ZOOM);
  }

  function clearRating() {
    if (state.ratingValueEl) state.ratingValueEl.value = "";
    if (!state.ratingRoot) return;
    state.ratingRoot.querySelectorAll(".loc-rating__btn").forEach(function (b) {
      b.classList.remove("is-active");
      b.setAttribute("aria-checked", "false");
    });
  }

  function setRating(val) {
    if (!state.ratingRoot) return;
    var v = String(val || "");
    if (state.ratingValueEl) state.ratingValueEl.value = v;
    state.ratingRoot.querySelectorAll(".loc-rating__btn").forEach(function (b) {
      var active = b.getAttribute("data-rating") === v;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-checked", active ? "true" : "false");
    });
  }

  function showSuggest(html) {
    if (!state.suggestEl) return;
    state.suggestEl.innerHTML = html;
    state.suggestEl.classList.remove("hidden");
  }
  function hideSuggest() {
    if (!state.suggestEl) return;
    state.suggestEl.classList.add("hidden");
    state.suggestActiveIdx = -1;
    state.suggestItems = [];
  }

  function renderSuggestions(results) {
    if (!results || !results.length) {
      showSuggest('<div class="loc-suggest__empty">No matches in Australia. Try a different name, or click the map.</div>');
      state.suggestItems = [];
      return;
    }
    state.suggestItems = results;
    var html = results.map(function (r, i) {
      // Build a friendly two-line label: primary name + address context.
      var addr = r.address || {};
      var primary = r.namedetails && r.namedetails.name
        ? r.namedetails.name
        : (addr.attraction || addr.amenity || addr.shop || addr.tourism ||
           addr.building || addr.road || addr.suburb || addr.city || addr.town ||
           (r.display_name ? r.display_name.split(",")[0] : "Unnamed"));
      var subParts = [addr.suburb, addr.city || addr.town, addr.state].filter(Boolean);
      var sub = subParts.join(", ") || r.display_name || "";
      return (
        '<button type="button" class="loc-suggest__item" data-idx="' + i + '">' +
          '<div class="loc-suggest__name">' + escapeHtml(primary) + '</div>' +
          '<div class="loc-suggest__sub">' + escapeHtml(sub) + '</div>' +
        '</button>'
      );
    }).join("");
    showSuggest(html);
  }

  function pickSuggestion(idx) {
    var r = state.suggestItems[idx];
    if (!r) return;
    var name = r.namedetails && r.namedetails.name
      ? r.namedetails.name
      : (r.display_name ? r.display_name.split(",")[0] : "");
    var lat = parseFloat(r.lat);
    var lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPlace(name, lat, lng);
  }

  function searchPlaces(q) {
    var key = q.toLowerCase();
    if (SEARCH_CACHE[key]) {
      renderSuggestions(SEARCH_CACHE[key]);
      return;
    }
    var myReq = ++state.activeRequest;
    showSuggest('<div class="loc-suggest__loading">Searching…</div>');
    var url = NOMINATIM_URL +
      "?format=json&addressdetails=1&namedetails=1&limit=6&countrycodes=au" +
      "&q=" + encodeURIComponent(q);

    fetch(url, {
      headers: { "Accept": "application/json" },
    })
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (results) {
        if (myReq !== state.activeRequest) return; // a newer query ran
        SEARCH_CACHE[key] = results || [];
        renderSuggestions(results || []);
      })
      .catch(function () {
        if (myReq !== state.activeRequest) return;
        showSuggest('<div class="loc-suggest__empty">Search failed. Click the map to drop a pin manually.</div>');
      });
  }

  function reverseGeocode(lat, lng) {
    // Try to give the user a sensible "place" label after a manual map click.
    var url = "https://nominatim.openstreetmap.org/reverse" +
      "?format=json&zoom=17&addressdetails=1&namedetails=1" +
      "&lat=" + encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng);
    fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        var name = (data.namedetails && data.namedetails.name)
          || (data.address && (data.address.attraction || data.address.amenity ||
                               data.address.shop || data.address.tourism ||
                               data.address.building || data.address.road ||
                               data.address.suburb || data.address.city || data.address.town))
          || (data.display_name ? data.display_name.split(",")[0] : "");
        if (state.placeNameEl) state.placeNameEl.value = name || "";
        if (state.inputEl && !state.inputEl.value) state.inputEl.value = name || "";
        if (state.selectedChipEl && state.selectedChipTextEl) {
          state.selectedChipTextEl.textContent = name || "(custom pin)";
          state.selectedChipEl.classList.remove("hidden");
          state.selectedChipEl.classList.add("flex");
        }
      })
      .catch(function () { /* silent — the pin coords are enough */ });
  }

  function onInput(e) {
    var q = (e.target.value || "").trim();
    clearTimeout(state.debounceTimer);
    if (q.length < MIN_QUERY) { hideSuggest(); return; }
    state.debounceTimer = setTimeout(function () { searchPlaces(q); }, DEBOUNCE_MS);
  }

  function onKeydown(e) {
    if (state.suggestEl.classList.contains("hidden")) return;
    var items = state.suggestEl.querySelectorAll(".loc-suggest__item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      state.suggestActiveIdx = (state.suggestActiveIdx + 1) % items.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      state.suggestActiveIdx = (state.suggestActiveIdx - 1 + items.length) % items.length;
    } else if (e.key === "Enter") {
      if (state.suggestActiveIdx >= 0) {
        e.preventDefault();
        pickSuggestion(state.suggestActiveIdx);
        return;
      }
    } else if (e.key === "Escape") {
      hideSuggest();
      return;
    } else { return; }
    items.forEach(function (it, i) { it.classList.toggle("is-active", i === state.suggestActiveIdx); });
  }

  function attachOnce() {
    if (state.inputEl) return; // already attached
    state.inputEl            = $("locPlaceSearch");
    state.suggestEl          = $("locPlaceSuggestions");
    state.selectedChipEl     = $("locSelectedChip");
    state.selectedChipTextEl = $("locSelectedChipText");
    state.placeNameEl        = $("locPlaceName");
    state.latEl              = $("locLat");
    state.lngEl              = $("locLng");
    state.ratingValueEl      = $("locRatingValue");
    state.ratingRoot         = $("locRating");

    if (!state.inputEl) return;

    state.inputEl.addEventListener("input", onInput);
    state.inputEl.addEventListener("keydown", onKeydown);

    // Click on a suggestion
    state.suggestEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".loc-suggest__item");
      if (!btn) return;
      var idx = parseInt(btn.getAttribute("data-idx"), 10);
      if (!Number.isNaN(idx)) pickSuggestion(idx);
    });

    // Click outside → close suggestions
    document.addEventListener("click", function (e) {
      if (!state.inputEl || !state.suggestEl) return;
      if (state.inputEl.contains(e.target) || state.suggestEl.contains(e.target)) return;
      hideSuggest();
    });

    // Clear chip
    var clearChipBtn = $("locSelectedChipClear");
    if (clearChipBtn) {
      clearChipBtn.addEventListener("click", function () { clearPlace(); });
    }

    // Smiley rating
    if (state.ratingRoot) {
      state.ratingRoot.addEventListener("click", function (e) {
        var btn = e.target.closest(".loc-rating__btn");
        if (!btn) return;
        var v = btn.getAttribute("data-rating");
        if (state.ratingValueEl && state.ratingValueEl.value === v) {
          // Toggle off if tapping the same smiley.
          clearRating();
        } else {
          setRating(v);
        }
      });
    }
  }

  function open() {
    attachOnce();
    // Lazy-init map only when the modal is actually visible (Leaflet needs real dimensions).
    // We retry a couple of times in case the modal animates in.
    var tries = 0;
    function tryInit() {
      var el = $("locPicker");
      if (!el) return;
      var w = el.offsetWidth;
      if (w === 0 && tries++ < 10) { setTimeout(tryInit, 60); return; }
      ensureMap();
      if (state.map) state.map.invalidateSize();
    }
    tryInit();
  }

  function close() {
    hideSuggest();
  }

  function reset() {
    attachOnce();
    clearPlace();
    clearRating();
  }

  function prefill(data) {
    attachOnce();
    if (!data) { reset(); return; }
    // Place
    if (data.placeName && Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))) {
      ensureMap();
      setPlace(data.placeName, Number(data.lat), Number(data.lng));
    } else if (Number.isFinite(Number(data.lat)) && Number.isFinite(Number(data.lng))) {
      ensureMap();
      setPin(Number(data.lat), Number(data.lng));
      if (state.map) state.map.setView([Number(data.lat), Number(data.lng)], 14);
    } else {
      clearPlace();
    }
    // Rating
    if (data.rating) setRating(String(data.rating)); else clearRating();
  }

  function readState() {
    attachOnce();
    var lat = state.latEl && state.latEl.value !== "" ? parseFloat(state.latEl.value) : null;
    var lng = state.lngEl && state.lngEl.value !== "" ? parseFloat(state.lngEl.value) : null;
    var place = state.placeNameEl ? (state.placeNameEl.value || "").trim() : "";
    var rat = state.ratingValueEl ? state.ratingValueEl.value : "";
    var ratNum = rat === "" ? null : parseInt(rat, 10);
    return {
      placeName: place || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      rating: Number.isFinite(ratNum) ? ratNum : null,
    };
  }

  global.MYVIBE_LOC_PICKER = {
    open: open,
    close: close,
    reset: reset,
    prefill: prefill,
    readState: readState,
  };

  // Try to attach once DOM is ready so create-route.js can call reset()/prefill() right away.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachOnce, { once: true });
  } else {
    attachOnce();
  }
})(window);
