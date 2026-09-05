const PROJECT_URL_DEFAULT = "https://fafkcpkhwjopelvkupwe.supabase.co";
const EVENTS_FILE = "events.json";

let demoEvents = [];
let currentEvents = [];
let supabaseClient = null;
let savedIds = new Set();
let currentUser = null;
let userLocation = null;
let userPlace = localStorage.getItem("csp_user_place") || "";
let eventCoordinates = JSON.parse(localStorage.getItem("csp_event_coordinates") || "{}");
let distanceReady = false;

const $ = (id) => document.getElementById(id);

function config() {
  return {
    url: localStorage.getItem("csp_supabase_url") || "",
    key: localStorage.getItem("csp_supabase_key") || ""
  };
}

async function loadDemoEvents() {
  const res = await fetch(EVENTS_FILE);
  demoEvents = await res.json();
}

async function loadSavedEvents() {
  savedIds = new Set();
  currentUser = null;
  if (!supabaseClient) return;
  const { data: { user } } = await supabaseClient.auth.getUser();
  currentUser = user || null;
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from("saved_events").select("event_id").eq("user_id", currentUser.id);
  if (error) { console.warn("Could not load saved events:", error); return; }
  savedIds = new Set((data || []).map(row => String(row.event_id)));
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
      postcode: e.postcode || extractPostcode(e.address || ""),
      region: e.region || "",
      ticket_url: e.ticket_url || e.website || "",
      source_url: e.source_url || e.website || "",
      pokemon_relevance: e.pokemon_relevance || "Card show"
    }));
    await loadSavedEvents();
    updateAuthUI();
    $("connectionBadge").textContent = "Supabase connected";
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

function render() {
  const q = $("searchInput").value.trim().toLowerCase();
  const region = $("regionSelect").value;
  const dateFilter = $("dateSelect").value;
  const distanceFilter = $("distanceSelect")?.value || "all";
  const maxMiles = distanceFilter === "all" ? Infinity : Number(distanceFilter);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let filtered = currentEvents.filter(e => {
    const hay = [e.name,e.city,e.venue,e.postcode,e.region,e.address].join(" ").toLowerCase();
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
    const distance = getEventDistance(e);
    const distanceMatches = maxMiles === Infinity || (distance != null && distance <= maxMiles);
    return (!q || hay.includes(q)) && (!region || e.region === region) && dateMatches && distanceMatches;
  });

  if (userLocation) {
    filtered.sort((a,b) => {
      const da = getEventDistance(a);
      const db = getEventDistance(b);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }

  $("countLabel").textContent = `${filtered.length} show${filtered.length === 1 ? "" : "s"}`;
  $("eventsList").innerHTML = filtered.length ? filtered.map(eventCard).join("") :
    `<div class="empty">No shows match those filters.</div>`;
}

function eventCard(e) {
  const key = eventKey(e);
  const saved = savedIds.has(key);
  const url = e.ticket_url || e.source_url || "#";
  return `<article class="event">
    <div class="event-top">
      <div><h3>${esc(e.name || "Card show")}</h3>
      <div class="date">${formatDate(e.date)}${e.end_date && e.end_date !== e.date ? ` – ${formatDate(e.end_date)}` : ""}</div></div>
      <span class="tag">${esc(e.pokemon_relevance || "Card show")}</span>
    </div>
    <div class="meta">${esc(e.venue || "")}${e.city ? ` · ${esc(e.city)}` : ""}${e.postcode ? ` · ${esc(e.postcode)}` : ""}<br>${esc(e.time || "")}${e.price ? ` · ${esc(e.price)}` : ""}</div>
    <div class="tags">${e.region ? `<span class="tag">${esc(regionName(e.region))}</span>` : ""}${getEventDistance(e) != null ? `<span class="distance-badge">📍 ${getEventDistance(e).toFixed(1)} miles away</span>` : ""}</div>
    <div class="actions">
      <button class="${saved ? "secondary saved" : "secondary"}" onclick="toggleSave('${escAttr(key)}')">${saved ? "♥ Saved" : "♡ Save event"}</button>
      ${url !== "#" ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">Details</a>` : ""}
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
  } else {
    const { error } = await supabaseClient.from("saved_events").insert({ event_id: e.id, user_id: authData.user.id });
    if (error) return alert(error.message);
    savedIds.add(key);
  }
  render();
  renderAccount();
}

function updateAuthUI() {
  const btn = $("authBtn");
  if (!btn) return;
  btn.textContent = currentUser ? "👤 Account" : "👤 Sign in";
}

function renderAccount() {
  const email = $("accountEmail");
  const list = $("savedEventsList");
  const count = $("savedCount");
  if (!email || !list || !count) return;
  email.textContent = currentUser?.email || "Signed in";
  const saved = currentEvents.filter(e => savedIds.has(eventKey(e)));
  count.textContent = `${saved.length} show${saved.length === 1 ? "" : "s"}`;
  if (!saved.length) {
    list.innerHTML = `<div class="empty-saved">You haven't saved any shows yet.<br>Tap <strong>♡ Save event</strong> on a show to add it here.</div>`;
    return;
  }
  list.innerHTML = saved.map(e => {
    const url = e.ticket_url || e.source_url || "#";
    return `<article class="saved-event">
      <div class="saved-title">${esc(e.name || "Card show")}</div>
      <div class="saved-meta">${formatDate(e.date)}${e.city ? ` · ${esc(e.city)}` : ""}${e.venue ? ` · ${esc(e.venue)}` : ""}</div>
      <div class="saved-actions">
        <button type="button" class="secondary" onclick="removeSavedFromAccount('${escAttr(eventKey(e))}')">♥ Saved</button>
        ${url !== "#" ? `<a class="primary" href="${escAttr(url)}" target="_blank" rel="noopener">Details</a>` : ""}
      </div>
    </article>`;
  }).join("");
}

