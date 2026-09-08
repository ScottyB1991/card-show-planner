// THE CARD MAP v24 — Plan Your Trip
// Zero-cost nearby searches: no API key, no paid places service.
(() => {
  if (typeof window.openDetails !== "function") return;

  const originalOpenDetails = window.openDetails;

  function tripSearchUrl(kind, event) {
    const anchor = [event.venue, event.city || event.location, event.postcode]
      .filter(Boolean)
      .join(", ");
    const fallback = event.name || "card show";
    const labels = {
      parking: "parking near",
      food: "restaurants near",
      hotels: "hotels near"
    };
    const query = `${labels[kind] || "places near"} ${anchor || fallback}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function addTripPlanner(key) {
    if (typeof currentEvents === "undefined" || typeof eventKey !== "function") return;
    const event = currentEvents.find(item => eventKey(item) === key);
    if (!event) return;

    const detailsBody = document.querySelector("#detailsContent .details-body");
    if (!detailsBody || detailsBody.querySelector(".trip-planner")) return;

    const actions = detailsBody.querySelector(".details-actions");
    if (!actions) return;

    const planner = document.createElement("section");
    planner.className = "trip-planner";
    planner.setAttribute("aria-label", "Plan your trip");
    planner.innerHTML = `
      <div class="trip-planner-head">
        <div>
          <strong>📍 Plan your trip</strong>
          <span>Live nearby options around this show</span>
        </div>
      </div>
      <div class="trip-planner-actions">
        <a href="${tripSearchUrl("parking", event)}" target="_blank" rel="noopener">🅿️ <span>Parking</span></a>
        <a href="${tripSearchUrl("food", event)}" target="_blank" rel="noopener">🍔 <span>Food</span></a>
        <a href="${tripSearchUrl("hotels", event)}" target="_blank" rel="noopener">🏨 <span>Hotels</span></a>
      </div>
      <small class="trip-planner-note">Opens live nearby results in Maps — no paid Card Map subscription needed.</small>
    `;

    actions.parentNode.insertBefore(planner, actions);
  }

  window.openDetails = function(key) {
    originalOpenDetails(key);
    addTripPlanner(key);
  };
})();
