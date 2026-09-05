const PROJECT_URL_DEFAULT = "https://fafkcpkhwjopelvkupwe.supabase.co";
const EVENTS_FILE = "events.json";

let demoEvents = [];
let currentEvents = [];
let supabaseClient = null;
let savedIds = new Set();
let currentUser = null;

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
      postcode: e.postcode || "",
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
  const filtered = currentEvents.filter(e => {
    const hay = [e.name,e.city,e.venue,e.postcode,e.region].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (!region || e.region === region);
  });
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
    <div class="tags">${e.region ? `<span class="tag">${esc(regionName(e.region))}</span>` : ""}</div>
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
$("authBtn").addEventListener("click", () => {
  if (currentUser) {
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