async function removeSavedFromAccount(key) {
  if (!currentUser || !supabaseClient) return;
  const e = currentEvents.find(x => eventKey(x) === key);
  if (!e) return;
  const { error } = await supabaseClient.from("saved_events").delete().eq("event_id", e.id).eq("user_id", currentUser.id);
  if (error) return alert(error.message);
  savedIds.delete(key);
  render();
  renderAccount();
}

function showAuthMessage(message) {
  $("authStatus").textContent = message;
}



function extractPostcode(value) {
  const match = String(value || "").toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function eventPostcode(e) {
  return e.postcode || extractPostcode(e.address || "");
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 3958.7613;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function lookupUserPlace(value) {
  const clean = value.trim();
  const postcode = extractPostcode(clean);
  if (postcode) {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`);
    if (!res.ok) throw new Error("That postcode couldn't be found.");
    const data = await res.json();
    return data.result ? { latitude: data.result.latitude, longitude: data.result.longitude, label: data.result.postcode } : null;
  }
  const res = await fetch(`https://api.postcodes.io/places?q=${encodeURIComponent(clean)}&limit=1`);
  if (!res.ok) throw new Error("We couldn't find that place.");
  const data = await res.json();
  const place = data.result?.[0];
  if (!place) throw new Error("We couldn't find that place. Try a town or postcode.");
  return { latitude: Number(place.latitude), longitude: Number(place.longitude), label: place.name_1 };
}

async function loadEventCoordinates() {
  const postcodes = [...new Set(currentEvents.map(eventPostcode).filter(Boolean))];
  if (!postcodes.length) return;
  const missing = postcodes.filter(pc => !eventCoordinates[pc.toUpperCase()]);
  if (missing.length) {
    const res = await fetch("https://api.postcodes.io/postcodes?filter=postcode,latitude,longitude", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({postcodes: missing})
    });
    if (!res.ok) throw new Error("We couldn't load show locations.");
    const data = await res.json();
    (data.result || []).forEach(row => {
      if (row.result?.latitude != null && row.result?.longitude != null) {
        eventCoordinates[row.query.toUpperCase()] = {
          latitude: Number(row.result.latitude),
          longitude: Number(row.result.longitude)
        };
      }
    });
    localStorage.setItem("csp_event_coordinates", JSON.stringify(eventCoordinates));
  }
  distanceReady = true;
}

function getEventDistance(e) {
  if (!userLocation) return null;
  const pc = eventPostcode(e);
  const coords = pc ? eventCoordinates[pc.toUpperCase()] : null;
  if (!coords) return null;
  return haversineMiles(userLocation.latitude, userLocation.longitude, coords.latitude, coords.longitude);
}

async function prepareDistances() {
  try {
    if (userPlace && !userLocation) {
      const place = await lookupUserPlace(userPlace);
      userLocation = { latitude: place.latitude, longitude: place.longitude, accuracy: null };
    }
    await loadEventCoordinates();
    render();
    const withDistance = currentEvents.filter(e => getEventDistance(e) != null).length;
    setLocationStatus(`📍 Location set. Distance is ready for ${withDistance} of ${currentEvents.length} shows.`);
  } catch (err) {
    distanceReady = false;
    setLocationStatus(err.message || "We couldn't calculate show distances. Try again.", true);
  }
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
      setLocationStatus("📍 Location found. Calculating show distances…");
      prepareDistances();
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

async function useEnteredPlace() {
  const value = $("placeInput").value.trim();
  if (!value) {
    setLocationStatus("Enter a town or postcode first.", true);
    return;
  }
  userPlace = value;
  localStorage.setItem("csp_user_place", value);
  setLocationStatus(`📍 Finding ${value}…`);
  try {
    const place = await lookupUserPlace(value);
    userLocation = { latitude: place.latitude, longitude: place.longitude, accuracy: null };
    setLocationStatus(`📍 Location set to ${place.label}. Calculating show distances…`);
    await prepareDistances();
  } catch (err) {
    userLocation = null;
    setLocationStatus(err.message || "We couldn't find that place.", true);
  }
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
  savedIds = new Set(); currentUser = null; updateAuthUI(); render(); renderAccount(); showAuthMessage("Signed out.");
}

function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escAttr(v) { return esc(v).replace(/`/g, "&#96;"); }


$("useLocationBtn").addEventListener("click", useMyLocation);
$("placeBtn").addEventListener("click", useEnteredPlace);
$("placeInput").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") useEnteredPlace();
});
$("distanceSelect").addEventListener("change", render);
if (userPlace) {
  $("placeInput").value = userPlace;
  setLocationStatus(`📍 Location saved as ${userPlace}.`);
}

async function init() {
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
      updateAuthUI();
      render();
      renderAccount();
    });
  }
}

$("searchInput").addEventListener("input", render);
$("regionSelect").addEventListener("change", render);
$("dateSelect").addEventListener("change", render);
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

init();
