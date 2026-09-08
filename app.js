const PROJECT_URL_DEFAULT = "https://fafkcpkhwjopelvkupwe.supabase.co";
const EVENTS_FILE = "events.json";

let demoEvents = [];
let currentEvents = [];
let supabaseClient = null;
let savedIds = new Set();
let savedStatuses = new Map();
let savedNotes = new Map();
let savedFavourites = new Map();
let cardInterests = [];
let matchesOnly = false;
let currentUser = null;
let userLocation = null;
let userPlace = localStorage.getItem("csp_user_place") || "";
let currentView = "list";
let showsMap = null;
let showMarkersLayer = null;
let lastFilteredEvents = [];
let journeyMap = null;
let journeyMarkersLayer = null;

const $ = (id) => document.getElementById(id);
// Approximate town-centre coordinates for current Card Map show locations.
// Kept in-app so Shows Near Me does not depend on a live postcode/geocoding API.
const PLACE_CENTRES = {
  "farnborough": [51.2869, -0.7526],
  "ipswich": [52.0567, 1.1482],
  "bath": [51.3811, -2.3590],
  "birmingham": [52.4862, -1.8904],
  "solihull": [52.4128, -1.7782],
  "leeds": [53.8008, -1.5491],
  "esher": [51.3692, -0.3656],
  "watford": [51.6565, -0.3903],
  "hull": [53.7676, -0.3274],
  "derby": [52.9225, -1.4746],
  "stowmarket": [52.1880, 0.9977],
  "sheffield": [53.3811, -1.4701],
  "edinburgh": [55.9533, -3.1883],
  "lingfield": [51.1748, -0.0167],
  "stoke": [53.0027, -2.1794],
  "stoke-on-trent": [53.0027, -2.1794],
  "sunderland": [54.9069, -1.3838],
  "sandy": [52.1293, -0.2890],
  "liverpool": [53.4084, -2.9916],
  "melling": [53.4940, -2.9300],
  "belfast": [54.5973, -5.9301],
  "cheltenham": [51.8994, -2.0783],
  "lincoln": [53.2307, -0.5406],
  "milton keynes": [52.0406, -0.7594],
  "bognor regis": [50.7829, -0.6760],
  "brighton": [50.8225, -0.1372],
  "london": [51.5074, -0.1278],
  "brentwood": [51.6205, 0.3053],
  "cambridge": [52.2053, 0.1218],
  "newark": [53.0765, -0.8096],
  "southampton": [50.9097, -1.4044],
  "halifax": [53.7250, -1.8630],
  "chester": [53.1934, -2.8931],
  "carlisle": [54.8925, -2.9329],
  "manchester": [53.4808, -2.2426],
  "doncaster": [53.5228, -1.1285],
  "leicester": [52.6369, -1.1398],
  "swindon": [51.5558, -1.7797],
  "luton": [51.8787, -0.4200],
  "colchester": [51.8892, 0.9042],
  "newmarket": [52.2440, 0.4060],
  "bristol": [51.4545, -2.5879],
  "ashford": [51.1465, 0.8750],
  "coventry": [52.4068, -1.5197],
  "maidstone": [51.2704, 0.5227],
  "twickenham": [51.4449, -0.3370]
};

const POSTCODE_AREA_CENTRES = {
  "GU": PLACE_CENTRES["farnborough"], "IP": PLACE_CENTRES["ipswich"],
  "BA": PLACE_CENTRES["bath"], "B": PLACE_CENTRES["birmingham"],
  "LS": PLACE_CENTRES["leeds"], "KT": PLACE_CENTRES["esher"],
  "WD": PLACE_CENTRES["watford"], "HU": PLACE_CENTRES["hull"],
  "DE": PLACE_CENTRES["derby"], "S": PLACE_CENTRES["sheffield"],
  "EH": PLACE_CENTRES["edinburgh"], "RH": PLACE_CENTRES["lingfield"],
  "ST": PLACE_CENTRES["stoke-on-trent"], "SR": PLACE_CENTRES["sunderland"],
  "SG": PLACE_CENTRES["sandy"], "L": PLACE_CENTRES["liverpool"],
  "BT": PLACE_CENTRES["belfast"], "GL": PLACE_CENTRES["cheltenham"],
  "LN": PLACE_CENTRES["lincoln"], "MK": PLACE_CENTRES["milton keynes"],
  "PO": PLACE_CENTRES["bognor regis"], "BN": PLACE_CENTRES["brighton"],
  "W": PLACE_CENTRES["london"], "WC": PLACE_CENTRES["london"],
  "E": PLACE_CENTRES["london"], "CM": PLACE_CENTRES["brentwood"],
  "CB": PLACE_CENTRES["cambridge"], "NG": PLACE_CENTRES["newark"],
  "SO": PLACE_CENTRES["southampton"], "HX": PLACE_CENTRES["halifax"],
  "CH": PLACE_CENTRES["chester"], "CA": PLACE_CENTRES["carlisle"],
  "M": PLACE_CENTRES["manchester"], "DN": PLACE_CENTRES["doncaster"],
  "LE": PLACE_CENTRES["leicester"], "SN": PLACE_CENTRES["swindon"],
  "LU": PLACE_CENTRES["luton"], "CO": PLACE_CENTRES["colchester"],
  "BS": PLACE_CENTRES["bristol"], "TN": PLACE_CENTRES["ashford"],
  "CV": PLACE_CENTRES["coventry"], "ME": PLACE_CENTRES["maidstone"],
  "TW": PLACE_CENTRES["twickenham"]
};

