// THE CARD MAP v30 — In-app Trip Map
// Keeps the map inside THE CARD MAP. No paid map API or new key.
// Nearby venue searches remain available as fallbacks via Maps.
(() => {
  if (typeof window.openDetails !== "function") return;

  const originalOpenDetails = window.openDetails;
  let tripMap = null;

  function tripSearchUrl(kind, event) {
    const anchor = [event.venue, event.city || event.location, event.postcode]
      .filter(Boolean).join(", ");
    const fallback = event.name || "card show";
    const labels = {
      parking: "parking near",
      food: "restaurants near",
      hotels: "hotels near"
    };
    const query = `${labels[kind] || "places near"} ${anchor || fallback}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  // Never use city-centre or postcode-area coordinates as venue destinations.
  // First look for the actual venue in OpenStreetMap, then use a postcode
  // centroid only as a clearly labelled approximate fallback.
  const venueCache = new Map();
  function fullPostcode(event) {
    const text = [event.postcode, event.venue, event.address].filter(Boolean).join(" ");
    const match = text.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
    return match ? match[1].replace(/\s+/g, "").replace(/(.{3})$/, " $1") : "";
  }
  function milesBetween(a, b) {
    const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
    return 3958.76 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function venueTerms(event) {
    return String(event.venue || event.address || "")
      .replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "")
      .replace(/[^a-z0-9 ]/gi, " ").toLowerCase().split(/\s+/)
      .filter(word => word.length > 3 && !["centre", "center", "hotel", "hall", "road", "street", "arena", "the", "venue", "events"].includes(word));
  }
  async function postcodeLocation(postcode) {
    if (!postcode) return null;
    try {
      const response = await fetch("https://api.postcodes.io/postcodes/" + encodeURIComponent(postcode));
      if (!response.ok) return null;
      const data = await response.json();
      const p = data.result;
      return p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
        ? [p.latitude, p.longitude] : null;
    } catch (_) { return null; }
  }
  async function venueLocation(event, postcodeCoords) {
    const name = String(event.venue || event.address || "").replace(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/gi, "").trim();
    const city = String(event.city || event.location || "").trim();
    const terms = venueTerms(event);
    if (!name || !city || !terms.length) return null;
    // Only query on opening a show, not across the entire event catalogue.
    // Public Nominatim may be rate-limited; failure is handled safely.
    for (const query of [name + ", " + city + ", United Kingdom", name + ", United Kingdom"]) {
      try {
        const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "5", addressdetails: "1", countrycodes: "gb" });
        const response = await fetch("https://nominatim.openstreetmap.org/search?" + params, { headers: { Accept: "application/json" } });
        if (!response.ok) break;
        const items = await response.json();
        for (const item of items) {
          const coords = [Number(item.lat), Number(item.lon)];
          if (!coords.every(Number.isFinite)) continue;
          const label = String(item.display_name || "").toLowerCase();
          // Do not mistake a matching city or generic word for the venue.
          const matched = terms.filter(term => label.includes(term));
          if (matched.length < Math.min(2, terms.length)) continue;
          // If the event postcode is valid, reject implausibly distant matches.
          if (postcodeCoords && milesBetween(coords, postcodeCoords) > 3) continue;
          return { coords, exact: true };
        }
      } catch (_) { break; }
    }
    return null;
  }
  async function eventCoords(event) {
    const postcode = fullPostcode(event);
    const cacheKey = [event.venue, event.city, postcode].join("|");
    if (venueCache.has(cacheKey)) return venueCache.get(cacheKey);
    const pending = (async () => {
      const postcodeCoords = await postcodeLocation(postcode);
      const venue = await venueLocation(event, postcodeCoords);
      if (venue) return venue;
      return postcodeCoords ? { coords: postcodeCoords, exact: false } : null;
    })();
    venueCache.set(cacheKey, pending);
    return pending;
  }

  function addTripPlanner(key) {
    if (typeof currentEvents === "undefined" || typeof eventKey !== "function") return;
    const event = currentEvents.find(item => eventKey(item) === key);
    if (!event) return;

    const detailsBody = document.querySelector("#detailsContent .details-body");
    if (!detailsBody || detailsBody.querySelector(".trip-planner")) return;

    const actions = detailsBody.querySelector(".details-actions");
    if (!actions) return;

    const mapId = `trip-map-${String(key).replace(/[^a-z0-9_-]/gi, "-")}`;

    if (tripMap) { try { tripMap.remove(); } catch (_) {} tripMap = null; }
    const planner = document.createElement("section");
    planner.className = "trip-planner trip-planner-v30";
    planner.setAttribute("aria-label", "Plan your trip");
    planner.innerHTML = `
      <div class="trip-planner-head">
        <div>
          <strong>🗺️ Plan your trip</strong>
          <span>Venue map inside THE CARD MAP</span>
        </div>
      </div>
      <div id="${mapId}" class="trip-inline-map" aria-label="Venue map" style="display:none"></div>
      <div class="trip-map-unavailable">📍 Looking up the venue location…</div>
      <div class="trip-map-tools">
        <button type="button" class="trip-locate-btn">◎ <span>Show my location</span></button>
        <button type="button" class="trip-route-btn">🚗 <span>Route me there</span></button>
      </div>
      <div class="trip-route-summary" hidden></div>
      <div class="trip-planner-actions">
        <a href="${tripSearchUrl("parking", event)}" target="_blank" rel="noopener">🅿️ <span>Parking</span></a>
        <a href="${tripSearchUrl("food", event)}" target="_blank" rel="noopener">🍔 <span>Food</span></a>
        <a href="${tripSearchUrl("hotels", event)}" target="_blank" rel="noopener">🏨 <span>Hotels</span></a>
      </div>
      <small class="trip-planner-note">Map stays in Card Map. Nearby searches open live results in Maps for now.</small>
    `;

    actions.parentNode.insertBefore(planner, actions);

    let destination = null;
    let venueExact = false;
    const mapElement = planner.querySelector(".trip-inline-map");
    const statusElement = planner.querySelector(".trip-map-unavailable");

    async function loadVenue() {
      const result = await eventCoords(event);
      if (!planner.isConnected) return;
      if (!result) {
        statusElement.textContent = "📍 Venue map unavailable. Use Open in Maps to find the address.";
        return;
      }
      destination = result.coords;
      venueExact = result.exact;
      if (!window.L) {
        statusElement.textContent = "📍 Map tiles unavailable. Use Open in Maps.";
        return;
      }
      statusElement.textContent = venueExact
        ? "📍 Venue matched in OpenStreetMap (entrance not verified)"
        : "⚠️ Approximate postcode location only — venue not verified. Use Open in Maps for directions.";
      mapElement.style.display = "";
      if (tripMap) {
        try { tripMap.remove(); } catch (_) {}
        tripMap = null;
      }
      tripMap = L.map(mapElement, { scrollWheelZoom: false, zoomControl: true, attributionControl: true })
        .setView(destination, venueExact ? 16 : 14);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(tripMap);
      const venueMarker = L.marker(destination).addTo(tripMap);
      // Do not auto-open an oversized popup over the small mobile map.
      venueMarker.bindPopup(venueExact
        ? "Venue location (verify before travelling)"
        : "Approximate postcode centre (not the venue entrance)", { maxWidth: 200 });
      setTimeout(() => tripMap?.invalidateSize(), 100);
      // Showing the user's position is safe with an approximate pin;
      // routing to that pin would imply a false venue destination.
      if (navigator.geolocation) {
        locateBtn.style.removeProperty("display");
        if (venueExact && routeBtn && !routeBtn.isConnected) {
          planner.querySelector(".trip-map-tools")?.appendChild(routeBtn);
        }
      }
    }

    const locateBtn = planner.querySelector(".trip-locate-btn");
    const routeBtn = planner.querySelector(".trip-route-btn");
    const routeSummary = planner.querySelector(".trip-route-summary");
    if (routeSummary) routeSummary.remove();
    let myCoords = null;
    let routeLayer = null;

    if (locateBtn) locateBtn.style.setProperty("display", "none", "important");
    if (routeBtn) routeBtn.remove();
    loadVenue().catch(() => { statusElement.textContent = "📍 Venue lookup unavailable. Open in Maps for directions."; });

    async function getMyLocation() {
      if (myCoords) return myCoords;
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(position => {
          myCoords = [position.coords.latitude, position.coords.longitude];
          resolve(myCoords);
        }, reject, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
      });
    }

    locateBtn?.addEventListener("click", async () => {
      locateBtn.disabled = true;
      locateBtn.innerHTML = '⌛ <span>Finding you…</span>';

      try {
        const mine = await getMyLocation();
        if (tripMap && destination) {
          L.circleMarker(mine, {
            radius: 8,
            weight: 3,
            fillOpacity: .9
          }).addTo(tripMap).bindPopup("You are here");
          tripMap.fitBounds(L.latLngBounds([destination, mine]), { padding: [28, 28], maxZoom: 13 });
        }
        locateBtn.innerHTML = '✓ <span>Location shown</span>';
      } catch (_) {
        locateBtn.innerHTML = '◎ <span>Location unavailable — retry</span>';
      }
      locateBtn.disabled = false;
    });

    routeBtn?.addEventListener("click", async () => {
      routeBtn.disabled = true;
      routeBtn.innerHTML = '⌛ <span>Finding route…</span>';
      if (routeSummary) { routeSummary.hidden = true; routeSummary.remove(); }

      try {
        if (!destination || !venueExact) throw new Error("Verified venue destination unavailable");
        const mine = await getMyLocation();
        const url = `https://router.project-osrm.org/route/v1/driving/${mine[1]},${mine[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson&steps=false`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Route service unavailable");
        const data = await response.json();
        if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found");

        const route = data.routes[0];
        if (tripMap) {
          if (routeLayer) tripMap.removeLayer(routeLayer);
          routeLayer = L.geoJSON(route.geometry, {
            style: { weight: 6, opacity: .85 }
          }).addTo(tripMap);
          L.circleMarker(mine, { radius: 8, weight: 3, fillOpacity: .9 })
            .addTo(tripMap).bindPopup("You are here");
          tripMap.fitBounds(routeLayer.getBounds(), { padding: [24, 24] });
        }

        const miles = route.distance / 1609.344;
        const mins = Math.max(1, Math.round(route.duration / 60));
        const time = mins >= 60
          ? `${Math.floor(mins / 60)} hr ${mins % 60 ? `${mins % 60} min` : ""}`.trim()
          : `${mins} min`;

        if (routeSummary) {
          routeSummary.innerHTML = `<strong>🚗 ${miles.toFixed(miles < 10 ? 1 : 0)} miles</strong><span>Approx. ${time} driving</span><small>Venue match · OSRM / OpenStreetMap</small>`;
          routeSummary.hidden = false;
          planner.querySelector(".trip-map-tools")?.after(routeSummary);
        }
        routeBtn.innerHTML = '✓ <span>Route shown</span>';
      } catch (_) {
        if (routeSummary) {
          routeSummary.innerHTML = '<strong>Route unavailable right now</strong><span>Please try again shortly.</span>';
          routeSummary.hidden = false;
          planner.querySelector(".trip-map-tools")?.after(routeSummary);
        }
        routeBtn.innerHTML = '🚗 <span>Route me there</span>';
      }
      routeBtn.disabled = false;
    });
  }

  window.openDetails = function(key) {
    originalOpenDetails(key);
    addTripPlanner(key);
  };
})();
