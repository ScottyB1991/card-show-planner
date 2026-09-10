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

  function eventCoords(event) {
    if (typeof coordsForEvent === "function") return coordsForEvent(event);
    return null;
  }

  function addTripPlanner(key) {
    if (typeof currentEvents === "undefined" || typeof eventKey !== "function") return;
    const event = currentEvents.find(item => eventKey(item) === key);
    if (!event) return;

    const detailsBody = document.querySelector("#detailsContent .details-body");
    if (!detailsBody || detailsBody.querySelector(".trip-planner")) return;

    const actions = detailsBody.querySelector(".details-actions");
    if (!actions) return;

    const coords = eventCoords(event);
    const mapId = `trip-map-${String(key).replace(/[^a-z0-9_-]/gi, "-")}`;

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
      ${coords ? `<div id="${mapId}" class="trip-inline-map" aria-label="Map showing the card show area"></div>` :
        `<div class="trip-map-unavailable">📍 Map location unavailable for this show.</div>`}
      <div class="trip-map-tools">
        <button type="button" class="trip-locate-btn">◎ <span>Show my location</span></button>
      </div>
      <div class="trip-planner-actions">
        <a href="${tripSearchUrl("parking", event)}" target="_blank" rel="noopener">🅿️ <span>Parking</span></a>
        <a href="${tripSearchUrl("food", event)}" target="_blank" rel="noopener">🍔 <span>Food</span></a>
        <a href="${tripSearchUrl("hotels", event)}" target="_blank" rel="noopener">🏨 <span>Hotels</span></a>
      </div>
      <small class="trip-planner-note">Map stays in Card Map. Nearby searches open live results in Maps for now.</small>
    `;

    actions.parentNode.insertBefore(planner, actions);

    if (coords && window.L) {
      setTimeout(() => {
        if (tripMap) {
          try { tripMap.remove(); } catch (_) {}
          tripMap = null;
        }
        const el = document.getElementById(mapId);
        if (!el) return;

        tripMap = L.map(el, {
          scrollWheelZoom: false,
          zoomControl: true,
          attributionControl: true
        }).setView(coords, 13);

        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(tripMap);

        L.marker(coords).addTo(tripMap)
          .bindPopup(`<strong>${String(event.name || "Card show").replace(/[<>&"]/g, "")}</strong>`)
          .openPopup();

        setTimeout(() => tripMap?.invalidateSize(), 100);
      }, 80);
    }

    const locateBtn = planner.querySelector(".trip-locate-btn");
    if (!coords || !navigator.geolocation) {
      if (locateBtn) locateBtn.hidden = true;
      return;
    }

    locateBtn?.addEventListener("click", () => {
      locateBtn.disabled = true;
      locateBtn.innerHTML = '⌛ <span>Finding you…</span>';

      navigator.geolocation.getCurrentPosition(position => {
        const mine = [position.coords.latitude, position.coords.longitude];
        if (tripMap) {
          L.circleMarker(mine, {
            radius: 8,
            weight: 3,
            fillOpacity: .9
          }).addTo(tripMap).bindPopup("You are here");
          tripMap.fitBounds(L.latLngBounds([coords, mine]), { padding: [28, 28], maxZoom: 13 });
        }
        locateBtn.innerHTML = '✓ <span>Location shown</span>';
        locateBtn.disabled = false;
      }, () => {
        locateBtn.innerHTML = '◎ <span>Show my location</span>';
        locateBtn.disabled = false;
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
    });
  }

  window.openDetails = function(key) {
    originalOpenDetails(key);
    addTripPlanner(key);
  };
})();