function normalizePlace(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function postcodeArea(value) {
  const m = String(value || "").toUpperCase().match(/^([A-Z]{1,2})/);
  return m ? m[1] : "";
}

function coordsForEvent(e) {
  const city = normalizePlace(e.city || e.location || "");
  if (PLACE_CENTRES[city]) return PLACE_CENTRES[city];
  const area = postcodeArea(e.postcode || e.address || e.venue || "");
  return POSTCODE_AREA_CENTRES[area] || null;
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => d * Math.PI / 180;
  const R = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function eventDistanceMiles(e) {
  if (!userLocation) return null;
  const c = coordsForEvent(e);
  if (!c) return null;
  return haversineMiles(userLocation.latitude, userLocation.longitude, c[0], c[1]);
}

function formatDistance(miles) {
  if (miles == null || !Number.isFinite(miles)) return "";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}


function config() {
  return {
    url: localStorage.getItem("csp_supabase_url") || "",
    key: localStorage.getItem("csp_supabase_key") || ""
  };
}

async function loadDemoEvents() {
  try {
    const res = await fetch(EVENTS_FILE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    demoEvents = await res.json();
  } catch (error) {
    // Demo data is only a fallback. A missing events.json must never stop
    // the live Supabase event feed from loading.
    console.warn("Demo events unavailable:", error);
    demoEvents = [];
  }
}

async function loadSavedEvents() {
  savedIds = new Set();
  savedStatuses = new Map();
  savedNotes = new Map();
  savedFavourites = new Map();
  currentUser = null;
  if (!supabaseClient) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user || null;
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from("saved_events").select("event_id,status,notes,favourite").eq("user_id", currentUser.id);
  if (error) { console.warn("Could not load saved events:", error); return; }
  savedIds = new Set((data || []).map(row => String(row.event_id)));
  savedStatuses = new Map((data || []).map(row => [String(row.event_id), row.status || "interested"]));
  savedNotes = new Map((data || []).map(row => [String(row.event_id), row.notes || ""]));
  savedFavourites = new Map((data || []).map(row => [String(row.event_id), Boolean(row.favourite)]));
}

const CARD_INTEREST_OPTIONS = [
  ["pokemon", "⚡ Pokémon"],
  ["sports", "🏆 Sports"],
  ["one_piece", "🏴‍☠️ One Piece"],
  ["mtg", "🧙 MTG"],
  ["yugioh", "🐉 Yu-Gi-Oh!"],
  ["lorcana", "✨ Lorcana"]
];

async function loadCardPreferences() {
  cardInterests = [];
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.from("user_preferences")
    .select("card_interests")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error) { console.warn("Could not load card preferences:", error); return; }
  cardInterests = Array.isArray(data?.card_interests) ? data.card_interests : [];
}

function renderCardPreferences() {
  const wrap = $("preferencesChoices");
  const count = $("preferencesCount");
  if (!wrap) return;
  const selected = new Set(cardInterests);
  wrap.innerHTML = CARD_INTEREST_OPTIONS.map(([value, label]) => `
    <label class="preference-chip ${selected.has(value) ? "selected" : ""}">
      <input type="checkbox" value="${escAttr(value)}" ${selected.has(value) ? "checked" : ""}>
      <span>${esc(label)}</span>
    </label>`).join("");
  if (count) count.textContent = cardInterests.length ? `${cardInterests.length} selected` : "Pick yours";
  wrap.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
    input.closest(".preference-chip")?.classList.toggle("selected", input.checked);
    const n = wrap.querySelectorAll("input:checked").length;
    if (count) count.textContent = n ? `${n} selected` : "Pick yours";
  }));
}

async function saveCardPreferences() {
  const wrap = $("preferencesChoices");
  const status = $("preferencesStatus");
  if (!supabaseClient || !currentUser || !wrap) return;
  const interests = [...wrap.querySelectorAll("input:checked")].map(input => input.value);
  if (status) status.textContent = "Saving…";
  const payload = {
    card_interests: interests,
    updated_at: new Date().toISOString()
  };

  // Avoid an UPSERT here: under RLS, INSERT ... ON CONFLICT DO UPDATE can
  // be rejected even when the separate INSERT/UPDATE policies are correct.
  // First check whether this collector already has a preferences row, then
  // perform the matching operation explicitly.
  const { data: existing, error: lookupError } = await supabaseClient
    .from("user_preferences")
    .select("user_id")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (lookupError) {
    console.warn("Could not check card preferences:", lookupError);
    if (status) status.textContent = `Couldn’t save — ${lookupError.message || "try again."}`;
    return;
  }

  let error;
  if (existing) {
    ({ error } = await supabaseClient
      .from("user_preferences")
      .update(payload)
      .eq("user_id", currentUser.id));
  } else {
    ({ error } = await supabaseClient
      .from("user_preferences")
      .insert({ user_id: currentUser.id, ...payload }));
  }

  if (error) {
    console.warn("Could not save card preferences:", error);
    if (status) status.textContent = `Couldn’t save — ${error.message || "try again."}`;
    return;
  }
  cardInterests = interests;
  renderCardPreferences();
  render();
  if (status) { status.textContent = "✓ Saved"; setTimeout(() => { if (status.textContent === "✓ Saved") status.textContent = ""; }, 2200); }
}

async function connectSupabase() {
  const c = config();
  if (!c.url || !c.key || !window.supabase) return false;
  try {
    supabaseClient = window.supabase.createClient(c.url, c.key);
    const { data, error } = await supabaseClient.from("events").select("*").order("date", { ascending: true });
    if (error) throw error;
    currentEvents = (data || []).map(e => ({
      ...e,
      city: e.city || e.location || "",
      venue: e.venue || e.address || "",
      postcode: e.postcode || "",
      region: e.region || "",
      ticket_url: e.ticket_url || e.website || "",
      source_url: e.source_url || e.website || "",
      pokemon_relevance: e.pokemon_relevance || "Card show",
      card_categories: Array.isArray(e.card_categories) ? e.card_categories : []
    }));
    await loadSavedEvents();
    await loadCardPreferences();
    updateAuthUI();
    $("connectionBadge").textContent = `Supabase connected · ${currentEvents.length} shows`;
    return true;
  } catch (e) {
    console.warn("Supabase connection failed:", e);
    supabaseClient = null;
    return false;
  }
}

function formatDate(s) {
  if (!s) return "Date TBC";
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", {day:"numeric", month:"short", year:"numeric"});
}

function regionName(r) {
  return (r || "").replace(/^./, x => x.toUpperCase());
}

function eventKey(e) {
  return String(e.id ?? e.name ?? "");
}

function mapUrl(e) {
  const query = [e.venue || e.address || "", e.city || e.location || "", e.postcode || ""]
    .filter(Boolean)
    .join(", ")
    .trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
}

function setView(mode) {
  currentView = mode === "map" ? "map" : "list";
  const list = $("eventsList");
  const mapWrap = $("mapView");
  const listBtn = $("listViewBtn");
  const mapBtn = $("mapViewBtn");
  if (!list || !mapWrap) return;
  list.hidden = currentView === "map";
  mapWrap.hidden = currentView !== "map";
  listBtn?.classList.toggle("active", currentView === "list");
  mapBtn?.classList.toggle("active", currentView === "map");
  listBtn?.setAttribute("aria-pressed", String(currentView === "list"));
  mapBtn?.setAttribute("aria-pressed", String(currentView === "map"));
  if (currentView === "map") {
    renderMap(lastFilteredEvents);
    setTimeout(() => showsMap?.invalidateSize(), 50);
  }
}

