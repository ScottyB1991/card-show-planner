/* THE CARD MAP v27 — Show Card Artwork
   Progressive enhancement only:
   - If an event has image_url, its existing card gets that image as artwork.
   - If image_url is blank/missing/broken, the existing clean card remains.
   - No Scout, Supabase auth, matching, saving, or ranking logic is changed.
*/
(() => {
  "use strict";

  function safeImageUrl(value) {
    if (typeof value !== "string") return "";
    const raw = value.trim();
    if (!raw) return "";
    try {
      const url = new URL(raw, window.location.href);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.href;
    } catch (_) {
      return "";
    }
  }

  function eventArtworkMap() {
    const map = new Map();
    if (!Array.isArray(window.currentEvents)) return map;
    for (const event of window.currentEvents) {
      const url = safeImageUrl(event && event.image_url);
      if (!url) continue;
      try {
        map.set(String(eventKey(event)), url);
      } catch (_) {}
    }
    return map;
  }

  function textOf(el) {
    return (el && el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function findEventForCard(card, events) {
    // Prefer the card's own onclick/event key when present.
    const html = card.outerHTML || "";
    for (const event of events) {
      const url = safeImageUrl(event && event.image_url);
      if (!url) continue;
      let key = "";
      try { key = String(eventKey(event)); } catch (_) {}
      if (key && html.includes(key)) return { event, url };
    }

    // Safe fallback: match the visible event name exactly/within card text.
    const cardText = textOf(card);
    for (const event of events) {
      const url = safeImageUrl(event && event.image_url);
      const name = String(event && event.name || "").trim().toLowerCase();
      if (url && name && cardText.includes(name)) return { event, url };
    }
    return null;
  }

  function applyArtwork() {
    if (!Array.isArray(window.currentEvents) || !window.currentEvents.length) return;

    const cards = document.querySelectorAll(".event, .saved-event, .next-show-card");
    cards.forEach(card => {
      const match = findEventForCard(card, window.currentEvents);
      if (!match) {
        card.classList.remove("has-show-artwork");
        card.style.removeProperty("--show-artwork");
        return;
      }

      // Preload first. Broken artwork must never leave a broken-looking card.
      const img = new Image();
      img.onload = () => {
        card.style.setProperty("--show-artwork", `url("${match.url.replace(/"/g, "%22")}")`);
        card.classList.add("has-show-artwork");
      };
      img.onerror = () => {
        card.classList.remove("has-show-artwork");
        card.style.removeProperty("--show-artwork");
      };
      img.src = match.url;
    });
  }

  let queued = false;
  function queueArtwork() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyArtwork();
    });
  }

  // Render happens asynchronously after Supabase loads. Watching the document
  // keeps this enhancement independent from app.js and preserves the live key.
  const observer = new MutationObserver(queueArtwork);
  observer.observe(document.body, { childList:true, subtree:true });

  window.addEventListener("load", queueArtwork);
  document.addEventListener("DOMContentLoaded", queueArtwork);
})();