function ensureMap() {
  if (showsMap || !window.L || !$("showsMap")) return !!showsMap;
  showsMap = L.map("showsMap", { scrollWheelZoom: false }).setView([54.3, -2.6], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(showsMap);
  // Cluster nearby show pins when zoomed out. If the optional clustering
  // library ever fails to load, fall back to the normal marker layer so
  // Map View still works rather than taking the app down.
  showMarkersLayer = typeof L.markerClusterGroup === "function"
    ? L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: false,
        spiderfyOnMaxZoom: true,
        removeOutsideVisibleBounds: true,
        maxClusterRadius: 52,
        disableClusteringAtZoom: 12
      })
    : L.layerGroup();
  showMarkersLayer.addTo(showsMap);

  // On clustered maps, tapping a numbered cluster opens a compact list of
  // the shows inside it. Users can jump straight to show details or zoom
  // into the cluster for the individual pins.
  if (typeof showMarkersLayer.on === "function" && typeof showMarkersLayer.zoomToShowLayer === "function") {
    showMarkersLayer.on("clusterclick", ev => {
      const markers = ev.layer.getAllChildMarkers();
      const items = markers
        .map(marker => marker.cardEvent)
        .filter(Boolean)
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
      const visible = items.slice(0, 10);
      const rows = visible.map(e => {
        const key = eventKey(e);
        const distance = eventDistanceMiles(e);
        return `<button type="button" class="cluster-show-row" onclick="showsMap.closePopup(); openDetails('${escAttr(key)}')">
          <span class="cluster-show-name">${esc(e.name || "Card show")}</span>
          <span class="cluster-show-meta">${esc(formatDate(e.date))}${e.city ? ` · ${esc(e.city)}` : ""}${distance != null ? ` · ~${esc(formatDistance(distance))}` : ""}</span>
        </button>`;
      }).join("");
      const more = items.length > visible.length
        ? `<div class="cluster-more">+${items.length - visible.length} more — zoom in to split the cluster</div>`
        : "";
      const popup = `<div class="cluster-list-popup">
        <div class="cluster-list-head"><strong>${items.length} shows in this area</strong><span>Tap a show for details</span></div>
        <div class="cluster-show-list">${rows}</div>
        ${more}
        <button type="button" class="cluster-zoom-btn" id="clusterZoomBtn">🔎 Zoom into area</button>
      </div>`;
      L.popup({ maxWidth: 340, minWidth: 250, className: "cluster-popup-shell" })
        .setLatLng(ev.layer.getLatLng())
        .setContent(popup)
        .openOn(showsMap);
      setTimeout(() => {
        document.getElementById("clusterZoomBtn")?.addEventListener("click", () => {
          showsMap.closePopup();
          showsMap.fitBounds(ev.layer.getBounds(), { padding: [36, 36], maxZoom: 11 });
        }, { once: true });
      }, 0);
    });
  }
  return true;
}

function renderMap(events) {
  if (!ensureMap()) return;
  showMarkersLayer.clearLayers();
  const bounds = [];
  events.forEach(e => {
    const c = coordsForEvent(e);
    if (!c) return;
    const key = eventKey(e);
    const maps = mapUrl(e);
    const distance = eventDistanceMiles(e);
    const popup = `<div class="map-popup">
      <strong>${esc(e.name || "Card show")}</strong>
      <div class="map-popup-meta">📅 ${esc(formatDate(e.date))}${e.city ? `<br>📍 ${esc(e.city)}` : ""}${distance != null ? `<br>📏 ~${esc(formatDistance(distance))} straight-line` : ""}</div>
      <div class="map-popup-actions">
        <button type="button" class="popup-primary" onclick="openDetails('${escAttr(key)}')">View details</button>
        ${maps ? `<a href="${escAttr(maps)}" target="_blank" rel="noopener">Directions ↗</a>` : ""}
      </div>
    </div>`;
    const marker = L.marker(c).bindPopup(popup);
    marker.cardEvent = e;
    marker.addTo(showMarkersLayer);
    bounds.push(c);
  });
  if (bounds.length === 1) showsMap.setView(bounds[0], 10);
  else if (bounds.length > 1) showsMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });
  else showsMap.setView([54.3, -2.6], 5);
}

function updateMatchFilterUI() {
  const btn = $("matchesOnlyBtn");
  const hint = $("matchesOnlyHint");
  if (!btn) return;

  const ready = Boolean(currentUser && cardInterests.length);
  if (!ready) matchesOnly = false;

  btn.classList.toggle("active", ready && matchesOnly);
  btn.setAttribute("aria-pressed", String(ready && matchesOnly));

  if (!currentUser) {
    btn.textContent = "⚡ Sign in for matches";
    if (hint) hint.textContent = "Sign in to use your saved card preferences.";
  } else if (!cardInterests.length) {
    btn.textContent = "⚡ Set Card Preferences";
    if (hint) hint.textContent = "Choose your cards in My Card Map to unlock matching.";
  } else {
    btn.textContent = matchesOnly ? "⚡ Showing My Matches" : "⚡ Matches My Cards";
    if (hint) hint.textContent = matchesOnly
      ? "Only verified shows matching at least one saved preference are shown."
      : "Show events matching your saved card preferences.";
  }
}

function render() {
  updateMatchFilterUI();
  const q = $("searchInput").value.trim().toLowerCase();
  const region = $("regionSelect").value;
  const dateFilter = $("dateSelect").value;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  renderScoutPicks(today);
  let filtered = currentEvents.filter(e => {
    const hay = [e.name,e.city,e.venue,e.postcode,e.region].join(" ").toLowerCase();
    const eventDate = e.date ? new Date(e.date + "T00:00:00") : null;
    let dateMatches = true;
    if (dateFilter !== "all") {
      if (!eventDate || Number.isNaN(eventDate.getTime())) {
        dateMatches = false;
      } else if (dateFilter === "upcoming") {
        dateMatches = eventDate >= today;
      } else if (dateFilter === "month") {
        dateMatches = eventDate >= today && eventDate <= monthEnd;
      } else if (dateFilter === "later") {
        dateMatches = eventDate > monthEnd;
      }
    }
    const preferenceMatches = !matchesOnly || matchingCardInterests(e).length > 0;
    return (!q || hay.includes(q)) && (!region || e.region === region) && dateMatches && preferenceMatches;
  });
  if (userLocation) {
    filtered = filtered.slice().sort((a, b) => {
      const da = eventDistanceMiles(a);
      const db = eventDistanceMiles(b);
      if (da == null && db == null) return String(a.date || "").localeCompare(String(b.date || ""));
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db || String(a.date || "").localeCompare(String(b.date || ""));
    });
  }
  lastFilteredEvents = filtered;
  $("countLabel").textContent = `${filtered.length} show${filtered.length === 1 ? "" : "s"}${matchesOnly ? " · matching your cards" : ""}${userLocation ? " · nearest first" : ""}`;
  $("eventsList").innerHTML = filtered.length ? filtered.map(eventCard).join("") :
    `<div class="empty">${matchesOnly ? "No verified shows currently match your card preferences and other filters." : "No shows match those filters."}</div>`;
  if (currentView === "map") renderMap(filtered);
}



function icsEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compactIcsDate(dateString) {
  return String(dateString || "").replace(/-/g, "");
}

function addDaysToDateString(dateString, days) {
  const d = new Date(String(dateString) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeCalendarFilename(name) {
  return String(name || "card-show")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "card-show";
}

function downloadCalendar(key) {
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e || !e.date) {
    alert("This show does not have a confirmed date yet.");
    return;
  }

  const rawUrl = e.ticket_url || e.source_url || "";
  const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "" : rawUrl;
  const startDate = compactIcsDate(e.date);
  const finalDate = e.end_date && e.end_date >= e.date ? e.end_date : e.date;
  const endDate = compactIcsDate(addDaysToDateString(finalDate, 1));
  const location = [e.venue, e.city, e.postcode].filter(Boolean).join(", ");
  const descriptionBits = [
    e.description || "Card show saved from The Card Map.",
    url ? `Show link: ${url}` : "",
    "Added via The Card Map — Your CardShow Scout."
  ].filter(Boolean);

  const uid = `${String(e.id || key).replace(/[^a-zA-Z0-9._-]/g, "-")}@thecardmap`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Card Map//Card Show Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${icsEscape(e.name || "Card show")}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(descriptionBits.join("\n\n"))}`,
    url ? `URL:${url}` : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(Boolean).join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${safeCalendarFilename(e.name)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
}

async function shareShow(key) {
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;

  const rawUrl = e.ticket_url || e.source_url || "";
  const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "" : rawUrl;
  const location = [e.venue, e.city, e.postcode].filter(Boolean).join(", ");
  const date = e.date ? formatDate(e.date) : "Date TBC";
  const text = [
    `🎴 ${e.name || "Card show"}`,
    `📅 ${date}`,
    location ? `📍 ${location}` : "",
    url ? `🔗 ${url}` : "",
    "Found on The Card Map — Your CardShow Scout"
  ].filter(Boolean).join("\n");

  try {
    if (navigator.share) {
      await navigator.share({ title: e.name || "Card show", text });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert("Show details copied — ready to paste into WhatsApp, Messenger or anywhere else.");
      return;
    }
    window.prompt("Copy these show details:", text);
  } catch (err) {
    if (err?.name !== "AbortError") console.warn("Could not share show:", err);
  }
}

const CARD_CATEGORY_LABELS = Object.fromEntries(CARD_INTEREST_OPTIONS);

function normaliseCardCategory(value) {
  return String(value || "").trim().toLowerCase().replace(/-/g, "_");
}

function matchingCardInterests(e) {
  if (!currentUser || !cardInterests.length) return [];
  const categories = new Set((Array.isArray(e.card_categories) ? e.card_categories : []).map(normaliseCardCategory));
  return cardInterests.map(normaliseCardCategory).filter(value => categories.has(value));
}

function matchBadge(e) {
  const matches = matchingCardInterests(e);
  if (!matches.length) return "";

  const total = cardInterests.length;
  const matched = matches.length;

  let strength = "Matches you";

  if (matched === total && total >= 2) {
    strength = "Great match";
  } else if (matched >= 2) {
    strength = "Strong match";
  }

  const labels = matches.map(value =>
    (CARD_CATEGORY_LABELS[value] || value).replace(/^\S+\s*/, "")
  );

  return `<span class="tag preference-match">⚡ ${strength} · ${matched}/${total}: ${esc(labels.join(", "))}</span>`;
}

function scoutMatchRank(e) {
  const matched = matchingCardInterests(e).length;
  const total = cardInterests.length;
  if (!matched || !total) return 0;
  if (matched === total && total >= 2) return 300 + matched;
  if (matched >= 2) return 200 + matched;
  return 100 + matched;
}

function renderScoutPicks(today) {
  const section = $("scoutPicksSection");
  const list = $("scoutPicksList");
  const hint = $("scoutPicksHint");
  if (!section || !list) return;

  if (!currentUser || !cardInterests.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  const picks = currentEvents
    .filter(e => {
      if (!e.date || !matchingCardInterests(e).length) return false;
      const eventDate = new Date(e.date + "T00:00:00");
      return !Number.isNaN(eventDate.getTime()) && eventDate >= today;
    })
    .sort((a, b) => {
      const rankDiff = scoutMatchRank(b) - scoutMatchRank(a);
      if (rankDiff) return rankDiff;
      return String(a.date || "").localeCompare(String(b.date || ""));
    })
    .slice(0, 3);

  if (!picks.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  section.hidden = false;
  if (hint) hint.textContent = `Top ${picks.length} based on your saved card preferences.`;
  list.innerHTML = picks.map(eventCard).join("");
}

function openDetails(key) {
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;

  const dialog = $("detailsDialog");
  const content = $("detailsContent");
  if (!dialog || !content) return;

  const saved = savedIds.has(key);
  const rawUrl = e.ticket_url || e.source_url || "";
  const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "" : rawUrl;
  const dateText = e.date ? new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }) : "Date TBC";
  const maps = mapUrl(e);
  const distance = eventDistanceMiles(e);

  content.innerHTML = `
    <div class="details-body">
      <h2>${esc(e.name || "Card show")}</h2>
      <div class="details-meta">
        <div>📅 <strong>${esc(dateText)}</strong></div>
        ${e.city ? `<div>📍 ${esc(e.city)}</div>` : ""}
        ${e.venue ? `<div>🏢 ${esc(e.venue)}</div>` : ""}
        ${e.postcode ? `<div>📮 ${esc(e.postcode)}</div>` : ""}
        ${distance != null ? `<div>📍 <strong>Approx. ${esc(formatDistance(distance))} away</strong></div>` : ""}
      </div>
      ${matchBadge(e) ? `<div class="details-match">${matchBadge(e)}</div>` : ""}
      ${e.description ? `<div class="details-description">${esc(e.description)}</div>` : ""}
      <div class="details-actions">
        <button class="primary" data-save-detail="${escAttr(key)}">${saved ? "♥ Saved to My Card Map" : "♡ Save event"}</button>
        ${maps ? `<a class="secondary map-action" href="${escAttr(maps)}" target="_blank" rel="noopener">🗺️ Open in Maps</a>` : ""}
        ${e.date ? `<button type="button" class="secondary" onclick="downloadCalendar('${escAttr(key)}')">📅 Add to calendar</button>` : ""}
        <button type="button" class="secondary" onclick="shareShow('${escAttr(key)}')">📤 Share show</button>
        ${url ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">🔗 Show website / tickets</a>` : ""}
      </div>
    </div>
  `;

  dialog.showModal();

  const saveBtn = content.querySelector("[data-save-detail]");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      await toggleSave(key);
      openDetails(key);
    });
  }
}

function eventCard(e) {
  const key = eventKey(e);
  const saved = savedIds.has(key);
  const rawUrl = e.ticket_url || e.source_url || "";
  const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "#" : (rawUrl || "#");
  const distance = eventDistanceMiles(e);
  return `<article class="event">
    <div class="event-top">
      <div><h3>${esc(e.name || "Card show")}</h3>
      <div class="date">${formatDate(e.date)}${e.end_date && e.end_date !== e.date ? ` – ${formatDate(e.end_date)}` : ""}</div></div>
      <span class="tag">${esc(e.pokemon_relevance || "Card show")}</span>
    </div>
    <div class="meta">${esc(e.venue || "")}${e.city ? ` · ${esc(e.city)}` : ""}${e.postcode ? ` · ${esc(e.postcode)}` : ""}<br>${esc(e.time || "")}${e.price ? ` · ${esc(e.price)}` : ""}</div>
    <div class="tags">${matchBadge(e)}${distance != null ? `<span class="tag distance-chip">📏 ~${esc(formatDistance(distance))} straight-line</span>` : ""}${e.region ? `<span class="tag">${esc(regionName(e.region))}</span>` : ""}</div>
    <div class="actions"><button type="button" class="secondary" onclick="openDetails(\'${escAttr(key)}\')">View details</button>
      <button class="${saved ? "secondary saved" : "secondary"}" onclick="toggleSave('${escAttr(key)}')">${saved ? "♥ Saved" : "♡ Save event"}</button>
      ${url !== "#" ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">Website / tickets ↗</a>` : ""}
    </div>
  </article>`;
}

async function toggleSave(key) {
  if (!supabaseClient) {
    alert("Connect Supabase first to save events.");
    $("settingsDialog").showModal();
    return;
  }
  const { data: authData } = await supabaseClient.auth.getUser();
  if (!authData?.user) {
    $("authDialog").showModal();
    return;
  }
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  if (savedIds.has(key)) {
    const { error } = await supabaseClient.from("saved_events").delete().eq("event_id", e.id).eq("user_id", authData.user.id);
    if (error) return alert(error.message);
    savedIds.delete(key);
    savedStatuses.delete(key);
    savedNotes.delete(key);
    savedFavourites.delete(key);
  } else {
    const { error } = await supabaseClient.from("saved_events").insert({ event_id: e.id, user_id: authData.user.id, status: "interested" });
    if (error) return alert(error.message);
    savedIds.add(key);
    savedStatuses.set(key, "interested");
    savedNotes.set(key, "");
    savedFavourites.set(key, false);
  }
  render();
  renderAccount();
}

function updateAuthUI() {
  const btn = $("authBtn");
  if (!btn) return;
  btn.textContent = currentUser ? "👤 Account" : "👤 Sign in";
}

function renderCollectorJourney(saved, today) {
  const wrap = $("collectorJourney");
  const stats = $("journeyStats");
  const mapEl = $("journeyMap");
  const empty = $("journeyEmpty");
  const countEl = $("journeyMapCount");
  if (!wrap || !stats || !mapEl || !empty) return;

  const attended = saved.filter(e => {
    const status = savedStatuses.get(eventKey(e)) || "interested";
    if (status !== "attended" || !e.date) return false;
    return new Date(e.date + "T00:00:00") <= today;
  });
  const cities = new Set(attended.map(e => normalizePlace(e.city || e.location || "")).filter(Boolean));
  const year = today.getFullYear();
  const thisYear = attended.filter(e => String(e.date || "").startsWith(String(year))).length;

  stats.innerHTML = `
    <div class="journey-stat"><span>🏆</span><strong>${attended.length}</strong><small>Shows Attended</small></div>
    <div class="journey-stat"><span>📍</span><strong>${cities.size}</strong><small>Cities Visited</small></div>
    <div class="journey-stat"><span>📅</span><strong>${thisYear}</strong><small>Attended in ${year}</small></div>`;
  if (countEl) countEl.textContent = `${attended.length} pin${attended.length === 1 ? "" : "s"}`;

  const mapped = attended.map(e => ({ e, c: coordsForEvent(e) })).filter(x => x.c);
  empty.hidden = mapped.length > 0;
  mapEl.hidden = mapped.length === 0;
  if (!mapped.length || !window.L) return;

  setTimeout(() => {
    if (!journeyMap) {
      journeyMap = L.map("journeyMap", { scrollWheelZoom: false, zoomControl: true }).setView([54.3, -2.6], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(journeyMap);
      journeyMarkersLayer = L.layerGroup().addTo(journeyMap);
    }
    journeyMarkersLayer.clearLayers();
    const bounds = [];
    mapped.forEach(({ e, c }) => {
      const key = eventKey(e);
      const popup = `<div class="map-popup"><strong>${esc(e.name || "Card show")}</strong><div class="map-popup-meta">📅 ${esc(formatDate(e.date))}${e.city ? `<br>📍 ${esc(e.city)}` : ""}</div><div class="map-popup-actions"><button type="button" class="popup-primary" onclick="openDetails('${escAttr(key)}')">View details</button></div></div>`;
      L.marker(c).bindPopup(popup).addTo(journeyMarkersLayer);
      bounds.push(c);
    });
    if (bounds.length === 1) journeyMap.setView(bounds[0], 9);
    else journeyMap.fitBounds(bounds, { padding: [22, 22], maxZoom: 8 });
    journeyMap.invalidateSize();
  }, 80);
}

function renderAccount() {
  const email = $("accountEmail");
  const list = $("savedEventsList");
  const count = $("savedCount");
  const nextCard = $("nextShowCard");
  const plannerStats = $("plannerStats");
  const reminderCard = $("showReminders");
  const reminderContent = $("reminderContent");
  const reminderCount = $("reminderCount");
  if (!email || !list || !count) return;
  email.textContent = currentUser?.email || "Signed in";
  renderCardPreferences();

  const saved = currentEvents
    .filter(e => savedIds.has(eventKey(e)))
    .sort((a, b) => String(a.date || "9999-12-31").localeCompare(String(b.date || "9999-12-31")));

  count.textContent = `${saved.length} show${saved.length === 1 ? "" : "s"}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = saved.filter(e => !e.date || new Date(e.date + "T00:00:00") >= today);
  const past = saved.filter(e => e.date && new Date(e.date + "T00:00:00") < today);

  // In-app reminders are derived from shows marked Going; no extra database state required.
  const goingShows = upcoming
    .filter(e => e.date && (savedStatuses.get(eventKey(e)) || "interested") === "going")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (reminderCard && reminderContent && reminderCount) {
    reminderCard.hidden = false;
    reminderCount.textContent = goingShows.length ? `${goingShows.length} planned` : "";
    if (!goingShows.length) {
      reminderContent.innerHTML = `<div class="reminder-empty">Mark an upcoming saved show as <strong>🎟️ Going</strong> and its countdown will appear here.</div>`;
    } else {
      reminderContent.innerHTML = goingShows.slice(0, 3).map(e => {
        const eventDate = new Date(e.date + "T00:00:00");
        const days = Math.max(0, Math.round((eventDate - today) / 86400000));
        let icon = "📅", label = `${days} days away`, tone = "calm";
        if (days === 0) { icon = "🎴"; label = "TODAY — Card show day!"; tone = "today"; }
        else if (days === 1) { icon = "🔥"; label = "Tomorrow!"; tone = "soon"; }
        else if (days <= 7) { icon = "🔔"; label = days === 7 ? "One week to go!" : `${days} days to go!`; tone = "soon"; }
        else if (days <= 14) { icon = "🔔"; label = `${days} days to go`; tone = "near"; }
        return `<button type="button" class="reminder-item ${tone}" onclick="openDetails('${escAttr(eventKey(e))}')"><span class="reminder-icon">${icon}</span><span class="reminder-copy"><strong>${esc(e.name || "Card show")}</strong><small>${esc(label)} · ${formatDate(e.date)}${e.city ? ` · ${esc(e.city)}` : ""}</small></span><span class="reminder-arrow">›</span></button>`;
      }).join("") + (goingShows.length > 3 ? `<div class="reminder-more">+${goingShows.length - 3} more planned show${goingShows.length - 3 === 1 ? "" : "s"}</div>` : "");
    }
  }

  const favouriteShows = saved
    .filter(e => savedFavourites.get(eventKey(e)))
    .sort((a, b) => String(a.date || "9999-12-31").localeCompare(String(b.date || "9999-12-31")));
  const favouriteCard = $("favouritesCard");
  const favouriteContent = $("favouritesContent");
  const favouriteCount = $("favouritesCount");
  if (favouriteCard && favouriteContent && favouriteCount) {
    favouriteCount.textContent = favouriteShows.length ? `${favouriteShows.length} favourite${favouriteShows.length === 1 ? "" : "s"}` : "";
    favouriteContent.innerHTML = favouriteShows.length
      ? favouriteShows.slice(0, 4).map(e => `<button type="button" class="favourite-item" onclick="openDetails('${escAttr(eventKey(e))}')"><span>⭐</span><span><strong>${esc(e.name || "Card show")}</strong><small>${formatDate(e.date)}${e.city ? ` · ${esc(e.city)}` : ""}</small></span><span>›</span></button>`).join("") + (favouriteShows.length > 4 ? `<div class="favourite-more">+${favouriteShows.length - 4} more</div>` : "")
      : `<div class="favourite-empty">Star the shows you’re most excited for. They’ll live here. ⭐</div>`;
  }

  const statusCount = status => saved.filter(e => (savedStatuses.get(eventKey(e)) || "interested") === status).length;
  if (plannerStats) {
    plannerStats.innerHTML = `
      <div class="planner-stat"><span>❤️</span><strong>${statusCount("interested")}</strong><small>Interested</small></div>
      <div class="planner-stat"><span>🎟️</span><strong>${statusCount("going")}</strong><small>Going</small></div>
      <div class="planner-stat"><span>✅</span><strong>${statusCount("attended")}</strong><small>Attended</small></div>`;
    plannerStats.hidden = saved.length === 0;
  }

  if (nextCard) {
    const next = upcoming.find(e => e.date && savedStatuses.get(eventKey(e)) === "going");
    if (!next) {
      nextCard.hidden = false;
      nextCard.innerHTML = `<div class="next-show-kicker">🎯 YOUR NEXT SHOW</div><div class="next-show-empty">Mark an upcoming saved show as <strong>🎟️ Going</strong> and it will appear here.</div>`;
    } else {
      const eventDate = new Date(next.date + "T00:00:00");
      const days = Math.max(0, Math.round((eventDate - today) / 86400000));
      const when = days === 0 ? "Today!" : days === 1 ? "Tomorrow" : `${days} days to go`;
      const maps = mapUrl(next);
      const rawUrl = next.ticket_url || next.source_url || "";
      const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "" : rawUrl;
      nextCard.hidden = false;
      nextCard.innerHTML = `
        <div class="next-show-kicker">🎯 YOUR NEXT SHOW · ${esc(when)}</div>
        <div class="next-show-title">${esc(next.name || "Card show")}</div>
        <div class="next-show-meta">📅 ${formatDate(next.date)}${next.city ? ` · 📍 ${esc(next.city)}` : ""}</div>
        <div class="next-show-actions">
          <button type="button" class="secondary" onclick="openDetails('${escAttr(eventKey(next))}')">View details</button>
          ${maps ? `<a class="secondary" href="${escAttr(maps)}" target="_blank" rel="noopener">🗺️ Map</a>` : ""}
          ${next.date ? `<button type="button" class="secondary" onclick="downloadCalendar('${escAttr(eventKey(next))}')">📅 Calendar</button>` : ""}
          <button type="button" class="secondary" onclick="shareShow('${escAttr(eventKey(next))}')">📤 Share</button>
          ${url ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">Tickets ↗</a>` : ""}
        </div>`;
    }
  }

  if (!saved.length) {
    renderCollectorJourney(saved, today);
    if (plannerStats) plannerStats.hidden = true;
    list.innerHTML = `<div class="empty-saved">You haven't saved any shows yet.<br>Tap <strong>♡ Save event</strong> on a show to add it here.</div>`;
    return;
  }

  // Never present a future show as attended. This also cleans up any
  // impossible state left behind by earlier testing.
  const futureAttended = saved.filter(e => {
    if (!e.date || (savedStatuses.get(eventKey(e)) || "interested") !== "attended") return false;
    return new Date(e.date + "T00:00:00") > today;
  });
  futureAttended.forEach(e => savedStatuses.set(eventKey(e), "interested"));
  if (futureAttended.length && currentUser && supabaseClient) {
    Promise.all(futureAttended.map(e => supabaseClient.from("saved_events")
      .update({ status: "interested" })
      .eq("event_id", e.id)
      .eq("user_id", currentUser.id))).catch(() => {});
  }

  renderCollectorJourney(saved, today);

  const savedCard = (e, isPast = false) => {
    const rawUrl = e.ticket_url || e.source_url || "";
    const url = /card\s*compass/i.test(rawUrl) || /cardcompass/i.test(rawUrl) ? "" : rawUrl;
    const maps = mapUrl(e);
    const key = eventKey(e);
    const currentStatus = savedStatuses.get(key) || "interested";
    const note = savedNotes.get(key) || "";
    const eventDay = e.date ? new Date(e.date + "T00:00:00") : null;
    const attendedLocked = Boolean(eventDay && eventDay > today);
    return `<article class="saved-event${isPast ? " saved-past" : ""}">
      <div class="saved-title">${savedFavourites.get(key) ? `<span class="saved-favourite-star" aria-label="Favourite">⭐</span>` : ""}${esc(e.name || "Card show")}</div>
      <div class="saved-meta">${formatDate(e.date)}${e.city ? ` · ${esc(e.city)}` : ""}${e.venue ? ` · ${esc(e.venue)}` : ""}</div>
      <div class="show-status-picker" role="group" aria-label="Show status">
        ${[
          ["interested", "❤️ Interested"],
          ["going", "🎟️ Going"],
          ["attended", "✅ Attended"]
        ].map(([value, label]) => {
          const locked = value === "attended" && attendedLocked;
          return `<button type="button" class="status-choice${currentStatus === value ? " active" : ""}${locked ? " locked" : ""}" onclick="setSavedStatus('${escAttr(eventKey(e))}','${value}')"${locked ? ' disabled aria-disabled="true" title="Attended unlocks on the show date"' : ""}>${label}</button>`;
        }).join("")}
      </div>
      ${attendedLocked ? `<div class="status-hint">✅ Attended unlocks on the show date.</div>` : ""}
      <button type="button" class="favourite-toggle${savedFavourites.get(key) ? " active" : ""}" onclick="toggleFavourite('${escAttr(key)}')" aria-pressed="${savedFavourites.get(key) ? "true" : "false"}">${savedFavourites.get(key) ? "⭐ Favourited" : "☆ Add to favourites"}</button>
      <details class="show-notes">
        <summary><span>📝 My Show Notes</span><span class="note-state">${note.trim() ? "Note saved" : "Add note"}</span></summary>
        <div class="show-notes-editor">
          <textarea maxlength="1000" placeholder="Trade binder, cards to hunt, people to meet…">${esc(note)}</textarea>
          <div class="show-notes-actions">
            <button type="button" class="secondary" onclick="saveShowNote('${escAttr(key)}', this)">Save note</button>
            <button type="button" class="note-clear" onclick="clearShowNote('${escAttr(key)}', this)">Clear</button>
          </div>
          <div class="note-save-status" aria-live="polite"></div>
        </div>
      </details>
      <div class="saved-actions">
        <button type="button" class="secondary" onclick="openDetails('${escAttr(eventKey(e))}')">Details</button>
        <button type="button" class="secondary" onclick="removeSavedFromAccount('${escAttr(eventKey(e))}')">♥ Saved</button>
        ${maps ? `<a class="secondary" href="${escAttr(maps)}" target="_blank" rel="noopener">🗺️ Map</a>` : ""}
        ${e.date ? `<button type="button" class="secondary" onclick="downloadCalendar('${escAttr(eventKey(e))}')">📅 Calendar</button>` : ""}
        <button type="button" class="secondary" onclick="shareShow('${escAttr(eventKey(e))}')">📤 Share</button>
        ${url ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">Tickets</a>` : ""}
      </div>
    </article>`;
  };

  const attended = saved
    .filter(e => (savedStatuses.get(eventKey(e)) || "interested") === "attended")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const upcomingPlans = upcoming.filter(e => (savedStatuses.get(eventKey(e)) || "interested") !== "attended");
  const pastUnattended = past.filter(e => (savedStatuses.get(eventKey(e)) || "interested") !== "attended");

  list.innerHTML = [
    upcomingPlans.length ? `<div class="saved-group-label">UPCOMING PLANS · ${upcomingPlans.length}</div>${upcomingPlans.map(e => savedCard(e)).join("")}` : "",
    attended.length ? `<section class="show-history"><div class="history-head"><div class="history-title-row"><span class="history-kicker">✅ SHOW HISTORY</span><strong>${attended.length} attended</strong></div><div class="history-subtitle">🏆 Your card-show history</div></div>${attended.map(e => savedCard(e, true)).join("")}</section>` : "",
    pastUnattended.length ? `<details class="past-shows"><summary>Past saved shows · ${pastUnattended.length}</summary>${pastUnattended.map(e => savedCard(e, true)).join("")}</details>` : ""
  ].join("");
}

async function toggleFavourite(key) {
  if (!currentUser || !supabaseClient || !savedIds.has(key)) return;
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  const next = !Boolean(savedFavourites.get(key));
  savedFavourites.set(key, next);
  renderAccount();
  const { error } = await supabaseClient.from("saved_events")
    .update({ favourite: next })
    .eq("event_id", e.id)
    .eq("user_id", currentUser.id);
  if (error) {
    savedFavourites.set(key, !next);
    renderAccount();
    alert("Could not update favourite — try again.");
  }
}

async function setSavedStatus(key, status) {
  if (!currentUser || !supabaseClient || !["interested", "going", "attended"].includes(status)) return;
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  if (status === "attended" && e.date) {
    const eventDay = new Date(e.date + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (eventDay > today) return;
  }
  const previous = savedStatuses.get(key) || "interested";
  savedStatuses.set(key, status);
  renderAccount();
  const { error } = await supabaseClient.from("saved_events")
    .update({ status })
    .eq("event_id", e.id)
    .eq("user_id", currentUser.id);
  if (error) {
    savedStatuses.set(key, previous);
    renderAccount();
    alert(error.message);
  }
}

async function saveShowNote(key, button) {
  if (!currentUser || !supabaseClient) return;
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  const panel = button?.closest(".show-notes");
  const textarea = panel?.querySelector("textarea");
  const statusEl = panel?.querySelector(".note-save-status");
  const stateEl = panel?.querySelector(".note-state");
  if (!textarea) return;

  const note = textarea.value.trim();
  const previous = savedNotes.get(key) || "";
  button.disabled = true;
  if (statusEl) statusEl.textContent = "Saving…";

  const { error } = await supabaseClient.from("saved_events")
    .update({ notes: note || null })
    .eq("event_id", e.id)
    .eq("user_id", currentUser.id);

  button.disabled = false;
  if (error) {
    savedNotes.set(key, previous);
    if (statusEl) statusEl.textContent = "Could not save — try again.";
    return;
  }

  savedNotes.set(key, note);
  if (stateEl) stateEl.textContent = note ? "Note saved" : "Add note";
  if (statusEl) statusEl.textContent = note ? "Saved ✓" : "Note cleared";
}

async function clearShowNote(key, button) {
  const panel = button?.closest(".show-notes");
  const textarea = panel?.querySelector("textarea");
  if (!textarea) return;
  textarea.value = "";
  const saveButton = panel.querySelector(".show-notes-actions .secondary");
  if (saveButton) await saveShowNote(key, saveButton);
}

async function removeSavedFromAccount(key) {
  if (!currentUser || !supabaseClient) return;
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  const { error } = await supabaseClient.from("saved_events").delete().eq("event_id", e.id).eq("user_id", currentUser.id);
  if (error) return alert(error.message);
  savedIds.delete(key);
  savedStatuses.delete(key);
  savedNotes.delete(key);
  render();
  renderAccount();
}

function showAuthMessage(message) {
  $("authStatus").textContent = message;
}


function setLocationStatus(message, isError = false) {
  const el = $("locationStatus");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", isError);
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setLocationStatus("Location isn't available in this browser. You can enter a town or postcode instead.", true);
    return;
  }
  setLocationStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      userPlace = "";
      localStorage.removeItem("csp_user_place");
      setLocationStatus("📍 Location found — shows are sorted nearest first. Mileage shown is approximate straight-line distance; Maps gives the real driving route.");
      const clearBtn = $("clearLocationBtn"); if (clearBtn) clearBtn.hidden = false;
      render();
    },
    (error) => {
      const messages = {
        1: "Location permission was declined. You can enter a town or postcode instead.",
        2: "We couldn't determine your location. Try again or enter a town/postcode.",
        3: "Location took too long. Try again or enter a town/postcode."
      };
      setLocationStatus(messages[error.code] || "We couldn't determine your location. Try again or enter a town/postcode.", true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
}

function useEnteredPlace() {
  const value = $("placeInput").value.trim();
  if (!value) {
    setLocationStatus("Enter a town or postcode first.", true);
    return;
  }
  const normalized = normalizePlace(value);
  let coords = PLACE_CENTRES[normalized] || null;
  if (!coords) coords = POSTCODE_AREA_CENTRES[postcodeArea(value)] || null;
  if (!coords) {
    setLocationStatus("I don't have that town/postcode area stored yet. Use phone location for accurate nearest-show sorting.", true);
    return;
  }
  userPlace = value;
  userLocation = { latitude: coords[0], longitude: coords[1], accuracy: null, approximate: true };
  localStorage.setItem("csp_user_place", value);
  setLocationStatus(`📍 Using ${value} — shows are sorted nearest first. Town/postcode distances are approximate straight-line distances; Maps gives the real driving route.`);
  const clearBtn = $("clearLocationBtn"); if (clearBtn) clearBtn.hidden = false;
  render();
}

function clearLocation() {
  userLocation = null;
  userPlace = "";
  localStorage.removeItem("csp_user_place");
  $("placeInput").value = "";
  const clearBtn = $("clearLocationBtn"); if (clearBtn) clearBtn.hidden = true;
  setLocationStatus("Distance sorting cleared.");
  render();
}

async function signInOrSignUp(mode) {
  if (!supabaseClient) return showAuthMessage("Connect Supabase first in Settings.");
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  if (!email || !password) return showAuthMessage("Enter your email and password.");
  showAuthMessage(mode === "signup" ? "Creating your account…" : "Signing you in…");
  if (mode === "signup") {
    const { data, error } = await supabaseClient.auth.signUp({
      email, password, options: { emailRedirectTo: window.location.href.split("#")[0] }
    });
    if (error) return showAuthMessage(error.message);
    if (data.session) {
      await loadSavedEvents(); updateAuthUI(); render(); renderAccount(); showAuthMessage("Account created and signed in.");
    } else {
      showAuthMessage("Account created. Check your email to confirm it, then sign in here.");
    }
  } else {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return showAuthMessage(error.message);
    await loadSavedEvents(); updateAuthUI(); render(); renderAccount(); showAuthMessage("Signed in successfully.");
    setTimeout(() => {
      if ($("authDialog").open) $("authDialog").close();
      if (currentUser) { renderAccount(); $("accountDialog").showModal(); }
    }, 350);
  }
}

async function signOut() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signOut();
  if (error) return showAuthMessage(error.message);
  savedIds = new Set(); savedStatuses = new Map(); savedNotes = new Map(); currentUser = null; updateAuthUI(); render(); renderAccount(); showAuthMessage("Signed out.");
}

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escAttr(v) { return esc(v).replace(/`/g, "&#96;"); }


$("useLocationBtn").addEventListener("click", useMyLocation);
$("placeBtn").addEventListener("click", useEnteredPlace);
$("clearLocationBtn").addEventListener("click", clearLocation);
$("placeInput").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") useEnteredPlace();
});
if (userPlace) {
  $("placeInput").value = userPlace;
  const normalized = normalizePlace(userPlace);
  const coords = PLACE_CENTRES[normalized] || POSTCODE_AREA_CENTRES[postcodeArea(userPlace)] || null;
  if (coords) {
    userLocation = { latitude: coords[0], longitude: coords[1], accuracy: null, approximate: true };
    setLocationStatus(`📍 Using ${userPlace} — shows are sorted nearest first. Town/postcode distances are approximate straight-line distances; Maps gives the real driving route.`);
    const clearBtn = $("clearLocationBtn"); if (clearBtn) clearBtn.hidden = false;
  }
}

async function init() {
  // Demo data is optional fallback data; Supabase remains the live source.
  await loadDemoEvents();
  const connected = await connectSupabase();
  if (!connected) {
    currentEvents = demoEvents;
    $("connectionBadge").textContent = "Demo data";
  }
  const regions = [...new Set(currentEvents.map(e => e.region).filter(Boolean))].sort();
  $("regionSelect").innerHTML = `<option value="">All UK</option>` + regions.map(r => `<option value="${escAttr(r)}">${esc(regionName(r))}</option>`).join("");
  render();
  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      await loadSavedEvents();
      await loadCardPreferences();
      updateAuthUI();
      render();
      renderAccount();
    });
  }
}

$("listViewBtn").addEventListener("click", () => setView("list"));
$("mapViewBtn").addEventListener("click", () => setView("map"));
$("searchInput").addEventListener("input", render);
$("regionSelect").addEventListener("change", render);
$("dateSelect").addEventListener("change", render);
$("matchesOnlyBtn").addEventListener("click", () => {
  if (!currentUser) {
    $("authDialog").showModal();
    return;
  }
  if (!cardInterests.length) {
    renderAccount();
    $("accountDialog").showModal();
    return;
  }
  matchesOnly = !matchesOnly;
  render();
});
$("authBtn").addEventListener("click", async () => {
  if (!supabaseClient) {
    $("authDialog").showModal();
    return;
  }
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user || null;
  updateAuthUI();
  if (currentUser) {
    await loadSavedEvents();
    await loadCardPreferences();
    renderAccount();
    $("accountDialog").showModal();
  } else {
    $("authDialog").showModal();
  }
});
$("signInBtn").addEventListener("click", () => signInOrSignUp("signin"));
$("signUpBtn").addEventListener("click", () => signInOrSignUp("signup"));
$("signOutBtn").addEventListener("click", signOut);
$("accountSignOutBtn").addEventListener("click", async () => { await signOut(); $("accountDialog").close(); });
$("settingsBtn").addEventListener("click", () => {
  const c = config();
  $("supabaseUrl").value = c.url || PROJECT_URL_DEFAULT;
  $("supabaseKey").value = c.key || "";
  $("settingsDialog").showModal();
});
$("settingsForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const url = $("supabaseUrl").value.trim();
  const key = $("supabaseKey").value.trim();
  if (!url || !key) return $("settingsStatus").textContent = "Please enter both values.";
  localStorage.setItem("csp_supabase_url", url);
  localStorage.setItem("csp_supabase_key", key);
  $("settingsStatus").textContent = "Saved. Reloading…";
  setTimeout(() => location.reload(), 500);
});
$("clearConfig").addEventListener("click", () => {
  localStorage.removeItem("csp_supabase_url");
  localStorage.removeItem("csp_supabase_key");
  location.reload();
});

const savePreferencesBtn = $("savePreferencesBtn");
if (savePreferencesBtn) savePreferencesBtn.addEventListener("click", saveCardPreferences);

init();


document.addEventListener("click", (ev) => {
  const closeBtn = ev.target.closest("[data-close-details], .details-close, #detailsClose, #closeDetails");
  if (!closeBtn) return;
  ev.preventDefault();
  const dialog = document.getElementById("detailsDialog");
  if (dialog && dialog.open) dialog.close();
});

document.addEventListener("click", (ev) => {
  const dialog = document.getElementById("detailsDialog");
  if (dialog && ev.target === dialog) dialog.close();
});
